export type AdjustmentKind = 'service' | 'tax' | 'discount' | 'rounding' | 'other';

export type ReceiptAdjustment = {
  label: string;
  kind: AdjustmentKind;
  amount: string;
  percent: string | null;
};

export type AiReceiptItem = { name: string; price: string; item_discount: string | null };

export type AiReceipt = {
  items: AiReceiptItem[];
  adjustments: ReceiptAdjustment[];
  subtotal: string | null;
  final_total: string | null;
  reconciled: boolean;
  warnings: string[];
  payment_label: string | null;
};

const kinds = new Set<AdjustmentKind>(['service', 'tax', 'discount', 'rounding', 'other']);

export function validateAiReceipt(value: unknown): AiReceipt {
  const v = value as Partial<AiReceipt> | null;
  const money = (p: unknown) => typeof p === 'string' && /^\d{1,7}\.\d{2}$/.test(p);
  if (!v || !Array.isArray(v.items) || v.items.length > 80 || !v.items.every((i) => i && typeof i.name === 'string' && i.name.trim().length > 0 && i.name.length <= 200 && money(i.price) && Number(i.price) >= 0)) {
    throw new Error('Unreadable AI response. Try a clearer photo or enter the items manually.');
  }
  if (!(v.subtotal === null || v.subtotal === undefined || money(v.subtotal)) || !(v.final_total === null || v.final_total === undefined || money(v.final_total))) {
    throw new Error('Unreadable receipt totals. Try again or enter manually.');
  }
  if (!Array.isArray(v.warnings) || v.warnings.length > 20 || !v.warnings.every((w) => typeof w === 'string' && w.length <= 500)) {
    throw new Error('Unreadable AI response. Try a clearer photo or enter the items manually.');
  }
  const rawAdjustments = v.adjustments === undefined ? [] : v.adjustments;
  if (!Array.isArray(rawAdjustments) || rawAdjustments.length > 40) throw new Error('Unreadable receipt adjustments. Try again or enter manually.');
  const adjustments = rawAdjustments.map((row) => normalizeAdjustment(row));
  return {
    ...reconcileReceipt({
      items: v.items.map((item) => ({ name: item.name.trim(), price: item.price, item_discount: normalizeItemDiscount(item.item_discount) })),
      adjustments,
      subtotal: v.subtotal ?? null,
      final_total: v.final_total ?? null,
      warnings: [...v.warnings],
    }),
    payment_label: normalizePaymentLabel(v.payment_label),
  };
}

export function reconcileReceipt(input: {
  items: AiReceiptItem[];
  adjustments: ReceiptAdjustment[];
  subtotal: string | null;
  final_total: string | null;
  warnings: string[];
}): AiReceipt {
  const grossCents = input.items.reduce((sum, item) => sum + cents(item.price), 0);
  const itemDiscountCents = input.items.reduce((sum, item) => sum + (item.item_discount ? cents(item.item_discount) : 0), 0);
  const netCents = grossCents + itemDiscountCents;
  const subtotalCents = input.subtotal === null ? netCents : cents(input.subtotal);
  const finalCents = input.final_total === null ? null : cents(input.final_total);
  let adjustments = input.adjustments.map((row) => ({ ...row }));
  const warnings = [...input.warnings];
  if (itemDiscountCents !== 0) {
    const duplicate = adjustments.findIndex((row) => row.kind === 'discount' && cents(row.amount) === itemDiscountCents);
    if (duplicate >= 0) {
      adjustments.splice(duplicate, 1);
      warnings.push('The member discount matches the discounts already on each dish, so it was not subtracted again.');
    }
  }
  if (adjustments.length === 0 && finalCents !== null && finalCents !== subtotalCents && netCents === subtotalCents && itemDiscountCents === 0) {
    const inferred = inferSingaporeCharges(subtotalCents, finalCents);
    if (inferred) {
      adjustments = inferred;
      warnings.push('Service charge and GST were not printed. 10% service and 9% GST match the total, so those were filled in.');
    }
  }
  const adjustmentCents = adjustments.reduce((sum, row) => sum + cents(row.amount), 0);
  const subtotalMatches = input.subtotal === null || subtotalCents === grossCents || subtotalCents === netCents;
  const reconciled = finalCents !== null && subtotalMatches && netCents + adjustmentCents === finalCents;
  return {
    items: input.items,
    adjustments,
    subtotal: input.subtotal,
    final_total: input.final_total,
    reconciled,
    warnings,
    payment_label: null,
  };
}

function inferSingaporeCharges(subtotalCents: number, finalCents: number): ReceiptAdjustment[] | null {
  if (subtotalCents <= 0 || finalCents <= subtotalCents) return null;
  const service = Math.round(subtotalCents * 10 / 100);
  const gst = Math.round((subtotalCents + service) * 9 / 100);
  if (subtotalCents + service + gst !== finalCents) return null;
  return [
    { label: 'Service charge', kind: 'service', amount: formatMoney(service), percent: '10' },
    { label: 'GST', kind: 'tax', amount: formatMoney(gst), percent: '9' },
  ];
}

function normalizeAdjustment(value: unknown): ReceiptAdjustment {
  const row = value as Partial<ReceiptAdjustment> | null;
  const amount = typeof row?.amount === 'string' ? row.amount.trim() : '';
  if (!row || typeof row.label !== 'string' || row.label.trim().length < 1 || row.label.length > 80 || !kinds.has(row.kind as AdjustmentKind) || !/^-?\d{1,7}\.\d{2}$/.test(amount)) {
    throw new Error('Unreadable receipt adjustments. Try again or enter manually.');
  }
  const percent = normalizePercent(row.percent);
  let signed = amount;
  if (row.kind === 'discount' && cents(signed) > 0) signed = formatMoney(-cents(signed));
  return { label: row.label.trim(), kind: row.kind as AdjustmentKind, amount: signed, percent };
}

function normalizePaymentLabel(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') return null;
  const label = value.trim().toUpperCase().replace(/\s+/g, ' ');
  if (!/^[A-Z](?:[A-Z ]{0,23}[A-Z])?$/.test(label) || label.length < 3) return null;
  return label;
}

function normalizeItemDiscount(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' || !/^-?\d{1,7}\.\d{2}$/.test(value.trim())) {
    throw new Error('Unreadable item discount. Try again or enter manually.');
  }
  const amount = value.trim();
  if (cents(amount) === 0) return null;
  return cents(amount) > 0 ? formatMoney(-cents(amount)) : amount;
}

function normalizePercent(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' || !/^\d{1,3}(\.\d{1,3})?$/.test(value) || Number(value) > 100) {
    throw new Error('Unreadable receipt adjustments. Try again or enter manually.');
  }
  return value;
}

function cents(value: string) {
  const negative = value.startsWith('-');
  return Math.round(Number(negative ? value.slice(1) : value) * 100) * (negative ? -1 : 1);
}

function formatMoney(centsValue: number) {
  const sign = centsValue < 0 ? '-' : '';
  return `${sign}${(Math.abs(centsValue) / 100).toFixed(2)}`;
}

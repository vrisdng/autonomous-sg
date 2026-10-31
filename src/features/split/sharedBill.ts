import { BillAdjustment, itemNetCents, parseCents, parseSignedCents, SplitItem } from './calculateBill';
import { PaymentSettlement } from '../../data/billDraft';

export type SharedBillDraft = {
  revision?: number;
  items: SplitItem[];
  adjustments: BillAdjustment[];
  finalTotal: string;
  receiptTotal: string;
  confirmedTotal: string;
  confirmedAt: string;
  totalRevisedAt: string;
  requiresTotalConfirmation: boolean;
  servicePercent: string;
  gstPercent: string;
  settlements: Record<string, PaymentSettlement>;
};

type RpcBill = { exists?: unknown; revision?: unknown; service_percent?: unknown; gst_percent?: unknown; items?: unknown; settlements?: unknown; adjustments?: unknown; final_total_cents?: unknown; confirmed_total_cents?: unknown; confirmed_at?: unknown; total_revised_at?: unknown; requires_total_confirmation?: unknown };
type RpcBillItem = { id?: unknown; name?: unknown; price_cents?: unknown; claimant_ids?: unknown };

export function serializeSharedBillItems(items: SplitItem[]) {
  return items.map((item) => ({
    id: item.id,
    name: item.name.trim(),
    price_cents: itemNetCents(item),
    claimant_ids: [...new Set(item.claimantIds)],
  }));
}

export function parseRemoteBill(value: unknown): SharedBillDraft | null {
  const bill = value as RpcBill | null;
  if (bill?.exists !== true) return null;
  if (!Array.isArray(bill.items)) throw new Error('The shared bill response is invalid.');

  const items = bill.items.map((value) => {
    const item = value as RpcBillItem;
    if (typeof item.id !== 'string' || typeof item.name !== 'string' || typeof item.price_cents !== 'number') {
      throw new Error('The shared bill contains an invalid item.');
    }
    return {
      id: item.id,
      name: item.name,
      price: (item.price_cents / 100).toFixed(2),
      claimantIds: Array.isArray(item.claimant_ids)
        ? item.claimant_ids.filter((id): id is string => typeof id === 'string')
        : [],
    };
  });

  const finalTotal = typeof bill.final_total_cents === 'number' && bill.final_total_cents >= 0
    ? (bill.final_total_cents / 100).toFixed(2)
    : '';
  const confirmed = typeof bill.confirmed_total_cents === 'number' && bill.confirmed_total_cents >= 0 && typeof bill.confirmed_at === 'string'
    ? { confirmedTotal: (bill.confirmed_total_cents / 100).toFixed(2), confirmedAt: bill.confirmed_at }
    : { confirmedTotal: '', confirmedAt: '' };
  return {
    revision: typeof bill.revision === 'number' ? bill.revision : undefined,
    items,
    adjustments: parseAdjustments(bill.adjustments),
    finalTotal,
    receiptTotal: finalTotal,
    ...confirmed,
    totalRevisedAt: typeof bill.total_revised_at === 'string' ? bill.total_revised_at : '',
    requiresTotalConfirmation: bill.requires_total_confirmation === true,
    servicePercent: normalizeRate(bill.service_percent),
    gstPercent: normalizeRate(bill.gst_percent),
    settlements: parseSettlements(bill.settlements),
  };
}

export function serializeAdjustments(adjustments: BillAdjustment[]) {
  return adjustments.map((row) => ({
    id: row.id,
    label: row.label.trim(),
    kind: row.kind,
    amount_cents: parseSignedCents(row.amount) ?? 0,
    percent: row.percent && row.percent.trim() ? Number(row.percent) : null,
  }));
}

export function billClaimsOpen(draft: { requiresTotalConfirmation?: boolean; confirmedAt?: string }) {
  return draft.requiresTotalConfirmation !== true || Boolean(draft.confirmedAt);
}

export function splitAuthoritativeCents(draft: {
  requiresTotalConfirmation?: boolean;
  confirmedAt?: string;
  confirmedTotal?: string;
  adjustments: { amount: string }[];
  explicitFinalCents: number | null;
}) {
  if (draft.requiresTotalConfirmation !== true) {
    return draft.adjustments.length || draft.explicitFinalCents !== null ? draft.explicitFinalCents : null;
  }
  if (!draft.confirmedAt) return null;
  const cents = parseSignedCents(draft.confirmedTotal ?? '');
  return cents !== null && cents >= 0 ? cents : null;
}

export function persistedFinalCents(draft: Pick<SharedBillDraft, 'items' | 'adjustments' | 'finalTotal' | 'receiptTotal'>) {
  const typed = draft.finalTotal.trim() ? parseSignedCents(draft.finalTotal) : null;
  if (typed !== null && typed >= 0) return typed;
  const printed = draft.receiptTotal.trim() ? parseSignedCents(draft.receiptTotal) : null;
  if (printed !== null && printed >= 0) return printed;
  if (!draft.adjustments.length) return null;
  const subtotal = draft.items.reduce((sum, item) => sum + itemNetCents(item), 0);
  const adjustment = draft.adjustments.reduce((sum, row) => sum + (parseSignedCents(row.amount) ?? 0), 0);
  const total = subtotal + adjustment;
  return total >= 0 ? total : null;
}

function parseSettlements(value: unknown) {
  if (!Array.isArray(value)) return {};
  return Object.fromEntries(value.flatMap((raw) => {
    if (!raw || typeof raw !== 'object') return [];
    const row = raw as Record<string, unknown>;
    if (typeof row.participant_id !== 'string' || !['unpaid', 'sent', 'received'].includes(String(row.status)) || typeof row.amount_cents !== 'number') return [];
    return [[row.participant_id, { status: row.status as PaymentSettlement['status'], amountCents: row.amount_cents, ...(typeof row.updated_at === 'string' ? { updatedAt: row.updated_at } : {}) }]];
  }));
}

function parseAdjustments(value: unknown): BillAdjustment[] {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new Error('The shared bill contains invalid adjustments.');
  return value.map((raw) => {
    const row = raw as Record<string, unknown>;
    const kind = row.kind;
    if (typeof row.id !== 'string' || typeof row.label !== 'string' || typeof row.amount_cents !== 'number' || (kind !== 'service' && kind !== 'tax' && kind !== 'discount' && kind !== 'rounding' && kind !== 'other')) {
      throw new Error('The shared bill contains an invalid adjustment.');
    }
    const sign = row.amount_cents < 0 ? '-' : '';
    return {
      id: row.id,
      label: row.label,
      kind,
      amount: `${sign}${(Math.abs(row.amount_cents) / 100).toFixed(2)}`,
      ...(typeof row.percent === 'number' ? { percent: String(row.percent) } : {}),
    };
  });
}

function normalizeRate(value: unknown) {
  const parsed = typeof value === 'number' || typeof value === 'string' ? Number(value) : 0;
  return Number.isFinite(parsed) ? String(parsed) : '0';
}

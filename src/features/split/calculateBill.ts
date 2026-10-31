export type SplitPerson = { id: string; name: string };
export type SplitItem = { id: string; name: string; price: string; claimantIds: string[]; itemDiscount?: string | null };
export type AdjustmentKind = 'service' | 'tax' | 'discount' | 'rounding' | 'other';
export type BillAdjustment = { id: string; label: string; kind: AdjustmentKind; amount: string; percent?: string };

export function connectBillToPeople(items: SplitItem[], billPeople: SplitPerson[], participants: SplitPerson[]) {
  const participantIds = new Set(participants.map((participant) => participant.id));
  const participantIdByName = new Map(participants.map((participant) => [participant.name.trim().toLowerCase(), participant.id]));
  const migratedIds = new Map(billPeople.map((person) => [
    person.id,
    participantIds.has(person.id) ? person.id : participantIdByName.get(person.name.trim().toLowerCase()),
  ]));
  return {
    people: participants.map((participant) => ({ ...participant })),
    items: items.map((item) => ({
      ...item,
      claimantIds: [...new Set(item.claimantIds
        .map((id) => participantIds.has(id) ? id : migratedIds.get(id))
        .filter((id): id is string => Boolean(id && participantIds.has(id))))],
    })),
  };
}

export type SplitTotals = {
  subtotalCents: number;
  serviceCents: number;
  gstCents: number;
  totalCents: number;
  outstandingCents: number;
  perPersonCents: Record<string, number>;
  unclaimedItemIds: string[];
};

export function parseCents(value: string) {
  const normalized = value.trim().replace(/^(?:S\$|\$)\s*/, '');
  if (!/^\d*(\.\d{0,2})?$/.test(normalized)) return 0;
  return Math.round(Number(normalized || 0) * 100);
}

export function itemNetCents(item: { price: string; itemDiscount?: string | null }) {
  return parseCents(item.price) + (item.itemDiscount ? (parseSignedCents(item.itemDiscount) ?? 0) : 0);
}

export function parseSignedCents(value: string) {
  const normalized = value.trim().replace(/^(?:S\$|\$)\s*/, '');
  if (!/^-?\d{1,7}(\.\d{0,2})?$/.test(normalized)) return null;
  const negative = normalized.startsWith('-');
  const body = negative ? normalized.slice(1) : normalized;
  if (!body || body === '.') return null;
  const cents = Math.round(Number(body) * 100);
  return negative ? -cents : cents;
}

export function calculateBill(
  items: SplitItem[],
  people: SplitPerson[],
  servicePercent: number,
  gstPercent: number,
  adjustments: BillAdjustment[] = [],
  finalTotalCents?: number | null,
): SplitTotals {
  const baseByPerson: Record<string, number> = Object.fromEntries(people.map((person) => [person.id, 0]));
  const unclaimedItemIds: string[] = [];

  for (const item of items) {
    const validClaimants = [...new Set(item.claimantIds.filter((id) => id in baseByPerson))];
    const cents = itemNetCents(item);
    if (!validClaimants.length) {
      if (cents !== 0) unclaimedItemIds.push(item.id);
      continue;
    }
    const share = Math.floor(cents / validClaimants.length);
    let remainder = cents % validClaimants.length;
    for (const id of validClaimants) {
      baseByPerson[id] = (baseByPerson[id] ?? 0) + share + (remainder-- > 0 ? 1 : 0);
    }
  }

  const subtotalCents = items.reduce((sum, item) => sum + itemNetCents(item), 0);
  const explicitCharges = adjustments.length > 0 || (typeof finalTotalCents === 'number' && Number.isFinite(finalTotalCents));
  if (!explicitCharges) {
    const serviceCents = Math.round(subtotalCents * Math.max(0, servicePercent) / 100);
    const gstCents = Math.round((subtotalCents + serviceCents) * Math.max(0, gstPercent) / 100);
    const totalCents = subtotalCents + serviceCents + gstCents;
    const claimedSubtotalCents = Object.values(baseByPerson).reduce((sum, cents) => sum + cents, 0);
    const claimedTotalCents = subtotalCents > 0 ? Math.round(claimedSubtotalCents * totalCents / subtotalCents) : 0;
    const perPersonCents = allocateTotal(baseByPerson, claimedSubtotalCents, claimedTotalCents);
    return { subtotalCents, serviceCents, gstCents, totalCents, outstandingCents: totalCents - claimedTotalCents, perPersonCents, unclaimedItemIds };
  }

  const adjustmentCents = adjustments.reduce((sum, row) => sum + (parseSignedCents(row.amount) ?? 0), 0);
  const serviceCents = adjustments.filter((row) => row.kind === 'service').reduce((sum, row) => sum + (parseSignedCents(row.amount) ?? 0), 0);
  const gstCents = adjustments.filter((row) => row.kind === 'tax').reduce((sum, row) => sum + (parseSignedCents(row.amount) ?? 0), 0);
  const computedCents = subtotalCents + adjustmentCents;
  const totalCents = typeof finalTotalCents === 'number' && Number.isFinite(finalTotalCents) ? Math.round(finalTotalCents) : computedCents;
  const claimedSubtotalCents = Object.values(baseByPerson).reduce((sum, cents) => sum + cents, 0);
  if (subtotalCents <= 0) {
    return {
      subtotalCents,
      serviceCents,
      gstCents,
      totalCents,
      outstandingCents: totalCents,
      perPersonCents: Object.fromEntries(people.map((person) => [person.id, 0])),
      unclaimedItemIds,
    };
  }
  const shares = allocateByWeight([...people.map((person) => baseByPerson[person.id] ?? 0), subtotalCents - claimedSubtotalCents], totalCents);
  const perPersonCents = Object.fromEntries(people.map((person, index) => [person.id, shares[index] ?? 0]));
  const outstandingCents = shares[people.length] ?? 0;
  return { subtotalCents, serviceCents, gstCents, totalCents, outstandingCents, perPersonCents, unclaimedItemIds };
}

function allocateByWeight(weights: number[], total: number) {
  if (!weights.length) return [];
  const sum = weights.reduce((totalWeight, weight) => totalWeight + weight, 0);
  if (sum <= 0 || total === 0) return weights.map(() => 0);
  const sign = total < 0 ? -1 : 1;
  const magnitude = Math.abs(total);
  const rows = weights.map((weight, index) => {
    const product = weight * magnitude;
    return { index, cents: Math.floor(product / sum), remainder: product % sum };
  });
  let leftover = magnitude - rows.reduce((totalCents, row) => totalCents + row.cents, 0);
  const order = [...rows].sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (let index = 0; leftover > 0; index += 1, leftover -= 1) order[index % order.length]!.cents += 1;
  const allocated = new Array<number>(weights.length).fill(0);
  for (const row of rows) allocated[row.index] = row.cents * sign;
  return allocated;
}

function allocateTotal(base: Record<string, number>, subtotal: number, total: number) {
  const entries = Object.entries(base);
  if (subtotal <= 0) return Object.fromEntries(entries.map(([id]) => [id, 0]));
  const shares = entries.map(([id, cents]) => {
    const exact = cents * total / subtotal;
    return { id, cents: Math.floor(exact), fraction: exact - Math.floor(exact) };
  });
  let remainder = total - shares.reduce((sum, share) => sum + share.cents, 0);
  shares.sort((a, b) => b.fraction - a.fraction);
  for (let index = 0; index < shares.length && remainder > 0; index += 1, remainder -= 1) shares[index]!.cents += 1;
  return Object.fromEntries(shares.map(({ id, cents }) => [id, cents]));
}

export function formatCents(cents: number) { return (cents / 100).toFixed(2); }

export type BillChargeBreakdown = {
  subtotalCents: number;
  discountCents: number;
  serviceCents: number;
  gstCents: number;
  roundingCents: number;
  otherCents: number;
  computedCents: number;
};

export function billChargeBreakdown(
  items: { price: string; itemDiscount?: string | null }[],
  adjustments: BillAdjustment[],
  servicePercent = 0,
  gstPercent = 0,
): BillChargeBreakdown {
  const subtotalCents = items.reduce((sum, item) => sum + parseCents(item.price), 0);
  const itemDiscountCents = items.reduce((sum, item) => sum + (item.itemDiscount ? (parseSignedCents(item.itemDiscount) ?? 0) : 0), 0);
  const amount = (kind: AdjustmentKind) => adjustments.filter((row) => row.kind === kind).reduce((sum, row) => sum + (parseSignedCents(row.amount) ?? 0), 0);
  const discountCents = itemDiscountCents + amount('discount');
  const explicit = adjustments.length > 0;
  const netCents = subtotalCents + discountCents;
  const serviceCents = explicit ? amount('service') : Math.round(netCents * Math.max(0, servicePercent) / 100);
  const gstCents = explicit ? amount('tax') : Math.round((netCents + serviceCents) * Math.max(0, gstPercent) / 100);
  const roundingCents = explicit ? amount('rounding') : 0;
  const otherCents = explicit ? amount('other') : 0;
  return {
    subtotalCents,
    discountCents,
    serviceCents,
    gstCents,
    roundingCents,
    otherCents,
    computedCents: netCents + serviceCents + gstCents + roundingCents + otherCents,
  };
}

import { describe, expect, it } from 'vitest';
import { billClaimsOpen, parseRemoteBill, serializeSharedBillItems, splitAuthoritativeCents } from './sharedBill';

describe('parseRemoteBill', () => {
  it('maps server cents and claims into the editable bill shape', () => {
    expect(parseRemoteBill({
      exists: true,
      service_percent: 10,
      gst_percent: '9.000',
      items: [{ id: 'item-1', name: 'Mee sua', price_cents: 950, claimant_ids: ['person-1'] }],
      settlements: [{ participant_id: 'person-1', status: 'sent', amount_cents: 1139, updated_at: '2026-09-14T12:00:00Z' }],
    })).toEqual({
      servicePercent: '10',
      gstPercent: '9',
      adjustments: [],
      finalTotal: '',
      receiptTotal: '',
      confirmedTotal: '',
      confirmedAt: '',
      totalRevisedAt: '',
      requiresTotalConfirmation: false,
      items: [{ id: 'item-1', name: 'Mee sua', price: '9.50', claimantIds: ['person-1'] }],
      settlements: { 'person-1': { status: 'sent', amountCents: 1139, updatedAt: '2026-09-14T12:00:00Z' } },
    });
  });

  it('keeps a confirmed card total and a reopen notice', () => {
    expect(parseRemoteBill({
      exists: true,
      service_percent: 0,
      gst_percent: 0,
      items: [],
      confirmed_total_cents: 14796,
      confirmed_at: '2026-10-17T16:00:00.000Z',
      total_revised_at: '2026-10-17T16:05:00.000Z',
      final_total_cents: 14796,
    })).toMatchObject({
      confirmedTotal: '147.96',
      confirmedAt: '2026-10-17T16:00:00.000Z',
      totalRevisedAt: '2026-10-17T16:05:00.000Z',
      finalTotal: '147.96',
    });
  });

  it('treats a missing or false confirmation flag as a legacy bill', () => {
    const legacy = { exists: true, service_percent: 0, gst_percent: 0, items: [], final_total_cents: 3200 };
    expect(parseRemoteBill(legacy)?.requiresTotalConfirmation).toBe(false);
    expect(parseRemoteBill({ ...legacy, requires_total_confirmation: false })?.requiresTotalConfirmation).toBe(false);
    expect(parseRemoteBill({ ...legacy, requires_total_confirmation: true })?.requiresTotalConfirmation).toBe(true);
  });

  it('lets a legacy bill split on the existing total and a new bill wait for confirmation', () => {
    const legacy = { requiresTotalConfirmation: false, confirmedAt: '', confirmedTotal: '', adjustments: [], explicitFinalCents: 3200 };
    expect(billClaimsOpen(legacy)).toBe(true);
    expect(splitAuthoritativeCents(legacy)).toBe(3200);
    const waiting = { requiresTotalConfirmation: true, confirmedAt: '', confirmedTotal: '', adjustments: [{ amount: '1.00' }], explicitFinalCents: 14796 };
    expect(billClaimsOpen(waiting)).toBe(false);
    expect(splitAuthoritativeCents(waiting)).toBe(null);
    const confirmed = { ...waiting, confirmedAt: '2026-10-17T16:00:00.000Z', confirmedTotal: '147.00' };
    expect(billClaimsOpen(confirmed)).toBe(true);
    expect(splitAuthoritativeCents(confirmed)).toBe(14700);
  });

  it('returns null when a plan has no shared bill yet', () => {
    expect(parseRemoteBill({ exists: false })).toBeNull();
  });

  it('serializes currency as cents and removes duplicate claims', () => {
    expect(serializeSharedBillItems([
      { id: 'item-1', name: '  Mee sua ', price: 'S$9.50', claimantIds: ['person-1', 'person-1'] },
      { id: 'item-2', name: '椒盐豆腐', price: '19.90', claimantIds: [], itemDiscount: '-7.00' },
    ])).toEqual([
      { id: 'item-1', name: 'Mee sua', price_cents: 950, claimant_ids: ['person-1'] },
      { id: 'item-2', name: '椒盐豆腐', price_cents: 1290, claimant_ids: [] },
    ]);
  });
});

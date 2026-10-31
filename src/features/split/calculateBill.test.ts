import { describe, expect, it } from 'vitest';
import { calculateBill, connectBillToPeople, parseCents, SplitItem, SplitPerson } from './calculateBill';

const people: SplitPerson[] = [
  { id: 'p1', name: 'Weining' },
  { id: 'p2', name: 'Rachel' },
  { id: 'p3', name: 'Marcus' },
];

describe('bill calculation', () => {
  it('parses currency input to integer cents', () => {
    expect(parseCents('S$ 12.30')).toBe(1230);
    expect(parseCents('1.234')).toBe(0);
  });

  it('reconciles the documented sample bill exactly', () => {
    const items: SplitItem[] = [
      { id: 'i1', name: 'Har gow', price: '7.80', claimantIds: ['p1'] },
      { id: 'i2', name: 'Mee sua', price: '9.50', claimantIds: ['p2'] },
      { id: 'i3', name: 'Dumplings', price: '8.20', claimantIds: ['p3'] },
      { id: 'i4', name: 'Fried rice', price: '12.00', claimantIds: ['p1', 'p2', 'p3'] },
    ];
    const totals = calculateBill(items, people, 10, 9);
    expect(totals).toMatchObject({ subtotalCents: 3750, serviceCents: 375, gstCents: 371, totalCents: 4496, outstandingCents: 0 });
    expect(Object.values(totals.perPersonCents).reduce((sum, cents) => sum + cents, 0)).toBe(4496);
  });

  it('keeps unclaimed value outstanding, including its proportional tax', () => {
    const totals = calculateBill([
      { id: 'claimed', name: 'Claimed', price: '10.00', claimantIds: ['p1'] },
      { id: 'open', name: 'Open', price: '10.00', claimantIds: [] },
    ], people, 10, 9);
    expect(totals.unclaimedItemIds).toEqual(['open']);
    expect(totals.outstandingCents).toBe(1199);
    expect(Object.values(totals.perPersonCents).reduce((sum, cents) => sum + cents, 0)).toBe(1199);
  });

  it('does not charge a participant twice for a duplicated claim id', () => {
    const totals = calculateBill([{ id: 'shared', name: 'Shared', price: '10.00', claimantIds: ['p1', 'p1', 'p2'] }], people, 0, 0);
    expect(totals.perPersonCents).toMatchObject({ p1: 500, p2: 500, p3: 0 });
  });

  it('connects the bill to plan participants and drops stale claims', () => {
    expect(connectBillToPeople(
      [{ id: 'i1', name: 'Mee sua', price: '9.50', claimantIds: ['p1', 'removed'] }],
      [{ id: 'p1', name: 'Weining' }, { id: 'removed', name: 'Marcus' }],
      [{ id: 'plan-weining', name: 'Weining' }, { id: 'plan-rachel', name: 'Rachel' }],
    )).toEqual({
      people: [{ id: 'plan-weining', name: 'Weining' }, { id: 'plan-rachel', name: 'Rachel' }],
      items: [{ id: 'i1', name: 'Mee sua', price: '9.50', claimantIds: ['plan-weining'] }],
    });
  });
});

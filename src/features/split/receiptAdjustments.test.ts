import { describe, expect, it } from 'vitest';
import { validateAiReceipt } from '../../../supabase/functions/_shared/receiptAi';
import { calculateBill, itemNetCents, SplitItem, SplitPerson } from './calculateBill';

const people: SplitPerson[] = [
  { id: 'p1', name: 'Weining' },
  { id: 'p2', name: 'Rachel' },
  { id: 'p3', name: 'Marcus' },
];

describe('receipt adjustments', () => {
  it('keeps GST added on top of a service charge', () => {
    const receipt = validateAiReceipt({
      items: [{ name: 'Har gow', price: '37.50' }],
      adjustments: [
        { label: 'Service charge', kind: 'service', amount: '3.75', percent: '10' },
        { label: 'GST', kind: 'tax', amount: '3.71', percent: '9' },
      ],
      subtotal: '37.50',
      final_total: '44.96',
      warnings: [],
    });
    expect(receipt.reconciled).toBe(true);
    expect(receipt.adjustments.map((row) => row.amount)).toEqual(['3.75', '3.71']);
  });

  it('does not add GST again when the prices already include it', () => {
    const receipt = validateAiReceipt({
      items: [{ name: 'Laksa', price: '50.00' }],
      adjustments: [],
      subtotal: '50.00',
      final_total: '50.00',
      warnings: [],
    });
    expect(receipt.reconciled).toBe(true);
    expect(receipt.adjustments).toEqual([]);
  });

  it('keeps a member discount negative', () => {
    const receipt = validateAiReceipt({
      items: [{ name: 'Set lunch', price: '40.00' }],
      adjustments: [{ label: 'Member discount', kind: 'discount', amount: '8.00', percent: '20' }],
      subtotal: '40.00',
      final_total: '32.00',
      warnings: [],
    });
    expect(receipt.adjustments[0]).toMatchObject({ kind: 'discount', amount: '-8.00' });
    expect(receipt.reconciled).toBe(true);
  });

  it('keeps a rounding adjustment', () => {
    const receipt = validateAiReceipt({
      items: [{ name: 'Coffee', price: '10.02' }],
      adjustments: [{ label: 'Rounding', kind: 'rounding', amount: '-0.02', percent: null }],
      subtotal: '10.02',
      final_total: '10.00',
      warnings: [],
    });
    expect(receipt.reconciled).toBe(true);
    expect(receipt.adjustments[0]?.amount).toBe('-0.02');
  });

  it('infers 10% service then 9% GST only when that is the printed gap', () => {
    const inferred = validateAiReceipt({
      items: [{ name: 'Dinner', price: '100.00' }],
      adjustments: [],
      subtotal: '100.00',
      final_total: '119.90',
      warnings: [],
    });
    expect(inferred.reconciled).toBe(true);
    expect(inferred.adjustments).toEqual([
      { label: 'Service charge', kind: 'service', amount: '10.00', percent: '10' },
      { label: 'GST', kind: 'tax', amount: '9.90', percent: '9' },
    ]);

    const unmatched = validateAiReceipt({
      items: [{ name: 'Dinner', price: '100.00' }],
      adjustments: [],
      subtotal: '100.00',
      final_total: '110.00',
      warnings: [],
    });
    expect(unmatched.reconciled).toBe(false);
    expect(unmatched.adjustments).toEqual([]);
  });

  it('splits service, GST, and a discount without losing a cent', () => {
    const exclusive = calculateBill([
      { id: 'food', name: 'Har gow', price: '37.50', claimantIds: ['p1'] },
    ], people, 0, 0, [
      { id: 'service', label: 'Service charge', kind: 'service', amount: '3.75', percent: '10' },
      { id: 'gst', label: 'GST', kind: 'tax', amount: '3.71', percent: '9' },
    ], 4496);
    expect(exclusive).toMatchObject({ serviceCents: 375, gstCents: 371, totalCents: 4496, outstandingCents: 0 });
    expect(exclusive.perPersonCents.p1).toBe(4496);

    const inclusive = calculateBill([
      { id: 'a', name: 'Laksa', price: '20.00', claimantIds: ['p1'] },
      { id: 'b', name: 'Tea', price: '30.00', claimantIds: ['p2'] },
    ], people, 10, 9, [], 5000);
    expect(inclusive.totalCents).toBe(5000);
    expect(inclusive.perPersonCents).toMatchObject({ p1: 2000, p2: 3000, p3: 0 });

    const discounted = calculateBill([
      { id: 'a', name: 'Set', price: '25.00', claimantIds: ['p1'] },
      { id: 'b', name: 'Soup', price: '15.00', claimantIds: ['p2'] },
    ], people, 0, 0, [
      { id: 'member', label: 'Member discount', kind: 'discount', amount: '-8.00' },
    ], 3200);
    expect(discounted.perPersonCents).toMatchObject({ p1: 2000, p2: 1200, p3: 0 });
    expect(Object.values(discounted.perPersonCents).reduce((sum, cents) => sum + cents, 0)).toBe(3200);
  });

  it('pairs a Chinese restaurant line discount with its own dish', () => {
    const receipt = validateAiReceipt({
      items: [
        { name: '椒盐豆腐', price: '19.90', item_discount: '-7.00' },
        { name: '虾饺', price: '16.80', item_discount: '-4.00' },
        { name: '炒饭', price: '18.00', item_discount: '-3.50' },
        { name: '蒸鱼', price: '42.00', item_discount: '-6.60' },
        { name: '例汤', price: '22.80', item_discount: '-4.00' },
        { name: '青菜', price: '15.00', item_discount: '0.00' },
        { name: '例菜', price: '14.00', item_discount: null },
        { name: '米饭', price: '0.00', item_discount: null },
      ],
      adjustments: [
        { label: 'Member discount', kind: 'discount', amount: '-25.10', percent: null },
        { label: 'Service Charge', kind: 'service', amount: '12.34', percent: '10' },
        { label: 'GST', kind: 'tax', amount: '12.22', percent: '9' },
      ],
      subtotal: '148.50',
      final_total: '147.96',
      warnings: [],
    });

    expect(receipt.items).toEqual([
      { name: '椒盐豆腐', price: '19.90', item_discount: '-7.00' },
      { name: '虾饺', price: '16.80', item_discount: '-4.00' },
      { name: '炒饭', price: '18.00', item_discount: '-3.50' },
      { name: '蒸鱼', price: '42.00', item_discount: '-6.60' },
      { name: '例汤', price: '22.80', item_discount: '-4.00' },
      { name: '青菜', price: '15.00', item_discount: null },
      { name: '例菜', price: '14.00', item_discount: null },
      { name: '米饭', price: '0.00', item_discount: null },
    ]);
    expect(receipt.items.reduce((sum, item) => sum + itemNetCents({ price: item.price, itemDiscount: item.item_discount }), 0)).toBe(12340);
    expect(receipt.adjustments).toEqual([
      { label: 'Service Charge', kind: 'service', amount: '12.34', percent: '10' },
      { label: 'GST', kind: 'tax', amount: '12.22', percent: '9' },
    ]);
    expect(receipt.reconciled).toBe(true);
    expect(receipt.warnings.join(' ')).toContain('not subtracted again');

    const claims = [['p1'], ['p2'], ['p1'], ['p2'], ['p3'], ['p3'], ['p3'], []];
    const items: SplitItem[] = receipt.items.map((item, index) => ({
      id: `dish-${index}`,
      name: item.name,
      price: item.price,
      itemDiscount: item.item_discount,
      claimantIds: claims[index] ?? [],
    }));
    const totals = calculateBill(items, people, 0, 0, receipt.adjustments.map((row, index) => ({
      id: `adj-${index}`,
      label: row.label,
      kind: row.kind,
      amount: row.amount,
      ...(row.percent ? { percent: row.percent } : {}),
    })), 14796);
    expect(totals).toMatchObject({ subtotalCents: 12340, serviceCents: 1234, gstCents: 1222, totalCents: 14796, outstandingCents: 0, unclaimedItemIds: [] });
    expect(Object.values(totals.perPersonCents).reduce((sum, cents) => sum + cents, 0)).toBe(14796);
  });

  it('makes every claimed share sum to the charged total', () => {
    const items: SplitItem[] = [
      { id: 'a', name: 'A', price: '10.00', claimantIds: ['p1'] },
      { id: 'b', name: 'B', price: '10.00', claimantIds: ['p2'] },
      { id: 'c', name: 'C', price: '10.01', claimantIds: ['p3'] },
    ];
    const totals = calculateBill(items, people, 0, 0, [
      { id: 'round', label: 'Rounding', kind: 'rounding', amount: '-0.01' },
    ], 3000);
    expect(totals.totalCents).toBe(3000);
    expect(totals.outstandingCents).toBe(0);
    expect(Object.values(totals.perPersonCents).reduce((sum, cents) => sum + cents, 0)).toBe(3000);
  });
});

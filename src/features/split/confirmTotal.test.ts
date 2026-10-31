import { describe, expect, it } from 'vitest';
import { validateAiReceipt } from '../../../supabase/functions/_shared/receiptAi';
import { billChargeBreakdown, calculateBill, formatCents } from './calculateBill';

const dishes = [
  { name: '椒盐豆腐', price: '19.90', itemDiscount: '-7.00', claimantIds: ['p1'] },
  { name: '虾饺', price: '16.80', itemDiscount: '-4.00', claimantIds: ['p2'] },
  { name: '炒饭', price: '18.00', itemDiscount: '-3.50', claimantIds: ['p1'] },
  { name: '蒸鱼', price: '42.00', itemDiscount: '-6.60', claimantIds: ['p2'] },
  { name: '例汤', price: '22.80', itemDiscount: '-4.00', claimantIds: ['p3'] },
  { name: '青菜', price: '15.00', claimantIds: ['p3'] },
  { name: '例菜', price: '14.00', claimantIds: ['p3'] },
  { name: '米饭', price: '0.00', claimantIds: [] },
];
const adjustments = [
  { id: 'service', label: 'Service Charge', kind: 'service' as const, amount: '12.34', percent: '10' },
  { id: 'gst', label: 'GST', kind: 'tax' as const, amount: '12.22', percent: '9' },
];
const people = [
  { id: 'p1', name: 'Weining' },
  { id: 'p2', name: 'Rachel' },
  { id: 'p3', name: 'Marcus' },
];

describe('confirm total paid', () => {
  it('breaks a scanned card slip into subtotal, discounts, service, GST, and rounding', () => {
    const receipt = validateAiReceipt({
      items: dishes.map((item) => ({ name: item.name, price: item.price, item_discount: item.itemDiscount ?? null })),
      adjustments: adjustments.map(({ label, kind, amount, percent }) => ({ label, kind, amount, percent })),
      subtotal: '148.50',
      final_total: '147.96',
      payment_label: 'mastercard',
      warnings: [],
    });
    expect(receipt.payment_label).toBe('MASTERCARD');
    expect(validateAiReceipt({
      items: [{ name: 'Tea', price: '2.00' }],
      adjustments: [],
      subtotal: '2.00',
      final_total: '2.00',
      payment_label: 'VISA 4242',
      warnings: [],
    }).payment_label).toBeNull();

    const breakdown = billChargeBreakdown(dishes, adjustments);
    expect(breakdown).toMatchObject({
      subtotalCents: 14850,
      discountCents: -2510,
      serviceCents: 1234,
      gstCents: 1222,
      roundingCents: 0,
      computedCents: 14796,
    });
    expect(breakdown.computedCents - 14796).toBe(0);
  });

  it('uses the confirmed total as the split even when the rows are short', () => {
    const items = dishes.map((item, index) => ({ id: `d${index}`, ...item }));
    const short = calculateBill(items, people, 0, 0, adjustments, 14700);
    expect(short.totalCents).toBe(14700);
    expect(Object.values(short.perPersonCents).reduce((sum, cents) => sum + cents, 0)).toBe(14700);
    const gap = 14700 - billChargeBreakdown(dishes, adjustments).computedCents;
    expect(gap).toBe(-96);
    const rounded = calculateBill(items, people, 0, 0, [
      ...adjustments,
      { id: 'round', label: 'Rounding', kind: 'rounding', amount: formatCents(gap).replace(/^(\d)/, '-$1') },
    ], 14700);
    expect(billChargeBreakdown(items, [
      ...adjustments,
      { id: 'round', label: 'Rounding', kind: 'rounding', amount: '-0.96' },
    ]).computedCents).toBe(14700);
    expect(Object.values(rounded.perPersonCents).reduce((sum, cents) => sum + cents, 0)).toBe(14700);
  });
});

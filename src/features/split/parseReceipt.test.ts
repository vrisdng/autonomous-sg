import { describe, expect, it } from 'vitest';
import { parseReceiptText, receiptItems } from './parseReceipt';

describe('receipt text import', () => {
  it('extracts priced item lines and ignores totals and taxes', () => {
    expect(parseReceiptText(`Swee Choon\n2 x Har Gow   15.60\nMee Sua.....$9.50\nSubtotal 25.10\nGST 2.49\nTOTAL S$27.59`)).toEqual([
      { name: '2 x Har Gow', price: '15.60' },
      { name: 'Mee Sua', price: '9.50' },
    ]);
  });

  it('creates unclaimed bill items with stable unique ids', () => {
    const items = receiptItems([{ name: 'Prata', price: '2.50' }], 123);
    expect(items).toEqual([{ id: 'receipt-123-0', name: 'Prata', price: '2.50', claimantIds: [] }]);
  });
});

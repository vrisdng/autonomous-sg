import { SplitItem } from './calculateBill';
import { reviewReceipt } from './receiptReview';

export type ParsedReceiptItem = { name: string; price: string; itemDiscount?: string | null };

export function parseReceiptText(value: string): ParsedReceiptItem[] {
  return reviewReceipt(value).items;
}

export function receiptItems(parsed: ParsedReceiptItem[], seed = Date.now()): SplitItem[] {
  return parsed.map((item, index) => ({ id: `receipt-${seed}-${index}`, name: item.name, price: item.price, claimantIds: [], ...(item.itemDiscount ? { itemDiscount: item.itemDiscount } : {}) }));
}

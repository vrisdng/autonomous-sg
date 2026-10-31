import { expect,it } from 'vitest';
import { reviewReceipt } from './receiptReview';
import { parseCents } from './calculateBill';
it('keeps quantities and line totals while excluding English and Chinese summaries',()=>{
 const r=reviewReceipt('2 x Prata  5.00\n炒饭  8.50\n小計 13.50\n服務費 1.35\nGST 1.34\nTOTAL 16.19\nCash 20.00\nChange 3.81');
 expect(r.items).toEqual([{name:'2 x Prata',price:'5.00'},{name:'炒饭',price:'8.50'}]);
 expect(r.subtotalCents).toBe(1350);expect(r.totalCents).toBe(1619);
 expect(r.items.reduce((n,i)=>n+parseCents(i.price),0)).toBe(1350);
});
it('flags inclusive tax and discounts instead of silently converting them',()=>{
 const r=reviewReceipt('茶  2.00\n含税\nDiscount 1.00\n合计 1.00');
 expect(r.items).toHaveLength(1);expect(r.warnings).toHaveLength(3);expect(r.totalCents).toBe(100);
});

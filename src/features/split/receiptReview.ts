import { parseCents } from './calculateBill';
import type { ParsedReceiptItem } from './parseReceipt';
export type ReceiptReview={items:ParsedReceiptItem[];raw:string;subtotalCents?:number;totalCents?:number;warnings:string[];adjustments?:import('./calculateBill').BillAdjustment[];reconciled?:boolean;paymentLabel?:string};
const summary=/(?:\b(?:sub\s*total|grand\s*total|total|gst|tax|service|svc|discount|rounding|cash|change|visa|mastercard|payment|paid|balance|nett|amount\s+due|paynow|nets|credit\s+card)\b|小计|小計|总计|總計|合计|合計|总额|總額|消费税|消費稅|税|稅|服务费|服務費|折扣|优惠|優惠|找零|现金|現金|付款|应付|應付)/i;
export function reviewReceipt(raw:string):ReceiptReview{
 const result:ReceiptReview={items:[],raw,warnings:[]};
 for(const line of raw.normalize('NFKC').split(/\r?\n/)){
  const match=line.trim().match(/^(.*?)(?:\s+|\.{2,})(?:S\s*\$|\$)?\s*(\d{1,7}[.,]\d{2})\s*$/i);
  if(!match)continue;
  const name=match[1]!.trim(),price=match[2]!.replace(',','.');
  if(summary.test(name)){
   if(/sub\s*total|小计|小計/i.test(name))result.subtotalCents=parseCents(price);
   else if(/^(?:(?:grand\s*)?total|nett|总计|總計|合计|合計|应付|應付|总额|總額)/i.test(name))result.totalCents=parseCents(price);
   continue;
  }
  if(name&&/[a-z\u3400-\u9fff]/i.test(name)&&parseCents(price)>0)result.items.push({name,price});
 }
 if(/incl(?:uded|usive)?|含税|含稅/i.test(raw))result.warnings.push('Receipt may include tax already. Check the rates to avoid charging twice.');
 if(/discount|rounding|折扣|优惠|優惠|舍入|捨入/i.test(raw))result.warnings.push('Discounts or rounding need manual review; they are not automatically applied.');
 if(/gst|tax|service|svc|税|稅|服务|服務/i.test(raw))result.warnings.push('Tax/service lines are excluded from items. Check the rates below; nothing is applied automatically.');
 return result;
}

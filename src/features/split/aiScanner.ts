import { validateAiReceipt } from '../../../supabase/functions/_shared/receiptAi';
import { ReceiptReview } from './receiptReview';
import { parseCents } from './calculateBill';
export function scanAiReceipt(image:string){
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),35000);
 const result=(async():Promise<ReceiptReview>=>{
  const url=process.env.EXPO_PUBLIC_SUPABASE_URL,key=process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if(!url||!key)throw new Error('AI scanner is not configured.');
  try{
   const response=await fetch(url.replace(/\/$/,'')+'/functions/v1/receipt-ai',{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify({image,consent:true}),signal:controller.signal});
   const data=await response.json();if(!response.ok)throw new Error(data.error||'AI scan unavailable.');
   const receipt=validateAiReceipt(data.receipt);
   if(!receipt.items.length)throw new Error('No readable receipt items found. Try a clearer photo or enter manually.');
   return {items:receipt.items.map(item=>({name:item.name,price:item.price,...(item.item_discount?{itemDiscount:item.item_discount}:{})})),adjustments:receipt.adjustments.map((row,index)=>({id:`scan-${index}-${row.kind}`,label:row.label,kind:row.kind,amount:row.amount,...(row.percent?{percent:row.percent}:{})})),reconciled:receipt.reconciled,paymentLabel:receipt.payment_label??'',subtotalCents:receipt.subtotal===null?undefined:parseCents(receipt.subtotal),totalCents:receipt.final_total===null?undefined:parseCents(receipt.final_total),warnings:['AI can misread or invent values. Check every item against the photo.',...(receipt.reconciled?[]:['The items and adjustments do not add up to the charged total.']),...receipt.warnings],raw:[...receipt.items.map(item=>item.name+'  '+(item.item_discount?`(${item.item_discount}) `:'')+item.price),...receipt.adjustments.map(row=>`${row.label}  ${row.amount}`)].join('\n')};
  }catch(e){if(controller.signal.aborted)throw new Error('AI scan cancelled or timed out. You can retry manually.');throw e;}
  finally{clearTimeout(timer);}
 })();
 return {result,cancel:()=>{clearTimeout(timer);controller.abort();}};
}

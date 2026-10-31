import { expect,it } from 'vitest';
import { validateAiReceipt } from '../../../supabase/functions/_shared/receiptAi';
it('accepts a receipt that already matches its charged total',()=>{expect(validateAiReceipt({items:[{name:'茶',price:'2.00'}],adjustments:[],subtotal:null,final_total:'2.00',warnings:[]})).toMatchObject({items:[{name:'茶',price:'2.00'}],adjustments:[],subtotal:null,final_total:'2.00',reconciled:true,warnings:[]});});
it('rejects incomplete and non-monetary AI output',()=>{for(const price of ['NaN','-2.00','2.001',2])expect(()=>validateAiReceipt({items:[{name:'Tea',price}],adjustments:[],subtotal:null,final_total:null,warnings:[]})).toThrow();expect(()=>validateAiReceipt({})).toThrow();});

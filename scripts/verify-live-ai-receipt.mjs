// Explicit paid smoke test: exactly one synthetic receipt upload, no retries.
import { chromium } from 'playwright';
import { expect } from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
 const context=await browser.newContext({viewport:{width:390,height:844}});
 await context.addInitScript(()=>{if(!localStorage.getItem('bojio.plan-draft.v1'))localStorage.setItem('bojio.plan-draft.v1',JSON.stringify({code:'ABF234',participants:[{id:'me',name:'Me',origin:''}]}));});
 let calls=0;context.on('request',r=>{if(r.url().includes('/functions/v1/receipt-ai'))calls++;});
 const page=await context.newPage();await page.goto(process.env.BOJIO_PREVIEW_URL||'http://127.0.0.1:8082/');
 await page.getByRole('button',{name:'Split',exact:true}).click();await page.getByRole('button',{name:'Scan receipt 📷',exact:true}).click();
 await expect(page.locator('input[aria-label="Choose receipt photo"]').filter({visible:false})).toHaveCount(1);
 const buffer=Buffer.from(await page.evaluate(()=>{const c=document.createElement('canvas');c.width=1000;c.height=680;const x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,1000,680);x.fillStyle='black';x.font='40px "Microsoft YaHei", Arial';[['RECEIPT SGD',''],['2 x Prata','5.00'],['茶 Tea','2.00'],['Subtotal','7.00'],['Service 10%','0.70'],['GST 9%','0.69'],['TOTAL','8.39']].forEach(([a,b],i)=>{x.textAlign='left';x.fillText(a,40,80+i*95);x.textAlign='right';x.fillText(b,960,80+i*95);});return c.toDataURL('image/png').split(',')[1];}),'base64');
 const responsePromise=page.waitForResponse(r=>r.url().includes('/functions/v1/receipt-ai'),{timeout:45000});const start=Date.now();
 await page.locator('input[aria-label="Choose receipt photo"]').setInputFiles({name:'synthetic-receipt.png',mimeType:'image/png',buffer});
 const response=await responsePromise;const data=await response.json();console.log(JSON.stringify({status:response.status(),elapsedMs:Date.now()-start,provider:data.provider,error:data.error,reason:data.reason}));assert.equal(response.status(),200);
 await expect(page.getByLabel('Scanned item 1 line total',{exact:true})).toHaveValue('5.00');await expect(page.getByLabel('Scanned item 2 line total',{exact:true})).toHaveValue('2.00');assert.equal(data.receipt.total,'8.39');await expect(page.getByLabel('Receipt service percent')).toHaveValue('10');await expect(page.getByLabel('Receipt GST percent')).toHaveValue('9');
 await page.getByLabel('Scanned item 1 name',{exact:true}).fill('Reviewed prata');await page.getByRole('button',{name:'Add reviewed items',exact:true}).click();
 await expect(page.getByRole('button',{name:'Close receipt scanner',exact:true})).toHaveCount(0);await page.reload();await page.getByRole('button',{name:'Split',exact:true}).click();
 const bill=await page.evaluate(()=>JSON.parse(localStorage.getItem('bojio.bill-draft.v2:ABF234')));assert.equal(bill.items.length,2);assert.equal(bill.items[0].name,'Reviewed prata');assert.ok(bill.items.every(i=>i.claimantIds.length===0));assert.equal(calls,1);
 console.log('PASS one real bilingual synthetic AI scan, edit, append and refresh. Not a real-world accuracy benchmark.');
} finally {await browser.close();}

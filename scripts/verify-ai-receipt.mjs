import { chromium } from 'playwright';
import { expect } from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const context=await browser.newContext({viewport:{width:390,height:844}});
 await context.addInitScript(()=>localStorage.setItem('bojio.plan-draft.v1',JSON.stringify({code:'ABF234',participants:[{id:'me',name:'Me',origin:''}]})));
 let calls=0,quota=true;
 await context.route('**/functions/v1/receipt-ai',route=>{calls++;const body=route.request().postDataJSON();assert.equal(body.consent,true);assert.ok(body.image.startsWith('data:image/jpeg;base64,'));return route.fulfill({status:quota?429:200,json:quota?{error:'Gemini quota or rate limit reached.'}:{receipt:{items:[{name:'Tea',price:'2.00'}],adjustments:[{label:'Service charge',kind:'service',amount:'0.20',percent:'10'},{label:'GST',kind:'tax',amount:'0.20',percent:'9'}],subtotal:'2.00',final_total:'2.40',warnings:[]}}});});
 const page=await context.newPage();await page.goto(process.env.BOJIO_PREVIEW_URL||'http://127.0.0.1:8082/');await page.getByRole('button',{name:'Split',exact:true}).click();await page.getByRole('button',{name:'Scan receipt 📷',exact:true}).click();
 await expect(page.locator('input[aria-label="Choose receipt photo"]').filter({visible:false})).toHaveCount(1);assert.equal(calls,0);
 await expect(page.getByRole('button',{name:'On-device',exact:true})).toHaveCount(0);
 await expect(page.getByText('Photos are sent to Google Gemini to scan. Hide personal/payment details first.',{exact:true})).toBeVisible();
 await page.waitForTimeout(400); // Let the modal slide finish before visual inspection.
 await page.screenshot({path:process.env.TEMP+'/bojio-simple-scanner.png'});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.getByRole('button',{name:'Back to bill · paste or type instead',exact:true}).click();
 await expect(page.getByRole('button',{name:'Close receipt scanner',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Scan receipt 📷',exact:true}).click();
 const image=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=100;return c.toDataURL('image/png').split(',')[1];});
 await page.locator('input[aria-label="Choose receipt photo"]').setInputFiles({name:'fixture.png',mimeType:'image/png',buffer:Buffer.from(image,'base64')});
 await expect(page.getByText('Gemini quota or rate limit reached.',{exact:true})).toBeVisible();assert.equal(calls,1);
 quota=false;await page.getByRole('button',{name:'Retry AI scan',exact:true}).click();await expect(page.getByLabel('Scanned item 1 name',{exact:true})).toHaveValue('Tea');
 await expect(page.getByLabel('Adjustment 1 label')).toHaveValue('Service charge');await expect(page.getByLabel('Adjustment 2 label')).toHaveValue('GST');await expect(page.getByLabel('Amount charged')).toHaveValue('2.40');await expect(page.getByText('Total matches receipt $2.40')).toBeVisible();
 await expect(page.getByRole('button',{name:'Add reviewed items',exact:true})).toBeEnabled();await expect(page.getByRole('button',{name:'I checked these differences',exact:true})).toHaveCount(0);await page.getByRole('button',{name:'Add reviewed items',exact:true}).click();
 await expect(page.getByRole('button',{name:'Close receipt scanner',exact:true})).toHaveCount(0);assert.equal(calls,2);
 const bill=await page.evaluate(()=>JSON.parse(localStorage.getItem('bojio.bill-draft.v2:ABF234')));assert.equal(bill.items[0].price,'2.00');
 console.log('PASS mocked AI UI: photo selection starts upload, quota error/no auto retry, explicit retry, review and append. This is NOT a live Gemini verification.');
}finally{await browser.close();}

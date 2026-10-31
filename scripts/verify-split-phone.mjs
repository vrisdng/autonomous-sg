import { chromium } from 'playwright';
import { expect } from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge',headless:true});
const people=[{id:'me',name:'Me',origin:''},{id:'friend',name:'Friend',origin:''}];
const name='Very long restaurant dish name with noodles';
let bill={exists:true,revision:1,service_percent:0,gst_percent:0,items:[{id:'dish',name,price_cents:12345,claimant_ids:[]}],settlements:[]};
let saves=0;
try {
 const context=await browser.newContext({viewport:{width:360,height:800}});
 await context.addInitScript(({people})=>localStorage.setItem('bojio.plan-draft.v1',JSON.stringify({code:'ABF234',participants:people,remote:{published:true,role:'host',hostToken:'fixture'}})),{people});
 await context.route('**/rest/v1/rpc/**',async route=>{
  const action=route.request().url().split('/').pop(),body=route.request().postDataJSON();
  if(action==='save_bill_checked'){saves++;await new Promise(r=>setTimeout(r,900));bill={...bill,revision:bill.revision+1,items:body.p_items};}
  if(action==='set_host_payment_status')bill={...bill,settlements:[{participant_id:body.p_participant_id,status:body.p_status,amount_cents:body.p_amount_cents}]};
  await route.fulfill({json:action==='get_bill'||action==='save_bill_checked'||action==='set_host_payment_status'?bill:{code:'ABF234',status:'planning',participants:people}});
 });
 const page=await context.newPage();await page.goto(process.env.BOJIO_PREVIEW_URL||'http://127.0.0.1:8082/');await page.getByRole('button',{name:'Split',exact:true}).click();
 await expect(page.locator('input[value="123.45"]')).toBeVisible();
 assert.ok(await page.evaluate(()=>[...document.querySelectorAll('input')].filter(e=>e.offsetWidth).every(e=>e.getBoundingClientRect().right<=innerWidth)),'inputs must fit phone');
 await page.getByRole('button',{name:`Claim ${name} for Me`,exact:true}).click();
 await expect.poll(()=>saves).toBe(1);
 // A second claim during the first save must not be disabled or overwritten.
 await page.getByRole('button',{name:`Claim ${name} for Friend`,exact:true}).click();
 await expect.poll(()=>saves).toBe(2);
 await expect(page.getByText('Saved for everyone',{exact:true})).toBeVisible();
 assert.deepEqual(bill.items[0].claimant_ids,['me','friend']);
 await page.getByRole('button',{name:'Me',exact:true}).click();
 await expect(page.getByLabel('Your payment amount')).toHaveText('S$ 61.73');
 await page.getByRole('button',{name:'I’ve paid',exact:true}).first().click();

 await expect(page.getByText('Paid ✓ · confirmed',{exact:true}).first()).toBeVisible();
 await page.reload();await page.getByRole('button',{name:'Split',exact:true}).click();await expect(page.getByText('Paid ✓ · confirmed',{exact:true}).first()).toBeVisible();
 await page.getByRole('button',{name:`Unclaim ${name} for Me`,exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:process.env.TEMP+'/bojio-split-phone.png'});
 await page.getByRole('button',{name:'Clear receipt',exact:true}).click();await page.getByRole('button',{name:'Keep receipt',exact:true}).click();assert.equal(bill.items.length,1);
 const guest=await browser.newContext({viewport:{width:360,height:800}});
 await guest.addInitScript(({people})=>localStorage.setItem('bojio.plan-draft.v1',JSON.stringify({code:'ABF234',participants:people,remote:{published:true,role:'guest',guestToken:'fixture',participantId:'friend'}})),{people});
 await guest.route('**/rest/v1/rpc/**',async route=>{const action=route.request().url().split('/').pop(),body=route.request().postDataJSON();if(action==='set_guest_payment_sent')bill={...bill,settlements:[...bill.settlements,{participant_id:'friend',status:'sent',amount_cents:body.p_amount_cents}]};await route.fulfill({json:action==='get_bill'||action==='set_guest_payment_sent'?bill:{code:'ABF234',status:'planning',participants:people}});});
 const g=await guest.newPage();await g.goto(process.env.BOJIO_PREVIEW_URL||'http://127.0.0.1:8082/');await g.getByRole('button',{name:'Split',exact:true}).click();
 await expect(g.getByRole('button',{name:`Unclaim ${name} for Me`,exact:true})).toBeDisabled();
 await expect(g.getByLabel('Your payment amount')).toHaveText('S$ 61.72');await expect(g.getByRole('button',{name:'Clear receipt',exact:true})).toHaveCount(0);
 await g.screenshot({path:process.env.TEMP+'/bojio-guest-pay.png'});
 await g.getByRole('button',{name:'I’ve paid',exact:true}).click();await expect(g.getByText('Paid ✓ · awaiting host confirmation',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Clear receipt',exact:true}).click();await page.getByRole('button',{name:'Yes, clear receipt',exact:true}).click();await expect.poll(()=>bill.items.length).toBe(0);
 console.log('PASS mocked phone: prices fit, claim while saving, automatic sync preserves newer claims, host confirmation/refresh, guest Paid and own-only controls.');
}finally{await browser.close();}

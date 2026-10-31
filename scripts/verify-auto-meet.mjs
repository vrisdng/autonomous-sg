// Controlled schedules: verifies automatic UI behaviour, not live provider availability.
import { chromium } from 'playwright';
import { expect } from '@playwright/test';
import assert from 'node:assert/strict';
const browser = await chromium.launch({channel:'msedge',headless:true});
try {
 const context = await browser.newContext({viewport:{width:390,height:844}});
 await context.addInitScript(()=>localStorage.setItem('bojio.plan-draft.v1',JSON.stringify({code:'ABC234',meetupAt:new Date(Date.now()-3600000).toISOString(),participants:[{id:'a',name:'Alice',origin:'West',location:{label:'West',latitude:1.33,longitude:103.74}},{id:'b',name:'Bob',origin:''}]})));
 const calls=[];
 await context.route('**/functions/v1/google-places',route=>route.fulfill({json:{places:[],checkedAt:new Date().toISOString()}}));
 await context.route('**/functions/v1/onemap', async route => {
  const body=route.request().postDataJSON(); calls.push(body);
  await route.fulfill({json:{results:body.trips.map(trip=>({id:trip.id,status:'available',route:{startAt:new Date(Date.now()+3600000).toISOString(),endAt:new Date(Date.now()+4800000).toISOString(),durationSeconds:1200,source:'onemap',checkedAt:new Date().toISOString(),steps:[]}}))}});
 });
 const page=await context.newPage();
 await page.goto(process.env.BOJIO_PREVIEW_URL || 'http://127.0.0.1:8081/');
 await page.getByRole('button',{name:'Meet',exact:true}).click();
 await page.getByRole('switch',{name:'Browse checked shortlist',exact:true}).click();
 await expect(page.getByText('Alice: 20 min · train / bus',{exact:true})).toHaveCount(3);
 await expect(page.getByText('Bob: add starting point',{exact:true})).toHaveCount(3);
 await expect(page.getByRole('button',{name:'Compare travel times (optional)',exact:true})).toHaveCount(0);
 assert.equal(calls.length,3,'only initial three visible venues checked');
 assert.ok(calls.every(call=>call.trips.length===1),'missing origins must not be routed');
 assert.ok(Date.parse(calls[0].departureAt)>Date.now()-30000,'past saved meetup uses now, explicitly labelled');
 await page.getByRole('button',{name:'Meet here',exact:true}).first().click();
 await expect(page.getByText('Alice: 20 min · train / bus',{exact:true})).toHaveCount(3);
 await page.waitForTimeout(1000);
 assert.equal(calls.length,3,'choosing food must not invalidate travel times');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 console.log('PASS: automatic visible-venue times, missing-person labels, past-time handling, no comparison clicks or venue-selection refetch, phone width.');
} finally { await browser.close(); }

// Real Google content stays in the browser session only; no screenshots/content logs.
import { chromium } from 'playwright';
import { expect } from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const context=await browser.newContext({viewport:{width:390,height:844}});
 await context.addInitScript(()=>localStorage.setItem('bojio.plan-draft.v1',JSON.stringify({code:'ABC234',participants:[{id:'me',name:'Test',origin:'Singapore',location:{label:'Test origin',latitude:1.3,longitude:103.838}}],meetupAt:new Date(Date.now()+3600000).toISOString()})));
 // Isolate Google UI verification from unrelated OneMap latency/quota.
 await context.route('**/functions/v1/onemap',route=>route.fulfill({json:{results:[]}}));
 const page=await context.newPage();let reviewCount=0;
 page.on('response',async response=>{if(response.url().includes('/functions/v1/google-places')&&response.request().postDataJSON()?.action==='reviews'&&response.ok()){const body=await response.json();reviewCount=body.reviews.length;}});
 await page.goto(process.env.BOJIO_PREVIEW_URL||'https://bojio.pages.dev/');await page.getByRole('button',{name:'Meet',exact:true}).click();
 const card=page.getByRole('button',{name:/^Open photos and reviews for/});await expect(card).toBeVisible({timeout:25000});
 await expect.poll(()=>page.locator('img').first().evaluate(img=>img.complete&&img.naturalWidth>0),{timeout:25000}).toBe(true);
 await card.click();await expect(page.getByRole('button',{name:'Close restaurant details',exact:true})).toBeVisible();
 if(await page.getByRole('button',{name:'Next photo →',exact:true}).isEnabled())await page.getByRole('button',{name:'Next photo →',exact:true}).click();
 await page.getByRole('button',{name:'Read Google reviews',exact:true}).click();await expect.poll(()=>reviewCount,{timeout:25000}).toBeGreaterThan(0);
 await page.getByRole('button',{name:'Close restaurant details',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
 await expect(page.getByText(/^0 \/ \d+ rated$/)).toBeVisible();
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('bojio.swipes.v1:ABC234:host')));assert.ok(saved.venues.every(v=>Object.keys(v).length===2));
 console.log(JSON.stringify({realPhotoRendered:true,reviewCount,browsingCastNoVote:true,persistentGoogleData:'IDs only'}));
}finally{await browser.close();}

import { chromium } from 'playwright';
import { expect } from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge',headless:true});
const base=process.env.BOJIO_PREVIEW_URL || 'http://127.0.0.1:8081/';
try {
 const context=await browser.newContext({viewport:{width:390,height:844}});
 await context.route('**/functions/v1/onemap',route=>route.fulfill({json:{locations:[{label:'Test new restaurant address',latitude:1.31,longitude:103.81}]}}));
 const page=await context.newPage();
 await page.goto(base); await page.getByRole('button',{name:'Find our halfway supper →',exact:true}).click();
 await page.getByRole('switch',{name:'Browse checked shortlist',exact:true}).click();
 await page.getByRole('button',{name:'Meet here',exact:true}).first().click();
 await expect(page.getByRole('button',{name:'Selected ✓',exact:true})).toHaveCount(1);
 await page.getByLabel('Filter places',{exact:true}).fill('208882');
 await page.getByRole('button',{name:'Find a different place',exact:true}).click();
 await page.getByLabel('Or find a venue by address',{exact:true}).fill('test');
 await page.getByLabel('Or find a venue by address',{exact:true}).press('Enter');
 await page.getByRole('button',{name:'Test new restaurant address',exact:true}).click();
 await expect(page.getByLabel('Filter places',{exact:true})).toHaveValue('');
 await expect(page.getByText(/Selected Test new restaurant address/)).toBeVisible();
 await expect(page.getByRole('button',{name:'Selected ✓',exact:true})).toHaveCount(1);
 await page.reload(); await page.getByRole('button',{name:'Meet',exact:true}).click();
 await expect(page.getByText('Test new restaurant address',{exact:true}).first()).toBeVisible();
 await expect(page.getByRole('button',{name:'Selected ✓',exact:true})).toHaveCount(1);
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('bojio.plan-draft.v1')).chosenVenue.name),'Test new restaurant address');
 await context.close();
 for(const mode of ['guest','closed']) {
  const ctx=await browser.newContext({viewport:{width:390,height:844}});
  await ctx.addInitScript(({mode})=>localStorage.setItem('bojio.plan-draft.v1',JSON.stringify({code:'ABC234',participants:[],...(mode==='guest'?{remote:{role:'guest',published:false}}:{status:'closed'})})),{mode});
  const p=await ctx.newPage(); await p.goto(base); await p.getByRole('button',{name:'Meet',exact:true}).click();
  await p.getByRole('switch',{name:'Browse checked shortlist',exact:true}).click();
  await expect(p.getByText(mode==='guest'?'Vote for your favourite below. The host confirms the final meetup venue.':'This plan is closed. Voting is paused; the host can reopen it.',{exact:true})).toBeVisible();
  await expect(p.getByRole('button',{name:'Meet here',exact:true}).first()).toBeDisabled();
  await ctx.close();
 }
 console.log('PASS: empty-draft card selection, address result selects immediately through active filters, reload preserves venue, guest/closed restrictions explained.');
} finally {await browser.close();}

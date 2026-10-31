import { chromium } from 'playwright';
import { expect } from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
 const context=await browser.newContext({viewport:{width:390,height:844}});
 let searches=0;
 await context.route('**/functions/v1/google-places',route=>{
  const body=route.request().postDataJSON();
  if(body.action==='nearby') {searches++;assert.equal(body.radius,2000);const id=body.center.label==='Tampines fixture'?'eastFixture':body.rankPreference==='DISTANCE'?'extraFixture':'emptyMeetFixture';return route.fulfill({json:{places:[{id,displayName:{text:id==='emptyMeetFixture'?'Empty-start fixture restaurant':id},formattedAddress:'Test fixture address',location:{latitude:1.304,longitude:103.832}}],checkedAt:new Date().toISOString()}});}
  return route.fulfill({status:503,json:{error:'Fixture media unavailable'}});
 });
 const page=await context.newPage();
 await page.goto(process.env.BOJIO_PREVIEW_URL||'http://127.0.0.1:8082/');
 await page.getByRole('button',{name:'Meet',exact:true}).click();
 await expect(page.getByText('Choose an area to see swipe cards',{exact:true})).toBeVisible();
 assert.equal(searches,0);
 await page.getByRole('button',{name:'Find food near Orchard',exact:true}).click();
 await expect(page.getByRole('button',{name:'Open photos and reviews for Empty-start fixture restaurant',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'♥ Like',exact:true}).click();
 await expect(page.getByText('All swiped! 🎉',{exact:true})).toBeVisible();
 assert.equal(searches,1);
 await page.getByRole('button',{name:'Find more nearby · same radius',exact:true}).click();
 await expect(page.getByRole('button',{name:'Open photos and reviews for extraFixture',exact:true})).toBeVisible();
 await expect(page.getByText('1 / 2 rated',{exact:true})).toBeVisible();
 await context.route('**/functions/v1/onemap',route=>route.fulfill({json:{locations:[{label:'Tampines fixture',latitude:1.3545,longitude:103.9452}]}}));
 await page.getByRole('button',{name:'Edit search criteria and outing',exact:true}).click();
 await page.getByRole('button',{name:'Change search area',exact:true}).click();
 await page.getByRole('textbox',{name:'Restaurant search area',exact:true}).fill('Tampines');
 await page.getByRole('button',{name:'Tampines fixture',exact:true}).click();
 await expect(page.getByRole('button',{name:'Open photos and reviews for eastFixture',exact:true})).toBeVisible();
 await expect(page.getByText('0 / 1 rated',{exact:true})).toBeVisible();
 assert.equal(searches,3);
 await page.getByRole('button',{name:'Edit search criteria and outing',exact:true}).click();
 await page.getByRole('button',{name:'Outing setup · people, time & invites',exact:true}).click();
 await expect(page.getByRole('button',{name:'+ Add person',exact:true})).toBeVisible();
 console.log('PASS: empty browser → area → card; load more preserves ratings/radius; manual location replaces cards and closes menu; setup accessible.');
} finally {await browser.close();}

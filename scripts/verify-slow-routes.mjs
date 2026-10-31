import { chromium } from 'playwright';
import { expect } from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext({viewport:{width:390,height:844}});
await context.addInitScript(()=>localStorage.setItem('bojio.quick-commute.v1',JSON.stringify({from:{label:'Test start',latitude:1.3,longitude:103.8},to:{label:'Test home',latitude:1.31,longitude:103.81}})));
await context.route('**/functions/v1/onemap',async(route)=>{await new Promise((resolve)=>setTimeout(resolve,9500));await route.fulfill({json:{results:route.request().postDataJSON().trips.map((trip)=>({id:trip.id,status:'unavailable',failure:'timeout',message:'Route service timed out. Please retry or open Google Maps.'}))}});});
try{
 const page=await context.newPage();await page.goto(process.env.BOJIO_PREVIEW_URL || 'http://127.0.0.1:8081/');await page.getByRole('button',{name:'Last call',exact:true}).click();
 await expect(page.getByText(/OneMap is taking longer/)).toBeVisible({timeout:15000});await expect(page.getByRole('button',{name:'Directions in Google Maps ↗',exact:true})).toBeEnabled();
 await expect(page.getByText('Some scheduled journeys are unavailable. Retry or use Google Maps below.',{exact:true})).toBeVisible();await expect(page.getByText('Not available',{exact:true})).toBeVisible();
 assert.equal(await page.getByText(/minutes left, including/).count(),0);await expect(page.getByRole('button',{name:'Check scheduled journeys',exact:true})).toBeEnabled();
 console.log('PASS (fixtures): eight-second fallback, timeout message, retry enabled, no fabricated countdown.');
}finally{await browser.close();}

// Deterministic UI fixtures, not evidence of live OneMap availability.
import { chromium } from 'playwright';
import { expect } from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext({viewport:{width:390,height:844}});
const base=process.env.BOJIO_PREVIEW_URL || 'http://127.0.0.1:8081/';
const people=Array.from({length:4},(_,i)=>({id:String(i),name:`Rider ${i+1}`,origin:'Test',transportMode:'ride',location:{label:`Test home ${i+1}`,latitude:1.31+i*.001,longitude:103.8}}));
const venue={id:'test-venue',name:'Test venue',address:'Test address',source:'onemap',latitude:1.3,longitude:103.8,area:'Singapore',nearestStation:'',detail:'Test only',tags:[],openUntil:'Unknown',point:{x:0,y:0}};
await context.addInitScript(({people,venue})=>{if(!localStorage.getItem('bojio.plan-draft.v1'))localStorage.setItem('bojio.plan-draft.v1',JSON.stringify({code:'ABC234',participants:people,chosenVenue:venue}));},{people,venue});
let count=0;
await context.route('**/functions/v1/onemap',async(route)=>{
 const body=route.request().postDataJSON();count+=body.trips.length;
 await route.fulfill({json:{legs:body.trips.map((trip)=>({id:trip.id,seconds:Math.round(trip.from.latitude===1.3?600+(trip.to.latitude-1.31)*100000:Math.abs(trip.from.latitude-trip.to.latitude)*100000)}))}});
});
try{
 const page=await context.newPage();const errors=[];page.on('pageerror',(error)=>errors.push(error.message));await page.goto(base);
 await page.getByRole('button',{name:'Share ride',exact:true}).click();
 await page.getByRole('button',{name:'Find ride partners',exact:true}).click();
 await expect(page.getByText(/OneMap road durations checked where available/)).toBeVisible();
 await expect(page.getByText('Rider 1 + Rider 2 + Rider 3 + Rider 4',{exact:true})).toBeVisible();assert.equal(count,16);
 await page.getByPlaceholder('Enter fare',{exact:true}).fill('10.01');
 await expect(page.getByText('Rider 1: S$2.51',{exact:true})).toBeVisible();await expect(page.getByText(/Rider [234]: S\$2.50/)).toHaveCount(3);
 await page.getByRole('button',{name:'Drop-off order & directions',exact:true}).click();
 const popupPromise=context.waitForEvent('page');await page.getByRole('button',{name:'Open driving directions ↗',exact:true}).click();const popup=await popupPromise;
 await popup.waitForURL(/google.*maps/);assert.equal(new URL(popup.url()).searchParams.get('waypoints').split('|').length,3);await popup.close();
 await page.reload();await page.getByRole('button',{name:'Share ride',exact:true}).click();await page.getByRole('button',{name:'Find ride partners',exact:true}).click();await expect(page.getByText(/OneMap road durations checked where available/)).toBeVisible();await expect(page.getByPlaceholder('Enter fare',{exact:true})).toHaveValue('10.01');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);
 console.log('PASS (fixtures): four passengers, all 24 orders checkable, individual detours, three Maps waypoints, exact cents, persisted fare, phone layout.');
}finally{await browser.close();}

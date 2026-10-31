import { chromium } from 'playwright';
import { expect } from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
 const context=await browser.newContext({viewport:{width:390,height:844}});
 await context.addInitScript(()=>localStorage.setItem('bojio.quick-commute.v1',JSON.stringify({from:{label:'Fixture venue',latitude:1.31,longitude:103.8},to:{label:'Fixture home',latitude:1.32,longitude:103.85}})));
 let calls=0,lta=0,limits=0,disrupted=false;
 await context.route('**/functions/v1/onemap',r=>{calls++;const b=r.request().postDataJSON();const at=Date.parse(b.departureAt),stop=at+1800000;return r.fulfill({json:{results:b.trips.map(t=>({id:t.id,status:'available',route:{source:'onemap',checkedAt:new Date().toISOString(),startAt:new Date(at).toISOString(),endAt:new Date(stop).toISOString(),durationSeconds:1800,steps:[{mode:'BUS',boardingStopCode:'83139',serviceNo:'15',instruction:'Bus 15',from:'Fixture stop',to:'Fixture MRT',startAt:new Date(at).toISOString(),endAt:new Date(at+900000).toISOString(),durationSeconds:900},{mode:'RAIL',instruction:'MRT fixture',from:'Fixture MRT',to:'Fixture home',startAt:new Date(at+900000).toISOString(),endAt:new Date(stop).toISOString(),durationSeconds:900}]}}))}});});
 await context.route('**/functions/v1/lta',r=>{if(r.request().postDataJSON().action==='service-limits'){limits++;return r.fulfill({json:{checkedAt:new Date().toISOString(),serviceDay:'2026-09-16',alerts:{status:disrupted?'disruption':'normal-or-minor-delays'},notice:'Fixture only',limits:[{index:0,status:'available',lastAt:new Date(Date.now()+48*3600000).toISOString(),arrivalAt:new Date(Date.now()+50*3600000).toISOString()},{index:1,status:'available',lastAt:new Date(Date.now()+49*3600000).toISOString(),arrivalAt:new Date(Date.now()+51*3600000).toISOString()}]}});}lta++;return r.fulfill({json:{checkedAt:new Date().toISOString(),services:[{service:'15',arrivals:[{at:new Date(Date.now()+300000).toISOString(),basis:'vehicle-location'}]}]}});});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.BOJIO_PREVIEW_URL||'http://127.0.0.1:8082/');
 await page.getByRole('button',{name:'Last Call',exact:true}).click();
 await expect(page.getByText('Latest connected journeys found',{exact:true})).toBeVisible();
 await expect(page.getByText(/Group leave-by/)).toBeVisible({timeout:15000});
 await expect(page.getByText(/live estimate/)).toBeVisible();
 await expect(page.getByText(/not a guarantee of the absolute last service/)).toBeVisible();
 assert.equal(await page.getByRole('textbox').count(),2,'only origin and home pickers; no departure input');
 assert.equal(lta,1);assert.ok(calls<=9);await expect(page.getByText(/Estimated too late for the last scheduled onward/)).toBeVisible();assert.equal(limits,1);disrupted=true;await page.getByRole('button',{name:'Refresh last-service schedules',exact:true}).click();await expect(page.getByText(/Countdown paused; check operator advice/)).toBeVisible();await expect(page.getByText(/Group leave-by/)).toHaveCount(0);disrupted=false;await page.getByRole('button',{name:'Refresh last-service schedules',exact:true}).click();await expect(page.getByText(/Group leave-by/)).toBeVisible();
 await page.getByRole('button',{name:'Late route for You',exact:false}).click();
 await expect(page.getByText(/2\. MRT fixture/)).toBeVisible();
 await context.route('**/functions/v1/onemap',r=>r.fulfill({status:503,json:{error:'Fixture provider timeout'}}));
 await page.getByRole('button',{name:'Refresh latest connected journeys',exact:true}).click();
 await expect(page.getByText('Fixture provider timeout',{exact:true})).toBeVisible();
 await expect(page.getByText(/Group leave-by/)).toHaveCount(0);
 assert.deepEqual(errors,[]);console.log('PASS phone Last Call: automatic late chain, no time picker, first bus ETA, bounded calls, failure suppresses countdown. Fixture providers only.');
}finally{await browser.close();}

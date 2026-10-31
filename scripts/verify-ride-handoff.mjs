import {chromium} from 'playwright';
import {expect} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:360,height:800}});
 await page.addInitScript(()=>{
  const venue={id:'test',source:'onemap',name:'Pickup',address:'Pickup address',latitude:1.3,longitude:103.8,area:'Singapore',nearestStation:'',detail:'',openUntil:'',tags:[],point:{x:103.8,y:1.3}};
  const participants=['Alice','Ben','Cai'].map((name,i)=>({id:String(i),name,origin:name,transportMode:'ride',location:{label:name+' home',latitude:1.31+i*.01,longitude:103.81}}));
  localStorage.setItem('bojio.plan-draft.v1',JSON.stringify({code:'ABF234',participants,chosenVenueId:venue.id,chosenVenue:venue}));
  window.__links=[];window.open=url=>{window.__links.push(String(url));return null;};
  window.__copied=[];Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>window.__copied.push(text)},configurable:true});
 });
 await page.route('**/functions/v1/**',r=>{const b=r.request().postDataJSON();return r.fulfill({json:b.action==='drive'?{legs:b.trips.map(t=>({id:t.id,seconds:300}))}:{results:[],locations:[]}});});
 await page.goto(process.env.BOJIO_PREVIEW_URL||'http://127.0.0.1:8082/');
 await page.getByRole('button',{name:'Share ride',exact:true}).click();
 await page.getByRole('button',{name:'Find ride partners',exact:true}).click();
 await expect(page.getByRole('button',{name:'Find ride partners',exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'Open Grab ↗',exact:true}).click();
 await expect(page.getByText(/Add the stops in between in Grab/)).toBeVisible();
 await page.getByRole('button',{name:'Continue to Grab ↗',exact:true}).click();
 let links=await page.evaluate(()=>window.__links);assert.ok(links.some(u=>u.startsWith('grab://open?')&&u.includes('pickUpLatitude=1.3')));
 await page.getByRole('button',{name:'Open Gojek ↗',exact:true}).click();await expect(page.getByText(/Copy these stops into Gojek/)).toBeVisible();
 await page.getByRole('button',{name:'Copy pickup & open Gojek ↗',exact:true}).click();assert.equal((await page.evaluate(()=>window.__copied)).at(-1),'Pickup address');
 await page.getByRole('button',{name:'Copy stop 1',exact:true}).click();assert.equal((await page.evaluate(()=>window.__copied)).at(-1),'Alice home');
 await page.getByRole('button',{name:'All stops in Google Maps ↗',exact:true}).click();links=await page.evaluate(()=>window.__links);assert.ok(links.includes('gojek://'));const maps=new URL(links.find(u=>u.startsWith('https://www.google.com/maps/dir/')));assert.equal(maps.searchParams.get('waypoints').split('|').length,2);
 await page.getByRole('button',{name:'Close ride options',exact:true}).click();
 await page.getByLabel('Fare for Alice and Ben and Cai').fill('24.01');
 await expect(page.getByText('S$8.01',{exact:true})).toBeVisible();await expect(page.getByText('S$8.00',{exact:true})).toHaveCount(2);
 await expect(page.getByText(/shortlisted|Experimental:|no compatible pair confirmed/)).toHaveCount(0);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:process.env.TEMP+'/bojio-share-ride-clean.png',fullPage:true});
 console.log('PASS phone-sized handoff buttons, warnings and ordered Maps link. App launch intercepted; NOT a physical Grab/Gojek test.');
}finally{await browser.close();}

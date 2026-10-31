import {chromium} from 'playwright';
import {expect} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:360,height:800}});
 const participants=[{id:'me',name:'Host',origin:'Location not set',transportMode:'either'}];
 await page.addInitScript(people=>localStorage.setItem('bojio.plan-draft.v1',JSON.stringify({code:'ABC234',participants:people,remote:{role:'host',hostToken:'test-only',participantId:'me',published:true}})),participants);
 let resolveSwipe;const gate=new Promise(resolve=>{resolveSwipe=resolve;});let pending=false;
 const venue={id:'test-place',source:'onemap',name:'Actual rated venue',latitude:1.3,longitude:103.8,point:{x:103.8,y:1.3},area:'Singapore',tags:[],detail:'',openUntil:'',nearestStation:''};
 await page.route('**/rest/v1/rpc/**',async r=>{
  const name=r.request().url().split('/').at(-1);
  if(name==='get_swipe_state'){pending=true;await gate;return r.fulfill({json:{venues:[venue],voters:['host'],swipes:[{venueId:venue.id,voterId:'host',choice:'like'}]}});}
  return r.fulfill({json:name==='get_plan'?{code:'ABC234',participants,status:'planning',revision:1}:name==='get_bill'?{exists:false}:[]});
 });
 await page.route('**/functions/v1/**',r=>r.fulfill({json:{places:[],results:[]}}));
 await page.goto(process.env.BOJIO_PREVIEW_URL||'http://127.0.0.1:8082/');await page.getByRole('button',{name:'Close party options'}).click();await page.getByRole('button',{name:'Meet',exact:true}).click();
 await expect.poll(()=>pending).toBe(true);
 await expect(page.getByLabel('Or type a location')).toBeVisible();
 await expect(page.getByText('Loading saved swipes…')).toHaveCount(0);await expect(page.getByText('Your next favourite?')).toHaveCount(0);await expect(page.getByRole('button',{name:'Open Top 3',exact:true})).toHaveCount(0);
 resolveSwipe();await expect(page.getByRole('button',{name:'Top 1: Actual rated venue, 1 likes',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:/Top [23]:/})).toHaveCount(0);
 await expect(page).toHaveURL(/#meet$/);
 const before=await page.evaluate(()=>history.length);await page.getByRole('button',{name:'Meet',exact:true}).click();assert.equal(await page.evaluate(()=>history.length),before);
 await page.getByRole('button',{name:'Split',exact:true}).click();await expect(page).toHaveURL(/#split$/);
 await page.getByRole('button',{name:'Last call',exact:true}).click();await expect(page).toHaveURL(/#train$/);
 await page.goBack();await expect(page).toHaveURL(/#split$/);await expect(page.getByRole('dialog')).toHaveCount(0);
 await page.goBack();await expect(page).toHaveURL(/#meet$/);await expect(page.getByLabel('Or type a location')).toBeVisible();
 await page.goForward();await expect(page).toHaveURL(/#split$/);
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('bojio.plan-draft.v1')).code),'ABC234');
 console.log('PASS delayed swipe fetch has no misleading restore text or fake podium, one real favourite shows one card, tab URLs, duplicate-tab suppression, Back/Forward, retained party. Backend mocked, no paid calls.');
}finally{await browser.close();}

// Deterministic UI fixtures only. Live provider checks remain in verify-preview.
import { chromium } from 'playwright';
import { expect } from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext({viewport:{width:390,height:844}});
const base=process.env.BOJIO_PREVIEW_URL || 'http://127.0.0.1:8081/';
const calls=[]; const errors=[];
await context.route('**/functions/v1/google-places',route=>route.fulfill({json:{places:[],checkedAt:new Date().toISOString()}}));
await context.route('**/functions/v1/onemap',async(route)=>{
  const body=route.request().postDataJSON();
  if(body.action==='search')return route.fulfill({json:{locations:[{label:`Test ${body.query}`,latitude:1.31,longitude:body.query==='Home B'?103.88:103.78}]}});
  // Meet now checks venue travel automatically too; track only homebound requests here.
  if(body.trips.every((trip)=>trip.to.label.startsWith('Test Home')))calls.push(body);
  const start=new Date(Date.now()+3600000).toISOString(),end=new Date(Date.now()+5400000).toISOString();
  return route.fulfill({json:{results:body.trips.map((trip)=>({id:trip.id,status:'available',route:{startAt:start,endAt:end,durationSeconds:1800,source:'onemap',checkedAt:new Date().toISOString(),steps:[{mode:'RAIL',instruction:'Test train',from:'Test station A',to:'Test station B',durationSeconds:1800}]}}))}});
});
const page=await context.newPage(); page.on('pageerror',(e)=>errors.push(e.message));
const search=async(p,label,query,index=0)=>{
 await p.getByLabel(label,{exact:true}).nth(index).fill(query);
 // Locate the field's surrounding LocationPicker to avoid another search button.
 await p.getByLabel(label,{exact:true}).nth(index).press('Enter');
 await p.getByRole('button',{name:`Test ${query}`,exact:true}).click();
};
try{
 await page.goto(base); await page.getByRole('button',{name:'Last call',exact:true}).click();
 await expect(page.getByLabel('Leaving from',{exact:true})).toBeVisible();
 await expect(page.getByText(/Next: search “Leaving from” above/)).toBeVisible();
 await expect(page.getByRole('button',{name:'Check scheduled journeys',exact:true})).toHaveCount(0);
 await search(page,'Leaving from','Departure');
 await expect(page.getByText(/Next: search “Going home to” above/)).toBeVisible();
 // Setup can take minutes: "now" must be evaluated at request time, not mount.
 const later=new Date(Date.now()+120000);
 await page.clock.setFixedTime(later);
 await search(page,'Going home to','Home A');
 await expect(page.getByText(/minutes to leave · includes/)).toBeVisible();
 assert.ok(Date.parse(calls.at(-1).departureAt)>=later.getTime());
 assert.equal(await page.evaluate(()=>localStorage.getItem('bojio.plan-draft.v1')),null,'standalone must not create/overwrite a Meet plan');
 await page.reload(); await page.getByRole('button',{name:'Last call',exact:true}).click();
 await expect(page.getByText(/minutes to leave · includes/)).toBeVisible();
 const meet=await context.newPage(); meet.on('pageerror',(e)=>errors.push(e.message));
 await meet.goto(base); await meet.getByRole('button',{name:'Find our halfway supper →',exact:true}).click();
 await meet.getByRole('switch',{name:'Browse checked shortlist',exact:true}).click();
 await expect(meet.getByRole('button',{name:'Meet here',exact:true}).first()).toBeVisible();
 await meet.getByRole('button',{name:'+ Add person',exact:true}).click();
 await meet.getByLabel('Person 1 name',{exact:true}).fill('Ready friend');
 await meet.getByRole('button',{name:'+ Add person',exact:true}).click();
 await meet.getByLabel('Person 2 name',{exact:true}).fill('Missing friend');
 await meet.getByRole('button',{name:'Meet here',exact:true}).first().click();
 await expect(page.getByText('Missing friend',{exact:true})).toBeVisible();
 await expect(page.getByText('Waiting for a return destination.',{exact:true})).toHaveCount(2);
 await expect(page.getByRole('button',{name:'Add return locations in Meet →',exact:true})).toBeEnabled();
 await expect(page.getByText(/Still need a confirmed home location: Ready friend, Missing friend/)).toBeVisible();
 await page.getByRole('button',{name:'Add return locations in Meet →',exact:true}).click();
 await expect(page.getByText(/Still to finish: Ready friend, Missing friend/)).toBeVisible();
 await page.getByRole('button',{name:'Last call',exact:true}).click();
 const before=calls.length;
 await search(meet,'Starting point · also your return destination','Home A',0);
 await expect(page.getByText(/minutes to leave · includes/)).toBeVisible();
 await expect(page.getByText('Not available',{exact:true})).toBeVisible();
 await expect(page.getByText('Waiting for a return destination.',{exact:true})).toHaveCount(1);
 assert.equal(calls.at(-1).trips.length,1); assert.ok(calls.length>before);
 await search(meet,'Starting point · also your return destination','Home B',1);
 await expect(page.getByText('Show route steps +',{exact:true})).toHaveCount(2);
 await expect(page.getByText('Not available',{exact:true})).toHaveCount(0);
 assert.equal(calls.at(-1).trips.length,1,'adding one destination must retain the unchanged successful journey');
 await page.getByRole('button',{name:'Check just my journey',exact:true}).click();
 await expect(page.getByText('JUST MY JOURNEY',{exact:true})).toBeVisible();
 await expect(page.getByText('✓ Test Departure',{exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Use my Meet draft instead',exact:true}).click();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.deepEqual(errors,[]);
 console.log('PASS (fixture schedules): standalone without Meet, quick-journey refresh, visible incomplete group, immediate cross-tab draft updates, partial routes without false countdown, automatic recheck when next destination arrives.');
}finally{await browser.close();}

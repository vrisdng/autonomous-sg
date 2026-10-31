import {chromium} from 'playwright';
import {expect} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:360,height:800}});let schedules=0,routes=0;
 await page.addInitScript(()=>localStorage.setItem('bojio.quick-commute.v1',JSON.stringify({from:{label:'Supper spot',latitude:1.3,longitude:103.8},to:{label:'Home',latitude:1.35,longitude:103.9}})));
 const now=Date.now(),start=new Date(now+3600000).toISOString(),end=new Date(now+4800000).toISOString();
 await page.route('**/functions/v1/{onemap,google-transit}',r=>{routes++;const body=r.request().postDataJSON();return r.fulfill({json:{results:body.trips.map(t=>({id:t.id,status:'available',route:{source:'google',checkedAt:new Date().toISOString(),startAt:start,endAt:end,durationSeconds:1200,steps:[{mode:'BUS',instruction:'Bus 123',from:'Supper stop',to:'Home stop',startAt:start,endAt:end,durationSeconds:1200}]}}))}});});
 await page.route('**/functions/v1/lta',async r=>{schedules++;await new Promise(resolve=>setTimeout(resolve,200));return r.fulfill({json:{checkedAt:new Date().toISOString(),serviceDay:'fixture',limits:[{index:0,status:'available',lastAt:new Date(now+5000000).toISOString()}],alerts:{status:'normal-or-minor-delays'},notice:''}});});
 await page.goto(process.env.BOJIO_PREVIEW_URL||'http://127.0.0.1:8082/');await page.getByRole('button',{name:'Last call',exact:true}).click();
 const card=page.getByRole('button',{name:'Journey for You',exact:true});await expect(card).toHaveAttribute('aria-expanded','false');
 await expect(card).toContainText('45 min',{timeout:15000});assert.ok(schedules>0,'collapsed cards still validate schedules');
 const countdown=page.getByLabel('Group leave-by countdown');await expect(countdown).toBeVisible();await expect(countdown).toHaveText(/^\d{2}:\d{2}:\d{2}$/);
 const tick=await countdown.textContent(),requests=routes;await expect.poll(()=>countdown.textContent()).not.toBe(tick);assert.equal(routes,requests,'second ticks must not request routes');
 const before=routes;await card.click();await expect(page.getByText('Bus 123',{exact:true}).first()).toBeVisible();await expect(page.getByRole('button',{name:'Open Google Maps ↗',exact:true})).toBeVisible();
 await page.screenshot({path:process.env.TEMP+'/bojio-lastcall-expanded.png'});await card.click();await expect(card).toHaveAttribute('aria-expanded','false');assert.equal(routes,before,'expansion must not refetch routes');
 await page.screenshot({path:process.env.TEMP+'/bojio-lastcall-collapsed.png'});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 console.log('PASS compact phone card: countdown while collapsed, expand/collapse timeline, background validation, no route refetch on opening. Mocked transport only.');
}finally{await browser.close();}

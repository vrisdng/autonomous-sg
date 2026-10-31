import {chromium} from 'playwright';
import {expect} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:360,height:800}});
 await page.addInitScript(()=>{if(localStorage.getItem('swipe-test'))return;localStorage.setItem('swipe-test','1');for(const code of ['ABC234','DEF234']){const p={code,participants:[{id:'a',name:'Test person',origin:''}],remote:{role:'host',hostToken:'test-only',published:false}};localStorage.setItem('bojio.party-draft:'+code,JSON.stringify(p));localStorage.setItem('bojio.plan-access:'+code,JSON.stringify(p.remote));}});
 await page.route('**/rest/v1/**',r=>r.abort());await page.route('**/functions/v1/**',r=>r.abort());
 await page.goto(process.env.BOJIO_PREVIEW_URL||'http://127.0.0.1:8082/');
 const label=page.getByText('ABC234 · Hosting',{exact:true});await label.scrollIntoViewIfNeeded();
 const box=await label.boundingBox(),dots=page.getByRole('button',{name:'Show delete option for ABC234'}),dotsBefore=await dots.boundingBox();
 await page.mouse.move(box.x+190,box.y+8);await page.mouse.down();await page.mouse.move(box.x+130,box.y+9,{steps:8});
 await expect.poll(async()=>dotsBefore.x-(await dots.boundingBox()).x).toBeGreaterThan(10);
 const movingLabel=await label.boundingBox(),movingDots=await dots.boundingBox();assert.ok(Math.abs((movingDots.x-dotsBefore.x)-(movingLabel.x-box.x))<2,'dots must track the card during the drag, before release');
 await page.mouse.move(box.x+65,box.y+10,{steps:8});await page.mouse.up();
 await expect(page.getByRole('button',{name:'Remove party ABC234 from list'})).toBeVisible();await page.screenshot({path:process.env.TEMP+'/bojio-party-delete.png',animations:'disabled'});await page.getByRole('button',{name:'Remove party ABC234 from list'}).click();
 await expect(page.getByRole('button',{name:'Open party ABC234',exact:true})).toHaveCount(0);
 assert.ok(await page.evaluate(()=>JSON.parse(localStorage.getItem('bojio.plan-access:ABC234')).hostToken==='test-only'));
 await page.getByRole('button',{name:'Undo removal'}).click();await expect(page.getByRole('button',{name:'Open party ABC234',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Show delete option for ABC234'}).click();await page.getByRole('button',{name:'Remove party ABC234 from list'}).click();await page.reload();
 await expect(page.getByRole('button',{name:'Open party DEF234',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Open party ABC234',exact:true})).toHaveCount(0);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 console.log('PASS swipe reveal, delete from list, undo, reload persistence, host-capability retention, keyboard-accessible reveal, phone width. No backend writes.');
}finally{await browser.close();}

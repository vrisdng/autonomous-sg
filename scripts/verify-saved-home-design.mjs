import {chromium} from 'playwright';
import {expect} from '@playwright/test';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const server=createServer(async(req,res)=>{try{const path=new URL(req.url,'http://localhost').pathname;const file=resolve('dist','.'+(path==='/'?'/index.html':path));res.setHeader('Content-Type',extname(file)==='.js'?'text/javascript':'text/html');res.end(await readFile(file));}catch{res.end(await readFile('dist/index.html'));}});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const base=process.env.BOJIO_PREVIEW_URL||`http://127.0.0.1:${server.address().port}/`;
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:390,height:844}});
let code='ABC234',name='Alice',location;let writes=0;
const home={label:'Test home address',latitude:1.33,longitude:103.85};
const people=()=>[{id:'me',name,origin:location?.label??'Location not set',location,transportMode:'either'}];
const draft=()=>({code,participants:people(),remote:{role:'guest',participantId:'me',guestToken:'test-only',published:true}});
const enter=async()=>{await page.getByRole('button',{name:'Close party options'}).click();await page.getByRole('button',{name:'Meet',exact:true}).click();};
const screenshot=async(label)=>{await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:process.env.TEMP+`/bojio-design-${label}.png`,fullPage:false});};
try{
 await page.route('**/rest/v1/rpc/**',r=>{const method=r.request().url().split('/').at(-1);if(method==='save_guest_outing'){writes++;location=r.request().postDataJSON().p_location;return r.fulfill({json:{code,participants:people(),participant_id:'me',revision:2,status:'planning'}});}return r.fulfill({json:method==='get_plan'?{code,participants:people(),revision:1,status:'planning'}:method==='get_swipe_state'?{venues:[],voters:[],swipes:[]}:method==='get_bill'?{exists:false}:[]});});
 await page.route('**/functions/v1/**',r=>r.fulfill({json:{locations:[home],places:[],results:[]}}));
 await page.goto(base);await screenshot('entry');
 await page.evaluate(value=>localStorage.setItem('bojio.plan-draft.v1',JSON.stringify(value)),draft());await page.reload();await enter();
 await page.getByLabel('Home address',{exact:true}).fill('Test home');await page.getByRole('button',{name:home.label,exact:true}).click();await expect(page.getByText('Home address shared ✓')).toBeVisible();
 await expect(page.getByLabel('Home address',{exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Change home address'})).toBeVisible();
 await screenshot('meet');
 // A fresh party retains the personal suggestion, without silently sending it.
 code='DEF234';location=undefined;await page.evaluate(value=>localStorage.setItem('bojio.plan-draft.v1',JSON.stringify(value)),draft());await page.reload();await enter();
 await expect(page.getByRole('button',{name:'Use saved home for this party'})).toBeVisible();expect(writes).toBe(1);
 await page.getByRole('button',{name:'Use saved home for this party'}).click();await expect(page.getByText('Home address shared ✓')).toBeVisible();expect(writes).toBe(2);
 await page.getByRole('button',{name:'Change home address'}).click();await expect(page.getByLabel('Home address',{exact:true})).toBeVisible();await page.getByText('Forget saved home on this browser',{exact:true}).click();
 code='GHJ234';location=undefined;await page.evaluate(value=>localStorage.setItem('bojio.plan-draft.v1',JSON.stringify(value)),draft());await page.reload();await enter();await expect(page.getByLabel('Home address',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Use saved home for this party'})).toHaveCount(0);
 for(const [tab,label] of [['Home','home'],['Split','split'],['Last call','train'],['Share ride','ride']]){await page.getByRole('button',{name:tab,exact:true}).click();await page.waitForTimeout(600);await screenshot(label);}
 console.log('PASS phone layouts, saved home across parties, explicit reuse, change, forget surviving refresh. All backend/provider requests mocked.');
}finally{await browser.close();server.close();}

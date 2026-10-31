import {chromium} from 'playwright';
import {expect} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge',headless:true});
const base=process.env.BOJIO_PREVIEW_URL||'http://127.0.0.1:8082/';
const api=process.env.EXPO_PUBLIC_SUPABASE_URL,key=process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const created=[];
const rpc=async(name,body)=>{const response=await fetch(api+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await response.json();if(!response.ok)throw Error(data.message||String(response.status));return data;};
const snapshot=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('bojio.plan-draft.v1')));
const invite=code=>base.startsWith('https:')?base.replace(/\/$/,'')+'/plan/'+code:base+'?plan='+code;
const create=async(page,name)=>{
 await page.getByRole('button',{name:'Create a new party →',exact:true}).click();await page.getByLabel('Host name').fill(name);
 await page.getByRole('button',{name:'Create party & invite →'}).click();await expect(page.getByText('Party created. Send the link to your supper kakis!')).toBeVisible({timeout:25000});
 const party=await snapshot(page);created.push(party);return party;
};
const resume=async(page)=>{await page.getByRole('button',{name:'Continue this party →',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0,{timeout:20000});};
const select=async(page,code)=>page.getByRole('button',{name:'Open party '+code,exact:true}).click();
try{
 const contexts=await Promise.all([0,1].map(()=>browser.newContext({viewport:{width:360,height:800}})));
 for(const context of contexts)await context.route('**/functions/v1/**',r=>r.fulfill({status:503,json:{error:'Provider calls disabled in party-only test'}}));
 const [host,guest]=await Promise.all(contexts.map(c=>c.newPage()));
 await host.goto(base);const first=await create(host,'First host');await resume(host);
 await host.goto(invite(first.code));await expect(host.getByText('Continue or start fresh?',{exact:true})).toBeVisible({timeout:20000});
 const second=await create(host,'Second host');assert.notEqual(second.code,first.code);assert.deepEqual(second.participants.map(p=>p.name),['Second host']);assert.ok(!second.chosenVenue);
 assert.equal((await rpc('get_bill',{p_code:second.code})).exists,false);
 await select(host,first.code);await resume(host);assert.equal((await snapshot(host)).code,first.code);assert.equal((await snapshot(host)).remote.role,'host');
 await host.goto(base);await expect(host.getByText('Choose your party',{exact:true})).toBeVisible();await expect(host.getByRole('button',{name:'Open party '+second.code,exact:true})).toBeVisible({timeout:20000});
 for(const party of [first,second]){
  await guest.goto(invite(party.code));await expect(guest.getByLabel('Your party name')).toBeVisible({timeout:20000});await guest.getByLabel('Your party name').fill('Guest');await guest.getByRole('button',{name:'Join party →',exact:true}).click();await expect.poll(async()=>(await snapshot(guest))?.code,{timeout:20000}).toBe(party.code);await expect(guest.getByRole('dialog')).toHaveCount(0,{timeout:20000});
 }
 const guestSecond=await snapshot(guest);
 await guest.goto(base);await expect(guest.getByRole('button',{name:'Open party '+first.code,exact:true})).toBeVisible({timeout:20000});await expect(guest.getByRole('button',{name:'Open party '+second.code,exact:true})).toBeVisible();
 await guest.screenshot({path:process.env.TEMP+'/bojio-party-chooser.png',fullPage:true,animations:'disabled'});
 await select(guest,second.code);await expect(guest.getByText(/Welcome back, Guest/)).toBeVisible();await resume(guest);assert.equal((await snapshot(guest)).remote.participantId,guestSecond.remote.participantId);
 await guest.goto(base);const third=await create(guest,'Guest becomes host');assert.equal(third.remote.role,'host');
 await select(guest,first.code);await resume(guest);assert.equal((await snapshot(guest)).remote.role,'guest');
 assert.ok(await guest.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 console.log('PASS live two-session chooser: separate fresh parties/bills, host prompt, both histories, guest-to-host creation, role/identity preserved on switching, refresh and phone width. No paid provider calls.');
}finally{
 for(const party of created)await rpc('delete_plan',{p_code:party.code,p_host_token:party.remote.hostToken});
 await browser.close();
}

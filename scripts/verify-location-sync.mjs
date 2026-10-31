import {chromium} from 'playwright';
import {expect} from '@playwright/test';
import {randomBytes} from 'node:crypto';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const server=createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://localhost').pathname;const file=resolve('dist','.'+(pathname==='/'?'/index.html':decodeURIComponent(pathname)));const data=await readFile(file);res.setHeader('Content-Type',extname(file)==='.js'?'text/javascript':extname(file)==='.html'?'text/html':'application/octet-stream');res.end(data);}catch{res.setHeader('Content-Type','text/html');res.end(await readFile('dist/index.html'));}});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const base=process.env.BOJIO_PREVIEW_URL||`http://127.0.0.1:${server.address().port}/`;
const rpc=async(name,body)=>{const response=await fetch(process.env.EXPO_PUBLIC_SUPABASE_URL+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await response.json();if(!response.ok)throw Error(data.message);return data;};
const code=Array.from(randomBytes(6),v=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[v%32]).join('');
const token=randomBytes(32).toString('hex');
const home={label:'Test home',latitude:1.33,longitude:103.85};
const venue={id:'sync-test',source:'onemap',name:'Test pickup',latitude:1.3,longitude:103.8,area:'Singapore',nearestStation:'',detail:'',openUntil:'',tags:[],point:{x:103.8,y:1.3}};
const browser=await chromium.launch({channel:'msedge',headless:true});let created=false;
try{
 await rpc('save_outing',{p_code:code,p_host_token:token,p_participants:[{id:'host',name:'Sync test host',origin:'Test home',location:home,transportMode:'ride'}],p_venue:venue,p_meetup_at:new Date().toISOString(),p_commute_at:new Date().toISOString(),p_revision:null});created=true;
 const joined=await rpc('join_party',{p_code:code,p_name:'Sync test guest',p_participant_id:null,p_guest_token:randomBytes(32).toString('hex')});
 const payload=await rpc('get_plan',{p_code:code});
 const host=await browser.newPage({viewport:{width:360,height:800}}),guest=await browser.newPage({viewport:{width:360,height:800}});
 for(const [page,isHost] of [[host,true],[guest,false]]){
  const draft={code,participants:payload.participants,syncedParticipants:payload.participants,chosenVenue:venue,chosenVenueId:venue.id,revision:payload.revision,status:'planning',pendingSync:isHost,meetupAt:new Date().toISOString(),remote:isHost?{role:'host',hostToken:token,published:true,participantId:'host'}:{role:'guest',published:true,guestToken:joined.guest_token,participantId:joined.participant_id}};
  await page.addInitScript(draft=>{if(!localStorage.getItem('bojio.plan-draft.v1'))localStorage.setItem('bojio.plan-draft.v1',JSON.stringify(draft));},draft);
  await page.route('**/functions/v1/**',r=>r.fulfill({json:{locations:[home],places:[],results:[]}}));
  await page.goto(base);await page.getByRole('button',{name:'Close party options'}).click();await page.getByRole('button',{name:'Share ride',exact:true}).click();
 }
 await expect(host.getByRole('button',{name:'Find ride partners',exact:true})).toBeDisabled();
 let fail=true;
 await guest.route('**/rpc/save_guest_outing',async route=>{if(fail)return route.abort();return route.continue();});
 await guest.getByLabel('Home address',{exact:true}).fill('Test home');await guest.getByRole('button',{name:'Test home',exact:true}).click();
 await expect(guest.getByRole('button',{name:'Retry sharing home address'})).toBeVisible();
 await guest.reload();await guest.getByRole('button',{name:'Close party options'}).click();await guest.getByRole('button',{name:'Share ride',exact:true}).click();
 await expect(guest.getByRole('button',{name:'Retry sharing home address'})).toBeVisible();fail=false;
 await guest.getByRole('button',{name:'Retry sharing home address'}).click();await expect(guest.getByText('Home address shared ✓',{exact:true})).toBeVisible({timeout:20000});
 await expect(host.getByRole('button',{name:'Find ride partners',exact:true})).toBeEnabled({timeout:25000});
 const saved=await host.evaluate(()=>JSON.parse(localStorage.getItem('bojio.plan-draft.v1')));
 expect(saved.pendingSync).toBe(true);expect(saved.chosenVenueId).toBe(venue.id);expect(saved.participants.find(p=>p.id===joined.participant_id).location).toEqual(home);
 await rpc('set_plan_status',{p_code:code,p_host_token:token,p_status:'closed'});
 await guest.reload();await guest.getByRole('button',{name:'Close party options'}).click();await guest.getByRole('button',{name:'Share ride',exact:true}).click();
 await expect.poll(()=>guest.evaluate(()=>JSON.parse(localStorage.getItem('bojio.plan-draft.v1')).status),{timeout:20000}).toBe('closed');
 await expect(guest.getByLabel('Home address',{exact:true})).toHaveCount(0);
 const retryPage=await browser.newPage(),attempts=[];
 await retryPage.route('**/rest/v1/rpc/**',route=>{const body=route.request().postDataJSON();if(route.request().url().endsWith('/save_outing')){attempts.push(body);if(attempts.length===1)return route.abort();return route.fulfill({json:{code:body.p_code,participants:body.p_participants,revision:1,status:'planning'}});}return route.fulfill({json:[]});});
 await retryPage.goto(base);await retryPage.getByRole('button',{name:'Create a new party →',exact:true}).click();await retryPage.getByLabel('Host name').fill('Retry test');await retryPage.getByRole('button',{name:'Create party & invite →'}).click();
 await expect(retryPage.getByText('Couldn’t connect. Check your internet connection and retry.')).toBeVisible();
 await retryPage.reload();await expect(retryPage.getByText('Your last creation wasn’t confirmed. Retry to recover the same party.')).toBeVisible();await retryPage.getByRole('button',{name:'Create party & invite →'}).click();await expect(retryPage.getByText('Party created. Send the link to your supper kakis!')).toBeVisible();
 expect(attempts[1].p_code).toBe(attempts[0].p_code);expect(attempts[1].p_host_token).toBe(attempts[0].p_host_token);
 console.log('PASS two independent sessions against live Supabase: guest home save, failed-save refresh/retry, host pending edits retained while ride becomes enabled, closed-plan controls. Provider search mocked; no paid calls.');
}finally{await browser.close();server.close();if(created)await rpc('delete_plan',{p_code:code,p_host_token:token});}

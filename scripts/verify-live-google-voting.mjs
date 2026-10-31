import { chromium } from 'playwright';
import { expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { randomBytes,randomInt } from 'node:crypto';
const url=process.env.EXPO_PUBLIC_SUPABASE_URL,key=process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
assert.ok(url && key);
const code=Array.from({length:6},()=> 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[randomInt(32)]).join('');
const hostToken=randomBytes(32).toString('hex'),guestToken=randomBytes(32).toString('hex');
const location={label:'Clementi MRT',latitude:1.315,longitude:103.765};
async function rpc(name,body){const response=await fetch(`${url}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});const data=await response.json();if(!response.ok)throw new Error(data.message);return data;}
let created=false,browser;
try {
 await rpc('save_outing',{p_code:code,p_host_token:hostToken,p_participants:[{id:'host-person',name:'Vote test host',origin:location.label,location}],p_venue:null,p_meetup_at:new Date(Date.now()+3600000).toISOString(),p_commute_at:new Date(Date.now()+7200000).toISOString(),p_revision:null});created=true;
 const joined=await rpc('save_guest_outing',{p_code:code,p_guest_token:guestToken,p_name:'Vote test guest',p_location:location,p_mode:'either'});
 browser=await chromium.launch({channel:'msedge',headless:true});
 const pages=[];
 for(const role of ['host','guest']){
  const context=await browser.newContext({viewport:{width:390,height:844}});
  const draft={code,meetupAt:joined.meetup_at,commuteAt:joined.commute_at,participants:joined.participants,revision:joined.revision,status:'planning',remote:{role,published:true,...(role==='host'?{hostToken}:{guestToken,participantId:joined.participant_id})}};
  await context.addInitScript(draft=>{if(!localStorage.getItem('bojio.plan-draft.v1'))localStorage.setItem('bojio.plan-draft.v1',JSON.stringify(draft));},draft);
  // This test exercises real Supabase voting, not transport; avoid unrelated routing quota.
  await context.route('**/functions/v1/onemap',route=>route.fulfill({json:{results:[]}}));
  await context.route('**/functions/v1/google-places',route=>{const body=route.request().postDataJSON();const places=Array.from({length:4},(_,i)=>({id:'fixture'+i,displayName:{text:'Fixture restaurant '+i},formattedAddress:'Fixture address',location:{latitude:1.31+i/1000,longitude:103.8},regularOpeningHours:{periods:[{open:{day:0,hour:0}}]},businessStatus:'OPERATIONAL'}));return route.fulfill({json:{places,place:places.find(p=>p.id===body.placeId),checkedAt:new Date().toISOString()}});});
  const page=await context.newPage();await page.goto(process.env.BOJIO_PREVIEW_URL || 'http://127.0.0.1:8081/');await page.getByRole('button',{name:'Meet',exact:true}).click();pages.push(page);
 }
 const [host,guest]=pages;
 await guest.getByRole('button',{name:'Vote for this place',exact:true}).first().click();
 await expect(guest.getByText('✓ YOUR VOTE · 1 vote',{exact:true})).toBeVisible();
 await host.getByRole('button',{name:'Vote for this place',exact:true}).first().click();
 await expect(host.getByText('✓ YOUR VOTE · 2 votes',{exact:true})).toBeVisible();
 await expect(guest.getByText('✓ YOUR VOTE · 2 votes',{exact:true})).toBeVisible({timeout:20000});
 await host.getByRole('button',{name:'Confirm meetup here',exact:true}).first().click();
 await host.getByRole('button',{name:'Save shared plan',exact:true}).click();
 await expect(host.getByText('Shared plan is up to date.',{exact:true})).toBeVisible();
 const saved=await rpc('get_plan',{p_code:code});
 assert.deepEqual(saved.chosen_venue,{source:'google_places',providerPlaceId:'fixture0'});
 await expect(guest.getByRole('button',{name:'Confirm meetup here',exact:true})).toHaveCount(0);
 await guest.reload();await guest.getByRole('button',{name:'Meet',exact:true}).click();
 await expect(guest.getByText('✓ YOUR VOTE · 2 votes',{exact:true})).toBeVisible();
 await guest.getByRole('button',{name:'Vote for this place',exact:true}).first().click();
 await expect(guest.getByText('✓ YOUR VOTE · 1 vote',{exact:true})).toBeVisible();
 let votes=await rpc('get_venue_votes',{p_code:code});assert.equal(votes.length,2);assert.notEqual(votes[0].venue.providerPlaceId,votes[1].venue.providerPlaceId);
 await guest.getByRole('button',{name:'✓ Voted · tap to remove',exact:true}).click();
 await expect(guest.getByText(/^✓ YOUR VOTE ·/)).toHaveCount(0);
 await expect(guest.getByRole('button',{name:'Saving vote…',exact:true})).toHaveCount(0);
 votes=await rpc('get_venue_votes',{p_code:code});assert.equal(votes.length,1);assert.equal(votes[0].voterId,'host');
 assert.deepEqual((await rpc('get_plan',{p_code:code})).chosen_venue,{source:'google_places',providerPlaceId:'fixture0'});
 await assert.rejects(rpc('set_venue_vote',{p_code:code,p_token:'x'.repeat(64),p_venue:null}),/Save your entry/);
 const table=await fetch(`${url}/rest/v1/venue_votes?select=*`,{headers:{apikey:key}});assert.ok([401,403].includes(table.status));
 await rpc('set_plan_status',{p_code:code,p_host_token:hostToken,p_status:'closed'});
 await assert.rejects(rpc('set_venue_vote',{p_code:code,p_token:guestToken,p_venue:null}),/closed/);
 console.log('PASS LIVE: independent host/guest sessions, polling counts, ticks after reload, moving/removing votes, invalid capability rejected, direct-table denial, closed plan, Google ID-only confirmed venue preserved. Provider responses are fixtures; Supabase writes are real.');
} finally {await browser?.close();if(created){await rpc('delete_plan',{p_code:code,p_host_token:hostToken});console.log('Removed only this run’s temporary test plan and votes.');}}

// Two independent browser sessions with a controlled RPC fixture.
import { chromium } from 'playwright';
import { expect } from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge',headless:true});
const base=process.env.BOJIO_PREVIEW_URL || 'http://127.0.0.1:8081/';
let votes=[];
let failVote=false;
const people=[{id:'a',name:'Host',origin:'Missing'},{id:'b',name:'Guest',origin:'Missing'}];
try {
 const sessions=[];
 for(const role of ['host','guest']) {
  const context=await browser.newContext({viewport:{width:390,height:844}});
  await context.addInitScript(({role,people})=>{
   if(!localStorage.getItem('bojio.plan-draft.v1'))localStorage.setItem('bojio.plan-draft.v1',JSON.stringify({code:'ABC234',participants:people,remote:{role,published:true,...(role==='host'?{hostToken:'h'.repeat(64)}:{guestToken:'g'.repeat(64),participantId:'b'})}}));
  },{role,people});
  await context.route('**/rest/v1/rpc/*',async route=>{
   const method=route.request().url().split('/').pop();
   const body=route.request().postDataJSON();
   if(method==='get_plan')return route.fulfill({json:{code:'ABC234',participants:people,status:'planning'}});
   if(method==='set_venue_vote') {
    if(failVote)return route.abort('internetdisconnected');
    const voterId=body.p_token==='h'.repeat(64)?'host':'guest:b';
    votes=votes.filter(v=>v.voterId!==voterId);
    if(body.p_venue)votes.push({voterId,venue:body.p_venue});
   }
   return route.fulfill({json:votes});
  });
  const page=await context.newPage();await page.goto(base);await page.getByRole('button',{name:'Meet',exact:true}).click();
  sessions.push({context,page});
 }
 const [{page:host},{page:guest,context:guestContext}]=sessions;
 await guest.getByRole('button',{name:'Vote for this place',exact:true}).first().click();
 await expect(guest.getByText('✓ YOUR VOTE · 1 vote',{exact:true})).toBeVisible();
 await expect(guest.getByRole('button',{name:'Confirm meetup here',exact:true})).toHaveCount(0);
 await host.getByRole('button',{name:'Vote for this place',exact:true}).first().click();
 await expect(host.getByText('✓ YOUR VOTE · 2 votes',{exact:true})).toBeVisible();
 await guest.reload();await guest.getByRole('button',{name:'Meet',exact:true}).click();
 await expect(guest.getByText('✓ YOUR VOTE · 2 votes',{exact:true})).toBeVisible();
 await guest.getByRole('button',{name:'Vote for this place',exact:true}).first().click();
 await expect(guest.getByText('✓ YOUR VOTE · 1 vote',{exact:true})).toBeVisible();
 assert.equal(votes.length,2);assert.notEqual(votes[0].venue.id,votes[1].venue.id);
 await guestContext.setOffline(true);
 failVote=true;
 await guest.getByRole('button',{name:'✓ Voted · tap to remove',exact:true}).click();
 await expect(guest.getByText(/Vote not confirmed/)).toBeVisible();
 await expect(guest.getByRole('button',{name:'✓ Voted · tap to remove',exact:true})).toHaveCount(1);
 await guestContext.setOffline(false);
 failVote=false;
 await guest.getByRole('button',{name:'✓ Voted · tap to remove',exact:true}).click();
 await expect(guest.getByText(/^✓ YOUR VOTE ·/)).toHaveCount(0);
 await expect(guest.getByRole('button',{name:'Saving vote…',exact:true})).toHaveCount(0);
 assert.equal(votes.length,1);assert.equal(votes[0].voterId,'host');
 assert.equal(await guest.evaluate(()=>JSON.parse(localStorage.getItem('bojio.plan-draft.v1')).chosenVenue),undefined);
 assert.equal(await guest.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 console.log('PASS (fixture RPC): host/guest votes, shared counts, moved/removed votes, tick after refresh, failed offline vote retains confirmed choice, no guest final confirmation, phone width.');
} finally {await browser.close();}

import { chromium } from 'playwright';
import { expect } from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext({viewport:{width:390,height:844}});
await context.addInitScript(()=>{
 const key='bojio.bill-draft.v2:ABC234';
 localStorage.setItem('bojio.plan-draft.v1',JSON.stringify({code:'ABC234',participants:[{id:'p',name:'Test person',origin:''}]}));
 localStorage.setItem(key,JSON.stringify({people:[{id:'p',name:'Test person'}],items:[{id:'food',name:'Saved dinner',price:'10.01',claimantIds:['p']}],servicePercent:'0',gstPercent:'0',settlements:{},revision:7,pendingSync:true}));
 const get=Storage.prototype.getItem;
 window.failBillRead=true;
 window.readSavedBill=()=>get.call(localStorage,key);
 Storage.prototype.getItem=function(name){if(name===key&&window.failBillRead)throw new Error('Test storage read failure');return get.call(this,name);};
});
try{
 const p=await context.newPage(); await p.goto(process.env.BOJIO_PREVIEW_URL || 'http://127.0.0.1:8081/');
 await p.getByRole('button',{name:'Split',exact:true}).click();
 await expect(p.getByRole('button',{name:'Retry loading bill',exact:true})).toBeVisible();
 assert.equal(await p.getByPlaceholder('Item name',{exact:true}).count(),0);
 assert.equal(await p.evaluate(()=>JSON.parse(window.readSavedBill()).items[0].name),'Saved dinner');
 await p.evaluate(()=>{window.failBillRead=false;});
 await p.getByRole('button',{name:'Retry loading bill',exact:true}).click();
 await expect(p.getByPlaceholder('Item name',{exact:true})).toHaveValue('Saved dinner');
 await p.getByText('Clear bill items',{exact:true}).click();
 await expect.poll(()=>p.evaluate(()=>JSON.parse(window.readSavedBill()).items.length)).toBe(0);
 const saved=await p.evaluate(()=>JSON.parse(window.readSavedBill()));
 assert.equal(saved.pendingSync,true);assert.equal(saved.revision,7);assert.equal(saved.people.length,1);
 console.log('PASS (storage fixtures): load failure cannot overwrite saved bill; retry restores it; clearing retains people, server revision and unsynced marker.');
}finally{await browser.close();}

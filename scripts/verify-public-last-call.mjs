import { chromium } from 'playwright';
import { expect } from '@playwright/test';
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const context=await browser.newContext({viewport:{width:390,height:844}});
 await context.addInitScript(()=>localStorage.setItem('bojio.quick-commute.v1',JSON.stringify({from:{label:'Orchard MRT',latitude:1.3043,longitude:103.8322},to:{label:'Tampines MRT',latitude:1.3545,longitude:103.9452}})));
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('https://bojio.pages.dev/');await page.getByRole('button',{name:'Last call',exact:true}).click();
 await expect(page.getByText('Latest connected journeys found',{exact:true})).toBeVisible();
 await expect(page.getByText(/scheduled checks · OneMap/)).toBeVisible({timeout:120000});
 await expect(page.getByText(/LTA DataMall · checked.*service day/)).toBeVisible({timeout:70000});
 // Allow the bounded earlier-journey repair to finish if the two providers disagree.
 try{await expect(page.getByText(/Group leave-by/)).toBeVisible({timeout:60000});}catch{/* Report a paused countdown honestly below. */}
 const text=await page.locator('body').innerText();
 console.log(JSON.stringify({livePublic:true,hasLateJourney:text.includes('Latest found: depart'),hasFirstBoarding:text.includes('BOARD FIRST'),hasGroupCountdown:text.includes('Group leave-by'),hasLastService:text.includes('Last scheduled train:')||text.includes('Last scheduled bus:'),providerMessages:text.split('\n').filter(s=>/No countdown|Not checked|timed out|limit reached|No connected late|checks failed|No complete future/.test(s)),pageErrors:errors}));
 await page.getByText('Last scheduled services · separate from your countdown',{exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:process.env.TEMP+'/bojio-last-call-public.png'});
 if(errors.length)throw new Error('Public UI errors');
}finally{await browser.close();}

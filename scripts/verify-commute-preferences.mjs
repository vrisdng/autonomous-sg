import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser=await chromium.launch({channel:'msedge',headless:true});
try {
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.text().includes('useNativeDriver'))errors.push(message.text());});
  await page.goto('http://localhost:8081/');
  await page.evaluate(()=>{
    localStorage.setItem('bojio.plan-draft.v1',JSON.stringify({code:'ABC234',participants:[{id:'ada',name:'Ada',origin:'Home not set',transportMode:'ride'}],remote:{role:'guest',participantId:'ada',published:false}}));
    localStorage.setItem('bojio.commute-mode:ABC234:ada','solo');
  });
  await page.goto('http://localhost:8081/#train');
  await page.getByText('Time to zao.',{exact:true}).waitFor();
  assert.equal(await page.getByRole('radio',{name:'Group',exact:true}).count(),0);
  assert.equal(await page.getByRole('radio',{name:'Just me',exact:true}).count(),0);
  assert.equal(await page.getByText('Just me',{exact:true}).count(),0);
  await page.getByText('FROM',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Change location',exact:true}).waitFor();
  await page.getByRole('button',{name:'Change people',exact:true}).waitFor();
  assert.equal(await page.getByText(/Quick journey only/).count(),0);
  assert.ok(await page.getByText(/1 in this group/).count());
  assert.ok(await page.getByText(/Add a home location/).count());
  assert.equal(await page.getByText(/before checking the latest safe time/).count(), 0);
  assert.equal(await page.getByText(/Home needed:/).count(), 0);
  await page.reload();
  await page.getByText('FROM',{exact:true}).waitFor();
  assert.equal(await page.getByRole('radio',{name:'Just me',exact:true}).count(),0);
  assert.match(page.url(),/#train$/);
  await page.getByRole('button',{name:'Change people',exact:true}).click();
  await page.getByText(/Ada · Add home location/).waitFor();
  await page.goto('http://localhost:8081/#home');
  await page.getByRole('button',{name:'Say hello to Bao'}).click();
  await page.getByText('Bao jio! ♡',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.deepEqual(errors,[]);
  console.log('PASS: Last Call opens in group with no Group/Just me toggle, a saved solo preference is ignored, ride participant retains own card, missing-home guidance, Bao greeting, mobile width and console.');
} finally {await browser.close();}

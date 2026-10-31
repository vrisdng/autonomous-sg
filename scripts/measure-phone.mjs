import { chromium } from 'playwright';
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const samples=[];
 for(let attempt=0;attempt<3;attempt++){
  const context=await browser.newContext({viewport:{width:390,height:844}});
  const page=await context.newPage();
  await page.goto(process.env.BOJIO_PREVIEW_URL || 'https://bojio.pages.dev/',{waitUntil:'networkidle'});
  const load=await page.evaluate(()=>{
   const navigation=performance.getEntriesByType('navigation')[0];
   return {ttfbMs:Math.round(navigation.responseStart-navigation.requestStart),domReadyMs:Math.round(navigation.domContentLoadedEventEnd),firstPaintMs:Math.round(performance.getEntriesByName('first-contentful-paint')[0]?.startTime??0),scriptBytes:performance.getEntriesByType('resource').filter((r)=>r.initiatorType==='script').reduce((sum,r)=>sum+r.encodedBodySize,0),overflow:document.documentElement.scrollWidth>innerWidth};
  });
  await page.evaluate(()=>{window.measureStart=performance.now();});
  await page.getByRole('button',{name:'Last call',exact:true}).click();
  await page.getByLabel('Leaving from',{exact:true}).waitFor();
  const actionMs=await page.evaluate(()=>Math.round(performance.now()-window.measureStart));
  samples.push({...load,automatedClickToScreenMs:actionMs});
  await context.close();
 }
 console.log(JSON.stringify({url:process.env.BOJIO_PREVIEW_URL || 'https://bojio.pages.dev/',environment:'local headless Edge; unthrottled network; fresh contexts; not field Core Web Vitals',samples},null,2));
}finally{await browser.close();}

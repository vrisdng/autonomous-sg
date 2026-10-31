import { matchStop } from '../_shared/stopMatch.ts';
import { csv,busLimit,trainLimit,serviceDay,LegQuery,Row } from '../_shared/serviceSchedules.ts';
import { unzipSync, strFromU8 } from 'npm:fflate@0.8.2';
// Credentials stay in Supabase secrets. Provider bodies and signed URLs are not logged.
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
const base='https://datamall2.mytransport.sg/ltaodataservice/';
class ServiceError extends Error {constructor(message:string,public status=503){super(message);}}
async function provider(path:string,key:string){
 const response=await fetch(base+path,{headers:{AccountKey:key,Accept:'application/json'},signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw new ServiceError(response.status===401||response.status===403?`LTA access rejected (HTTP ${response.status}). Check the server key and account activation.`:response.status===429?'LTA provider quota reached. Retry later.':'LTA service unavailable.',response.status===429?429:503);
 const raw=await response.text();if(raw.length>2000000)throw new ServiceError('LTA response exceeded the safe size.');
 try{return JSON.parse(raw);}catch{throw new ServiceError('LTA returned an unreadable response.');}
}

let trainPending:Promise<Record<string,Uint8Array>>|undefined;
function trainFiles(key:string):Promise<Record<string,Uint8Array>>{
 if(trainPending)return trainPending;
 trainPending=(async()=>{   const payload=await provider('GTFSScheduleTrain',key);const link=payload.value?.[0]?.link??payload.value?.[0]?.Link;
   let address:URL;try{address=new URL(link);}catch{throw new ServiceError('Train schedule link unavailable.');}
   if(address.protocol!=='https:'||!address.hostname.endsWith('.amazonaws.com'))throw new ServiceError('Unexpected train schedule host.');
   const response=await fetch(address,{signal:AbortSignal.timeout(20000),redirect:'error'});if(!response.ok)throw new ServiceError('Train schedule download failed.');
   const reader=response.body!.getReader();const chunks:Uint8Array[]=[];let size=0;
   while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>24000000){await reader.cancel();throw new ServiceError('Train archive exceeds safe download size.');}chunks.push(value);}
   const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
   let expanded=0;const files=unzipSync(bytes,{filter:file=>{expanded+=file.originalSize;if(expanded>64000000)throw new ServiceError('Train archive exceeds safe expanded size.');return /(^|\/)(agency|routes|trips|stops|stop_times|calendar|calendar_dates|feed_info|frequencies|transfers)\.txt$/.test(file.name);}});

 return files;})().finally(()=>{trainPending=undefined;});return trainPending;
}
let busPending:Promise<Row[]>|undefined;
function busRows(key:string):Promise<Row[]>{
 if(busPending)return busPending;
 busPending=(async()=>{const rows:Row[]=[];const start=Date.now();
 for(let page=0;page<120;page+=4){
  if(Date.now()-start>50000)throw new ServiceError('Bus schedule download took too long.');
  const batches=await Promise.all([0,1,2,3].map(async n=>{const data=await provider('BusRoutes?$skip='+((page+n)*500),key);if(!Array.isArray(data.value))throw new ServiceError('Unreadable bus schedule.');return data.value;}));
  for(const batch of batches){rows.push(...batch.map((r:Record<string,unknown>)=>Object.fromEntries(Object.entries(r).map(([k,v])=>[k,String(v)]))));if(batch.length<500)return rows;}
 }throw new ServiceError('Bus schedule exceeded the bounded download.');})().finally(()=>{busPending=undefined;});return busPending;
}

let stopsPending:Promise<any[]>|undefined;
function busStops(key:string){
 if(stopsPending)return stopsPending;
 stopsPending=(async()=>{const rows:any[]=[];for(let page=0;page<14;page++){const data=await provider('BusStops?$skip='+page*500,key);if(!Array.isArray(data.value))throw new ServiceError('Bus stops unavailable.');rows.push(...data.value);if(data.value.length<500)return rows;}throw new ServiceError('Bus stop limit exceeded.');})().finally(()=>{stopsPending=undefined;});
 return stopsPending;
}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return json({error:'Method not allowed.'},405);
 try{
  const publicKey=req.headers.get('apikey'),url=Deno.env.get('SUPABASE_URL');
  if(!publicKey||publicKey.length>4096||!url)return json({error:'A valid project key is required.'},401);
  const auth=await fetch(url+'/auth/v1/settings',{headers:{apikey:publicKey},signal:AbortSignal.timeout(5000)});
  if(!auth.ok)return json({error:'Project access could not be verified.'},auth.status===401||auth.status===403?401:503);
  const body=await req.text();if(body.length>12000)return json({error:'Request too large.'},400);
  let input;try{input=JSON.parse(body);}catch{return json({error:'Invalid request.'},400);}
  const key=Deno.env.get('LTA_DATAMALL_ACCOUNT_KEY')?.trim();
  if(!key)return json({error:'LTA_DATAMALL_ACCOUNT_KEY is not configured in Edge Function secrets.'},503);

  if(input.action==='service-limits'){
   if(!Array.isArray(input.legs)||!input.legs.length||input.legs.length>10||input.legs.some((q:any)=>!q||!['BUS','RAIL','SUBWAY','TRAM'].includes(q.mode)||typeof q.from!=='string'||typeof q.to!=='string'||q.from.length>500||q.to.length>500||['boardingStopCode','alightingStopCode'].some(k=>q[k]!==undefined&&!/^\d{5}$/.test(q[k]))||(q.serviceNo!==undefined&&!/^[A-Za-z0-9]{1,8}$/.test(q.serviceNo))))return json({error:'Invalid journey legs.'},400);
   const unresolved=input.legs.some((q:any)=>q.mode==='BUS'&&(!q.boardingStopCode||!q.alightingStopCode));
   if(unresolved){const stops=await busStops(key).catch(()=>[]);input.legs=input.legs.map((q:any)=>({...q,boardingStopCode:q.boardingStopCode??matchStop(q.boardingLocation,stops),alightingStopCode:q.alightingStopCode??matchStop(q.alightingLocation,stops)}));}
   const day=serviceDay(Date.now()),hasBus=input.legs.some((q:LegQuery)=>q.mode==='BUS'),hasTrain=input.legs.some((q:LegQuery)=>q.mode!=='BUS');
   const [bus,train,alerts]=await Promise.allSettled([hasBus?busRows(key):Promise.resolve([]),hasTrain?trainFiles(key).then(files=>Object.fromEntries(Object.entries(files).map(([name,data])=>[name.split('/').pop()!,csv(strFromU8(data))]))):Promise.resolve({}),hasTrain?provider('TrainServiceAlerts',key):Promise.resolve(null)]);
   const limits=input.legs.map((q:LegQuery,index:number)=>{const data=q.mode==='BUS'?bus:train;return {index,...(data.status==='rejected'?{status:'unavailable',reason:data.reason instanceof ServiceError?data.reason.message:'Schedule provider unavailable.'}:q.mode==='BUS'?busLimit(data.value as Row[],q,day):trainLimit(data.value as Record<string,Row[]>,q,day))};});
   const live=await Promise.all(input.legs.map(async(q:any,index:number)=>{
    if(q.mode!=='BUS')return {index,status:'not-applicable'};
    const at=Date.parse(q.startAt??'');
    if(!Number.isFinite(at)||at<Date.now()-60000||at>Date.now()+30*60000)return {index,status:'outside-live-window'};
    if(!q.boardingStopCode||!q.serviceNo||bus.status!=='fulfilled'||limits[index].status!=='available')return {index,status:'unverified'};
    const rows=bus.value as Row[],dir=limits[index].direction;
    const serviceRows=rows.filter(r=>r.ServiceNo===q.serviceNo&&r.Direction===dir).sort((a,b)=>Number(a.StopSequence)-Number(b.StopSequence));
    if(serviceRows.filter(r=>r.BusStopCode===q.boardingStopCode).length!==1)return {index,status:'unverified'};
    try{
     const data=await provider('v3/BusArrival?'+new URLSearchParams({BusStopCode:q.boardingStopCode,ServiceNo:q.serviceNo}),key);
     const service=data.Services?.find((s:any)=>String(s.ServiceNo)===q.serviceNo);
     const candidates=['NextBus','NextBus2','NextBus3'].map(k=>service?.[k]).filter(b=>b&&b.Monitored===1&&String(b.DestinationCode)===serviceRows.at(-1)?.BusStopCode&&String(b.OriginCode)===serviceRows[0]?.BusStopCode&&String(b.VisitNumber)==='1'&&Number.isFinite(Date.parse(b.EstimatedArrival))&&Date.parse(b.EstimatedArrival)>=Date.now()).sort((a,b)=>Math.abs(Date.parse(a.EstimatedArrival)-at)-Math.abs(Date.parse(b.EstimatedArrival)-at));
     const candidate=candidates[0];
     if(!candidate||Math.abs(Date.parse(candidate.EstimatedArrival)-at)>5*60000)return {index,status:'unverified'};
     const next=input.legs[index+1],end=Date.parse(q.endAt??'');
     // A matched live estimate is not a tracked connection. Never extend a leave-by.
     const delay=Date.parse(candidate.EstimatedArrival)-at;
     const risk=!!next&&Number.isFinite(end)&&Date.parse(next.startAt)-end<Math.max(0,delay)+(Number.isFinite(q.transferSeconds)?Math.max(0,q.transferSeconds)*1000:0)+3*60000;
     return {index,status:'live-estimate',at:new Date(candidate.EstimatedArrival).toISOString(),connectionRisk:risk};
    }catch{return {index,status:'unavailable'};}
   }));
   const raw=alerts.status==='fulfilled'?alerts.value?.value:undefined;
   const alert=Array.isArray(raw)?raw[0]:raw;
   const status=Number(alert?.Status);
   return json({provider:'LTA DataMall',checkedAt:new Date().toISOString(),serviceDay:day,limits,live,alerts:{status:status===2?'disruption':status===1?'normal-or-minor-delays':'unknown'},notice:'Published schedules. Special hours and planned closures are not fully verified. Check operator notices.',sources:['https://datamall.lta.gov.sg/content/datamall/en/dynamic-data.html','https://www.lta.gov.sg/content/ltagov/en/map/announcement.html','https://www.sbstransit.com.sg/first-train-last-train','https://journey.smrt.com.sg/']});
  }

  if(input.action==='train-schedule-info'){
   const files=await trainFiles(key);
   return json({provider:'LTA DataMall',checkedAt:new Date().toISOString(),files:Object.entries(files).map(([name,bytes])=>{const lines=strFromU8(bytes).split(/\r?\n/).filter(Boolean);return {name,rows:Math.max(0,lines.length-1),header:lines[0],sample:lines.slice(1,4)};})});
  }
  if(input.action==='capabilities'){
   const feeds=[['busArrivals','v3/BusArrival?BusStopCode=83139'],['busRoutes','BusRoutes'],['trainSchedule','GTFSScheduleTrain'],['trainDisruptions','GTFSRealtimeTrainTripUpdates']];
   const results=[];
   for(const [name,path] of feeds){const start=Date.now();try{const data=await provider(path!,key);const rows=Array.isArray(data.value)?data.value:[];results.push({feed:name,status:'accessible',milliseconds:Date.now()-start,records:name==='busArrivals'?(Array.isArray(data.Services)?data.Services.length:0):name==='busRoutes'?rows.length:undefined,responseFields:name?.startsWith('train')?Object.keys(data).slice(0,10):undefined,recordFields:name?.startsWith('train')&&rows[0]?Object.keys(rows[0]).slice(0,10):undefined,downloadLinkAvailable:name?.startsWith('train')?rows.some((r:any)=>typeof (r.link??r.Link)==='string'&&(r.link??r.Link).startsWith('https://')):undefined});}catch(e){results.push({feed:name,status:'unavailable',message:e instanceof ServiceError?e.message:'LTA request timed out.',milliseconds:Date.now()-start});}}
   return json({provider:'LTA DataMall',checkedAt:new Date().toISOString(),feeds:results});
  }
  if(input.action==='bus-arrivals'&&!input.stopCode&&input.stopLocation){const stops=await busStops(key);input.stopCode=matchStop(input.stopLocation,stops);if(!input.stopCode)return json({error:'Bus stop match is ambiguous. Live arrivals unverified.'},422);}
  if(input.action!=='bus-arrivals'||typeof input.stopCode!=='string'||!/^\d{5}$/.test(input.stopCode)||(input.service!==undefined&&(typeof input.service!=='string'||! /^[A-Za-z0-9]{1,8}$/.test(input.service))))return json({error:'Choose a valid bus stop and service.'},400);
  const params=new URLSearchParams({BusStopCode:input.stopCode});if(input.service)params.set('ServiceNo',input.service);
  const data=await provider('v3/BusArrival?'+params,key);
  const services=(Array.isArray(data.Services)?data.Services:[]).map((s:any)=>({service:String(s.ServiceNo??''),arrivals:['NextBus','NextBus2','NextBus3'].flatMap(k=>{const b=s[k],time=Date.parse(b?.EstimatedArrival);return Number.isFinite(time)?[{at:new Date(time).toISOString(),basis:b.Monitored===1?'vehicle-location':b.Monitored===0?'schedule':'unknown',destinationCode:String(b.DestinationCode??''),visitNumber:String(b.VisitNumber??'')}]:[];})}));
  return json({provider:'LTA DataMall',checkedAt:new Date().toISOString(),stopCode:input.stopCode,services,message:services.length?undefined:'No arrivals returned. This is not confirmation that service has ended.'});
 }catch(e){return json({error:e instanceof ServiceError?e.message:'LTA request timed out or failed.'},e instanceof ServiceError?e.status:503);}
});

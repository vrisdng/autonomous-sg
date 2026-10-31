const url=process.env.EXPO_PUBLIC_SUPABASE_URL,key=process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if(!url||!key)throw new Error('Public configuration missing');
for(const departureAt of [new Date(Date.now()+600000).toISOString(),new Date(new Date(Date.now()+8*3600000).toISOString().slice(0,10)+'T23:15:00+08:00').toISOString()]){
 const started=Date.now();const r=await fetch(url+'/functions/v1/onemap',{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify({action:'transit',departureAt,trips:[{id:'public-test',from:{label:'Orchard MRT',latitude:1.3043,longitude:103.8322},to:{label:'Tampines MRT',latitude:1.3545,longitude:103.9452}}]}),signal:AbortSignal.timeout(55000)});
 const data=await r.json(),answer=data.results?.[0],route=answer?.route;
 console.log(JSON.stringify({check:'connected transit',status:r.status,durationMs:Date.now()-started,available:!!route,failure:answer?.failure??data.error,steps:route?.steps.map(s=>({mode:s.mode,hasExactBusIdentifiers:!!(s.boardingStopCode&&s.serviceNo),timed:!!(s.startAt&&s.endAt)}))}));
 if(!r.ok)throw new Error('Live transit verification failed');
}

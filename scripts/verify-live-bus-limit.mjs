const url=process.env.EXPO_PUBLIC_SUPABASE_URL,key=process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const call=async(fn,body)=>{const r=await fetch(url+'/functions/v1/'+fn,{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(70000)});const d=await r.json();if(!r.ok)throw new Error(d.error||'Provider failed');return d;};
const day=new Date(Date.now()+8*3600000).toISOString().slice(0,10);
const data=await call('onemap',{action:'transit',departureAt:day+'T23:15:00+08:00',trips:[{id:'test',from:{label:'Orchard MRT',latitude:1.3043,longitude:103.8322},to:{label:'Tampines MRT',latitude:1.3545,longitude:103.9452}}]});
const legs=data.results?.[0]?.route?.steps.filter(s=>['BUS','SUBWAY','RAIL'].includes(s.mode));if(!legs?.some(s=>s.mode==='BUS'))throw new Error('No real bus chain returned');
const start=Date.now(),limits=await call('lta',{action:'service-limits',legs});
console.log(JSON.stringify({durationMs:Date.now()-start,legs:legs.map(s=>({mode:s.mode,from:s.from,to:s.to,service:s.serviceNo,boarding:s.boardingStopCode,alighting:s.alightingStopCode})),...limits}));
if(!limits.limits.some((l,i)=>l.status==='available'&&legs[i].mode==='BUS'))throw new Error('Bus last schedule not resolved');

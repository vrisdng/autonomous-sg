// Explicit live Google calls: may be billable. Synthetic public locations only.
const base=process.env.EXPO_PUBLIC_SUPABASE_URL,key=process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const post=async(name,body)=>{const start=Date.now();const response=await fetch(base+'/functions/v1/'+name,{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(90000)});return {ms:Date.now()-start,status:response.status,data:await response.json()};};
const trips=[{id:'west',from:{latitude:1.3388,longitude:103.7058},to:{latitude:1.2966,longitude:103.7764}},{id:'east',from:{latitude:1.3349,longitude:103.9179},to:{latitude:1.3025,longitude:103.9058}}];
for(const trip of trips){const result=await post('google-transit',{action:'transit',departureAt:new Date().toISOString(),trips:[trip]});const route=result.data.results?.[0]?.route;
 console.log(JSON.stringify({id:trip.id,status:result.status,ms:result.ms,source:route?.source,modes:route?.steps.map(s=>s.mode),failure:result.data.results?.[0]?.message??result.data.error}));
 if(!route){process.exitCode=1;continue;}
 const transits=route.steps.filter(s=>['BUS','RAIL','SUBWAY','TRAM'].includes(s.mode));
 const legs=transits.map((s,i)=>({...s,transferSeconds:transits[i+1]?route.steps.slice(route.steps.indexOf(s)+1,route.steps.indexOf(transits[i+1])).reduce((n,x)=>n+x.durationSeconds,0):0}));
 const checks=await post('lta',{action:'service-limits',legs});console.log(JSON.stringify({id:trip.id,ltaMs:checks.ms,ltaStatus:checks.status,checks:checks.data}));
}

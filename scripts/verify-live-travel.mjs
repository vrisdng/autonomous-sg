// Public API key only; never print credentials, request bodies, or private locations.
const url=process.env.EXPO_PUBLIC_SUPABASE_URL;
const key=process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if(!url || !key)throw new Error('Public Supabase configuration required.');
const call=async(body)=>{
 const started=Date.now();
 const response=await fetch(`${url}/functions/v1/onemap`,{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(55000)});
 const data=await response.json();return {status:response.status,durationMs:Date.now()-started,data};
};
const locations=[];
for(const [region,query] of [['west','Clementi MRT'],['central','Dhoby Ghaut MRT'],['east','Tampines MRT']]){
 const result=await call({action:'search',query});const location=result.data.locations?.[0];
 console.log(JSON.stringify({check:'search',region,status:result.status,durationMs:result.durationMs,usable:Boolean(location && Number.isFinite(location.latitude)&&Number.isFinite(location.longitude))}));
 if(!location)throw new Error(`${region} search did not return a location`);locations.push({region,location});
}
const from={label:'Orchard MRT',latitude:1.3043,longitude:103.8322};
const trips=locations.map(({region,location})=>({id:region,from,to:location}));
for(const action of ['drive','transit']){
 const result=await call({action,trips,...(action==='transit'?{departureAt:new Date(Date.now()+30*60000).toISOString()}:{})});
 console.log(JSON.stringify({check:action,status:result.status,durationMs:result.durationMs,results:(result.data.legs??result.data.results??[]).map((item)=>({region:item.id,available:action==='drive'?Number.isFinite(item.seconds):item.status==='available'&&Boolean(item.route),failure:item.failure??null})),error:result.data.error??null}));
}

const url=process.env.EXPO_PUBLIC_SUPABASE_URL,key=process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if(!url||!key)throw new Error('Public config missing');
const start=Date.now();const response=await fetch(url+'/functions/v1/lta',{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify({action:'service-limits',legs:[{mode:'BUS',from:'Public stop',to:'Public stop',serviceNo:'15',boardingStopCode:'83139',alightingStopCode:'83149'},{mode:'SUBWAY',from:'Orchard MRT Station (NS22)',to:'Somerset MRT Station (NS23)'},{mode:'SUBWAY',from:'Clementi',to:'Jurong East'},{mode:'SUBWAY',from:'Tampines',to:'Expo'}]}),signal:AbortSignal.timeout(70000)});
const data=await response.json();console.log(JSON.stringify({status:response.status,durationMs:Date.now()-start,...data}));
if(!response.ok||!data.limits?.some(l=>l.status==='available'))throw new Error('No usable real schedules returned');

import { useEffect,useRef,useState } from 'react';
import { Text,View } from 'react-native';
import { Button } from './Ui';
import { functionsConfig } from '../data/functionsConfig';
import { colors } from '../theme';
import { clock,RouteStep } from '../features/travel/types';

type Arrival={at:string;basis:string};
type Result={checkedAt:string;services:{service:string;arrivals:Arrival[]}[]};
const pending=new Map<string,Promise<Result>>();
const recent=new Map<string,{at:number;result:Result}>();
async function arrivals(stopCode:string|undefined,service:string,stopLocation?:RouteStep['boardingLocation']):Promise<Result>{
 const id=JSON.stringify([stopCode,service,stopLocation]),cached=recent.get(id);if(cached&&Date.now()-cached.at<20000)return cached.result;
 const existing=pending.get(id);if(existing)return existing;
 const request=(async()=>{const {url,key}=functionsConfig();
  if(!url||!key)throw new Error('Live arrivals are not configured.');
  const response=await fetch(url+'/functions/v1/lta',{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify({action:'bus-arrivals',stopCode,service,stopLocation}),signal:AbortSignal.timeout(18000)});
  const data=await response.json();if(!response.ok||!Array.isArray(data.services))throw new Error(data.error||'Live arrivals unavailable.');
  recent.set(id,{at:Date.now(),result:data});return data;
 })().finally(()=>pending.delete(id));pending.set(id,request);return request;
}
export function NextBoarding({steps,now}:{steps:RouteStep[];now:number}){
 const first=steps.find(s=>['BUS','RAIL','SUBWAY','TRAM'].includes(s.mode));
 const id=JSON.stringify([first?.boardingStopCode,first?.serviceNo,first?.boardingLocation]);
 const [result,setResult]=useState<Result>(),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const version=useRef(0);
 const load=async()=>{if(!first?.serviceNo||(!first.boardingStopCode&&!first.boardingLocation))return;const v=++version.current;setBusy(true);setError('');try{const data=await arrivals(first.boardingStopCode,first.serviceNo,first.boardingLocation);if(v===version.current)setResult(data);}catch(e){if(v===version.current)setError(e instanceof Error?e.message:'Arrivals unavailable.');}finally{if(v===version.current)setBusy(false);}};
 useEffect(()=>{setResult(undefined);setError('');void load();return()=>{version.current++;};},[id]);
 if(!first)return null;
 const options=result?.services.find(s=>s.service===first.serviceNo)?.arrivals.filter(a=>Number.isFinite(Date.parse(a.at))&&Date.parse(a.at)>=now)??[];
 const stale=!!result&&now-Date.parse(result.checkedAt)>60000;
 return <View style={{backgroundColor:colors.bambooSoft,borderRadius:16,padding:14,gap:8}}>
  <Text style={{fontWeight:'900'}}>BOARD FIRST · {first.instruction}</Text><Text>{first.from}</Text>
  <Text>Scheduled: {first.startAt?clock(first.startAt):'unavailable'}</Text>
  {first.mode==='BUS'?<>
   {!first.boardingStopCode&&!first.boardingLocation?<Text>Live arrivals unavailable for this stop.</Text>:<>
    <Text>{busy?'Checking LTA arrivals…':error||stale?'Live arrivals need refreshing.':options.length?options.slice(0,3).map(a=>`${Math.max(0,Math.ceil((Date.parse(a.at)-now)/60000))} min (${a.basis==='vehicle-location'?'live estimate':a.basis==='schedule'?'scheduled':'estimate'})`).join(' · '):'No arrivals returned. Service may still be running.'}</Text>
    {error?<Text accessibilityRole="alert">{error}</Text>:null}
    <Button secondary label="Refresh bus arrivals" onPress={!busy&&(!result||now-Date.parse(result.checkedAt)>=20000)?()=>void load():undefined}/>
    <Text style={{fontSize:11}}>LTA DataMall{result?` · checked ${clock(result.checkedAt)}`:''}. Allow walking time; changing buses may affect transfers.</Text>
   </>}
  </>:<Text style={{fontSize:12}}>Scheduled, not live. Check station displays for the next train.</Text>}
 </View>;
}

import { useEffect,useRef,useState } from 'react';
import { Linking,Text,View } from 'react-native';
import { clock,RouteStep } from '../features/travel/types';
import { connectionWarning,earlierJourneyTime,fetchServiceLimits,scheduleConflict,ServiceLimits,transitSteps } from '../features/train/serviceLimits';
import { Button,Disclosure } from './Ui';
import { colors } from '../theme';
export function LastServices({steps,now,onDisruption,visible=true}:{steps:RouteStep[];now:number;onDisruption:(blocked:boolean,suggestedAt?:string)=>void;visible?:boolean}){
 const [data,setData]=useState<ServiceLimits>(),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const version=useRef(0),identity=JSON.stringify(steps),callback=useRef(onDisruption);callback.current=onDisruption;
 const load=async()=>{const v=++version.current;setBusy(true);setError('');try{const result=await fetchServiceLimits(steps);if(v!==version.current)return;setData(result);}catch(e){if(v===version.current){setError(e instanceof Error?e.message:'Schedule check failed.');callback.current(true);}}finally{if(v===version.current)setBusy(false);}};
 useEffect(()=>{setData(undefined);void load();return()=>{version.current++;};},[identity]);
 const stale=!!data&&now-Date.parse(data.checkedAt)>5*60000;
 const incomplete=!!data&&(data.limits.length!==transitSteps(steps).length||data.limits.some(l=>l.status!=='available')||(transitSteps(steps).some(s=>s.mode!=='BUS')&&data.alerts.status==='unknown'));
 const liveRisk=!!data?.live?.some(l=>l.connectionRisk);
 useEffect(()=>{if(!data)return;const conflict=scheduleConflict(steps,data.limits);callback.current(stale||incomplete||liveRisk||data.alerts.status==='disruption'||conflict,!stale&&!incomplete&&data.alerts.status!=='disruption'?(conflict?earlierJourneyTime(steps,data.limits):liveRisk?new Date().toISOString():undefined):undefined);},[data,stale,incomplete,liveRisk,identity]);
 // Keep schedule checks running while the person card is collapsed.
 if(!visible)return null;
 return <View style={{gap:10,marginTop:14,padding:14,borderRadius:14,backgroundColor:colors.bambooSoft}}>
 {liveRisk?<Text accessibilityRole="alert" style={{color:colors.reject,fontWeight:'700'}}>Bus delay may miss your connection. Countdown paused.</Text>:null}
 {incomplete?<Text style={{fontSize:12}}>Some last-service checks are unavailable. Countdown paused; use Maps.</Text>:null}
 {data?.live?.filter(l=>l.status!=='not-applicable').map(l=><Text key={l.index} style={{fontSize:12}}>{transitSteps(steps)[l.index]?.serviceNo}: {l.at?`LTA arrival estimate ${clock(l.at)}`:l.status==='outside-live-window'?'Scheduled · too early for live arrivals':'Live bus match unverified'}</Text>)}
 <Disclosure title="Last bus / train times">
 <Text style={{fontSize:12}}>A later service may miss your connection.</Text>
 {busy?<Text>Checking service times…</Text>:null}
 {data&&scheduleConflict(steps,data.limits)?<Text accessibilityRole="alert" style={{color:colors.reject}}>Schedule conflict — countdown paused. Refresh or check operator advice.</Text>:null}
 {error?<Text accessibilityRole="alert">{error}</Text>:null}
 {stale?<Text>Times are stale. Please refresh.</Text>:data?transitSteps(steps).map((leg,i)=>{const limit=data.limits[i],warning=connectionWarning(steps,data.limits,i);return <View key={i} style={{gap:4}}>
 <Text style={{fontWeight:'800'}}>{leg.instruction} · {leg.from}</Text>
 <Text>Your route: board {leg.startAt?clock(leg.startAt):'time unavailable'}</Text>
 {limit?.status==='available'&&limit.lastAt?<><Text style={{fontWeight:'800'}}>Last scheduled {leg.mode==='BUS'?'bus':'train'}: {clock(limit.lastAt)}{Date.parse(limit.lastAt)<now?' · already passed':''}</Text><Text>Reaches {leg.to}: {limit.arrivalAt?clock(limit.arrivalAt):'unavailable'}{limit.direction?` · direction ${limit.direction}`:''}</Text><Text style={{fontSize:11}}>{limit.basis}</Text></>:<Text>Last service unverified: {limit?.reason||'No matching schedule returned.'}</Text>}
 {warning?<Text style={{color:warning.kind==='miss'?colors.reject:colors.muted,fontWeight:'600'}}>{warning.message}</Text>:<Text style={{fontSize:12}}>No further transfers. Allow walking time.</Text>}
 </View>}):null}
 {data?<><Text style={{fontWeight:'700',color:data.alerts.status==='disruption'?colors.reject:colors.muted}}>{data.alerts.status==='disruption'?'Train disruption — countdown paused. Check operator advice.':data.alerts.status==='normal-or-minor-delays'?'LTA: normal / minor delays. Special hours unverified.':'Train disruption status unavailable or not applicable.'}</Text><Text style={{fontSize:11}}>LTA DataMall · checked {clock(data.checkedAt)} · service day {data.serviceDay}. {data.notice}</Text></>:null}
 <Button secondary label={busy?'Checking service schedules…':'Refresh last-service schedules'} onPress={!busy?()=>void load():undefined}/>
 <Button secondary label="Official changes to operating hours ↗" onPress={()=>void Linking.openURL('https://www.lta.gov.sg/content/ltagov/en/map/announcement.html').catch(()=>setError('Could not open operator notices.'))}/>
 </Disclosure></View>;
}

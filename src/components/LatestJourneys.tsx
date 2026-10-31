import { useEffect,useRef,useState } from 'react';
import { countdownLabel } from '../features/train/countdown';
import { GroupCountdown } from './GroupCountdown';
import { Linking,Pressable,Text,View } from 'react-native';
import { GeoLocation,Participant } from '../types';
import { clock,directions,validLocation } from '../features/travel/types';
import { connectedTonight,journeyNeedsRefresh,latestConnected,LatestResult,tonightEnd } from '../features/train/latestSearch';
import { journeyAttemptToken,journeyFetchIds,journeySignature,keepShownRoute,lastCallHomeGate,lastCallRowCue,lastCallSummary,partyLeaveBy,peekJourneys,reconcileJourneys,saveDisruption,saveJourney,sharedLeaveBy,shownGroupDeadline } from '../features/train/lastCallSession';
import { scheduledTrips } from '../data/travelProvider';
import { LastServices } from './LastServices';
import { Button } from './Ui';
import { colors } from '../theme';

async function loadJourney(partyMs: number, person: Participant, origin: GeoLocation, windowEnd: string, buffer: number, signal: AbortSignal): Promise<LatestResult> {
  if (Number.isFinite(partyMs)) {
    const departure = new Date(Math.max(partyMs, Date.now())).toISOString();
    const [answer] = await scheduledTrips([{ id: person.id, from: origin, to: person.location! }], departure, undefined, signal);
    const message = answer?.message || '';
    if (answer?.failure || /limit|quota/i.test(message)) return { checks: 1, complete: true, windowEnd, error: message || 'Not checked: provider limit reached. Try Maps or retry later.' };
    return answer?.route ? { checks: 1, complete: true, windowEnd, route: answer.route } : { checks: 1, complete: true, windowEnd, error: message || 'No route for this leave-by' };
  }
  return latestConnected(Date.now(), async (departure) => {
    const [answer] = await scheduledTrips([{ id: person.id, from: origin, to: person.location! }], departure, undefined, signal);
    if (answer?.failure) throw new Error(answer.message || 'A provider check failed.');
    return answer?.route;
  }, signal, buffer * 60000);
}

export function LatestJourneys({scope,origin,people,buffer,now,leaveAt}:{scope:string;origin?:GeoLocation;people:Participant[];buffer:number;now:number;leaveAt?:string}){
 const [expanded,setExpanded]=useState<string>();
 const windowEnd=new Date(tonightEnd(now)).toISOString();
 const partyMs=partyLeaveBy(leaveAt, now);
 const ready=lastCallHomeGate(people).ready;
 const signed=ready.map(p=>({id:p.id,signature:journeySignature(origin,p.location,Number.isFinite(partyMs)?leaveAt!:windowEnd)}));
 const identity=JSON.stringify([scope,signed]);
 const reconciled=reconcileJourneys(peekJourneys(scope),signed);
 const [overlay,setOverlay]=useState<{identity:string;results:Record<string,LatestResult>;disruptions:Record<string,boolean>}>({identity:'',results:{},disruptions:{}});
 const [busy,setBusy]=useState(false);
 const view=overlay.identity===identity?overlay:{results:reconciled.kept,disruptions:reconciled.disruptions};
 const results=view.results,disruptions=view.disruptions;
 const repairs=useRef<Record<string,number>>({});
 const controller=useRef<AbortController|undefined>(undefined),version=useRef(0),running=useRef(false);
 const searched=useRef(new Set<string>());
 const [pass,setPass]=useState(0);
 const rememberedDeadline=useRef(NaN),watched=useRef('');
 const publish=(id:string,signature:string,result:LatestResult)=>{
  const previous=peekJourneys(scope)?.get(id);
  const shown=keepShownRoute(previous?.signature===signature?previous.result:undefined,result);
  saveJourney(scope,id,{signature,result:shown});
  const disruption=peekJourneys(scope)?.get(id)?.disruption;
  setOverlay(current=>{
   const base=current.identity===identity?current:{identity,results:{...reconciled.kept},disruptions:{...reconciled.disruptions}};
   const nextDisruptions={...base.disruptions};
   if(typeof disruption==='boolean')nextDisruptions[id]=disruption;else delete nextDisruptions[id];
   return {identity,results:{...base.results,[id]:shown},disruptions:nextDisruptions};
  });
 };
 const check=async(ids?:string[])=>{
  const targets=ready.filter(p=>!ids||ids.includes(p.id));
  if(!validLocation(origin)||!targets.length||running.current)return;
  running.current=true;
  controller.current?.abort();
  const abort=new AbortController();controller.current=abort;const v=++version.current;const written=new Set<string>();setBusy(true);
  const token=(id:string,signature:string,startAt?:string)=>journeyAttemptToken(id,buffer,signature,startAt);
  try{for(const person of targets){if(abort.signal.aborted||v!==version.current)return;const signature=signed.find(p=>p.id===person.id)?.signature??journeySignature(origin,person.location,windowEnd);const attemptedStart=view.results[person.id]?.route?.startAt;const result=await loadJourney(partyMs,person,origin,windowEnd,buffer,abort.signal);if(v!==version.current)return;publish(person.id,signature,result);searched.current.add(token(person.id,signature,attemptedStart));written.add(person.id);if(result.error?.toLowerCase().includes('limit')||result.error?.toLowerCase().includes('quota')){const blocked:LatestResult={checks:0,complete:false,windowEnd:result.windowEnd,error:'Not checked: provider limit reached. Try Maps or retry later.'};for(const other of targets){if(written.has(other.id))continue;const otherSignature=signed.find(p=>p.id===other.id)?.signature??'';const otherStart=view.results[other.id]?.route?.startAt;publish(other.id,otherSignature,blocked);searched.current.add(token(other.id,otherSignature,otherStart));written.add(other.id);}break;}}}
  catch{ /* Cancellation leaves the last countdown up. Individual provider errors are in results. */ }
  finally{if(v===version.current){running.current=false;setBusy(false);}setPass(n=>n+1);}
 };
 // Same-night visits reuse the snapshot. A passed leave-by is searched once more
 // so an earlier bus is not kept when a later ride still fits tonight.
 // Mark an attempt only after that person's result is stored. A roster patch must
 // not cancel the rest of the batch, or the friend's row stays on "Finding…".
 const staleKey=ready.map(person=>{const start=view.results[person.id]?.route?.startAt;return journeyNeedsRefresh(start,now,buffer*60000)?`${person.id}:${start}`:'';}).filter(Boolean).join('|');
 useEffect(()=>{
  return()=>{version.current++;controller.current?.abort();running.current=false;setBusy(false);};
 },[identity,buffer]);
 useEffect(()=>{
  if(running.current||!validLocation(origin))return;
  const stale=staleKey?staleKey.split('|').map(item=>item.split(':')[0]!).filter(Boolean):[];
  const ids=journeyFetchIds(reconciled.missingIds,stale,searched.current,id=>journeyAttemptToken(id,buffer,signed.find(person=>person.id===id)?.signature??'',view.results[id]?.route?.startAt));
  if(!ids.length)return;
  const timer=setTimeout(()=>{void check(ids);},1000);
  return()=>clearTimeout(timer);
 },[identity,staleKey,buffer,pass]);
 const repair=async(person:Participant,at:string)=>{if(!validLocation(origin)||!validLocation(person.location)||(repairs.current[person.id]??0)>=2)return;repairs.current[person.id]=(repairs.current[person.id]??0)+1;const v=version.current;
  try{const [answer]=await scheduledTrips([{id:person.id,from:origin,to:person.location}],at,undefined,controller.current?.signal);if(v!==version.current||!answer?.route)return;const route=answer.route;if(!connectedTonight(route,Date.now(),tonightEnd(Date.now())))return;const previous=results[person.id];const nextStart=Date.parse(route.startAt);const prevStart=Date.parse(previous?.route?.startAt??'');if(Number.isFinite(prevStart)&&nextStart<prevStart&&nextStart-buffer*60000<=Date.now())return;const end=new Date(tonightEnd(Date.now())).toISOString();publish(person.id,journeySignature(origin,person.location,end),{checks:(previous?.checks??0)+1,complete:previous?.complete??true,windowEnd:previous?.windowEnd??end,route,error:previous?.error});}catch{/* Keep the countdown paused if repair fails. */}
 };
 const noteDisruption=(person:Participant,blocked:boolean,at?:string)=>{
  const signature=signed.find(p=>p.id===person.id)?.signature;
  if(signature)saveDisruption(scope,person.id,signature,blocked);
  setOverlay(current=>{
   const base=current.identity===identity?current:{identity,results:{...reconciled.kept},disruptions:{...reconciled.disruptions}};
   if(base.disruptions[person.id]===blocked&&current.identity===identity)return current;
   return {identity,results:base.results,disruptions:{...base.disruptions,[person.id]:blocked}};
  });
  if(at&&!Number.isFinite(partyMs))void repair(person,at);
 };
 const memberLeave=(person:Participant)=>{
  const home=validLocation(person.location);
  const result=results[person.id],leave=result?.route?Date.parse(result.route.startAt)-buffer*60000:NaN;
  const validated=disruptions[person.id]===false&&!!result?.complete&&Number.isFinite(leave);
  const pending=home&&(!result||!result.complete||(!!result.route&&disruptions[person.id]===undefined));
  return {home,leaveBy:validated?leave:NaN,pending};
 };
 const readyDeadline=Number.isFinite(partyMs)?partyMs:sharedLeaveBy(people.map(memberLeave));
 const watch=`${scope}:${journeySignature(origin,undefined,Number.isFinite(partyMs)?leaveAt!:windowEnd)}`;
 if(watched.current!==watch){watched.current=watch;rememberedDeadline.current=NaN;}
 if(Number.isFinite(readyDeadline))rememberedDeadline.current=readyDeadline;
 const deadline=Number.isFinite(partyMs)?partyMs:shownGroupDeadline(readyDeadline,reconciled.missingIds.length>0||busy,rememberedDeadline.current);
 return <View style={{gap:10}}>
 <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12}}><Text style={{fontSize:20,fontWeight:'900'}}>Zao already?</Text><Button secondary label={busy?'Checking…':'↻ Refresh'} onPress={!busy&&validLocation(origin)&&ready.length?()=>void check():undefined}/></View>
 <Text style={{fontSize:12,color:colors.muted}}>{lastCallSummary(people.some(person=>!!results[person.id]?.route))}</Text>
 {Number.isFinite(deadline)?<GroupCountdown deadline={deadline}/>:null}
 {people.map(person=>{
  const result=results[person.id],route=result?.route,leave=Number.isFinite(partyMs)?partyMs:route?Date.parse(route.startAt)-buffer*60000:NaN,open=expanded===person.id;
  const validated=Number.isFinite(partyMs)||(disruptions[person.id]===false&&!!result?.complete&&!!route&&Number.isFinite(leave));
  const safe=validated&&leave>now;
  const overdue=!!route&&Number.isFinite(leave)&&leave<=now;
  const minutes=safe?Math.ceil((leave-now)/60000):overdue?(leave-now)/60000:null;
  const lateLabel=!overdue?countdownLabel(minutes):minutes===0?'0 min late':countdownLabel(minutes!<0?minutes:-Math.abs(minutes!));
  const searching=busy||reconciled.missingIds.includes(person.id);
  const cue=lastCallRowCue(person.location,validLocation(origin));
  const status=cue??(safe?'until you should leave':route&&leave<=now?'Leave-by passed':route&&disruptions[person.id]===undefined?'Checking service times':route&&disruptions[person.id]?'Check service alert':result?.error?'Route unavailable':searching?'Finding your route…':'No late route found');
  return <View key={person.id} style={{backgroundColor:colors.card,borderRadius:20,borderWidth:1,borderColor:colors.line,overflow:'hidden'}}>
   <Pressable accessibilityRole="button" accessibilityLabel={`Journey for ${person.name||'traveller'}`} aria-expanded={open} accessibilityState={{expanded:open}} onPress={()=>setExpanded(open?undefined:person.id)} style={({pressed})=>({padding:17,flexDirection:'row',alignItems:'center',gap:10,backgroundColor:pressed?colors.lime:'transparent'})}>
    <View style={{flex:1,minWidth:0,gap:4}}><Text style={{fontSize:17,fontWeight:'800'}}>{person.name||'Traveller'}</Text><Text numberOfLines={1} style={{fontSize:12,color:colors.muted}}>{validLocation(person.location)?person.location.label:'Add home location'}</Text>{validLocation(person.location)?<Text style={{fontSize:11,color:colors.muted}}>{validated?`Leave by ${clock(new Date(leave).toISOString())}`:status}</Text>:null}</View>
    <View style={{alignItems:'flex-end'}}><Text style={{fontSize:overdue||(minutes!==null&&minutes>=60)?22:30,fontWeight:'900',color:overdue||(safe&&minutes!<=15)?colors.reject:safe?colors.ink:colors.muted}}>{lateLabel}</Text><Text style={{fontSize:11,color:colors.muted}}>{open?'Hide ⌃':'Details ⌄'}</Text></View>
   </Pressable>
   {open?<View style={{paddingHorizontal:17,paddingBottom:17,gap:12}}>
    {route?<><View style={{padding:12,borderRadius:12,backgroundColor:colors.bambooSoft}}><Text style={{fontWeight:'800'}}>Home at {clock(route.endAt)}</Text><Text style={{fontSize:12,color:colors.muted}}>{route.source==='google'?'Google Maps':'OneMap'} · {buffer} min to get ready</Text></View>
    {route.steps.map((step,index)=><View key={index} style={{flexDirection:'row',gap:12}}>
      <View style={{alignItems:'center',width:34}}><View style={{width:32,height:32,borderRadius:16,backgroundColor:step.mode==='WALK'?colors.paper:colors.bambooSoft,alignItems:'center',justifyContent:'center'}}><Text>{step.mode==='WALK'?'🚶':step.mode==='BUS'?'🚌':'🚆'}</Text></View>{index<route.steps.length-1?<View style={{width:2,flex:1,minHeight:20,backgroundColor:colors.line}}/>:null}</View>
      <View style={{flex:1,minWidth:0,paddingBottom:12,gap:3}}><Text style={{fontSize:12,color:colors.green,fontWeight:'700'}}>{step.startAt?clock(step.startAt):''} · {Math.ceil(step.durationSeconds/60)} min</Text><Text style={{fontWeight:'800'}}>{step.instruction}</Text><Text style={{fontSize:12,color:colors.muted}}>{step.from} → {step.to}</Text></View>
    </View>)}</>:<Text style={{fontSize:13,color:colors.muted}}>{result?.error||status}. Try Maps for another option.</Text>}
    {validLocation(origin)&&validLocation(person.location)?<Button secondary label="Open Google Maps ↗" onPress={()=>void Linking.openURL(directions(origin,person.location!)).catch(()=>undefined)}/>:null}
   </View>:null}
   {route?<LastServices visible={open} steps={route.steps} now={now} onDisruption={(blocked,at)=>noteDisruption(person,blocked,at)}/>:null}
  </View>;
 })}
 </View>;
}

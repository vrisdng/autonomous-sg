import AsyncStorage from '@react-native-async-storage/async-storage';
import {useEffect,useRef,useState} from 'react';
import {Text,View,Pressable} from 'react-native';
import {GeoLocation,PlanDraft} from '../types';
import {loadPlanDraft,savePlanDraft} from '../data/planDraft';
import {publishRemotePlan,saveOutingGuest} from '../data/remotePlans';
import {keepConfirmedHomes,mergeOuting} from '../features/plans/mergeOuting';
import {validLocation} from '../features/travel/types';
import {LocationPicker} from './LocationPicker';
import {Button,Disclosure} from './Ui';
import {loadSavedHome,rememberHome,forgetHome,loadPartyHome,rememberPartyHome} from '../data/savedHome';
import {meetSelf} from '../features/meet/meetReady';
import {colors} from '../theme';

export function HomeLocationEditor({plan}:{plan:PlanDraft}) {
 const own=meetSelf(plan);
 const key=`bojio.pending-home:${plan.code}:${own?.id??''}`;
 const [pending,setPending]=useState<GeoLocation>(),[busy,setBusy]=useState(false),[loaded,setLoaded]=useState(false),[message,setMessage]=useState('');
 const active=useRef(true),lock=useRef(false);
 const [remembered,setRemembered]=useState<GeoLocation>(),[partyHome,setPartyHome]=useState<GeoLocation>(),[editing,setEditing]=useState(false),[profileReady,setProfileReady]=useState(false);
 useEffect(()=>{let live=true;setRemembered(undefined);setProfileReady(false);setEditing(false);if(own)void loadSavedHome(own.name).then(async value=>{if(value===undefined&&validLocation(own.location)&&own.location.label!=='Current location'){await rememberHome(own.name,own.location);value=own.location;}if(live){setRemembered(value??undefined);setProfileReady(true);}}).catch(()=>{if(live){setMessage('Couldn’t load your saved home. You can choose an address again.');setProfileReady(true);}});return()=>{live=false;};},[own?.name,key]);
 useEffect(()=>{active.current=true;setLoaded(false);setPending(undefined);setMessage('');AsyncStorage.getItem(key).then(raw=>{if(!active.current)return;if(raw){const value=JSON.parse(raw);if(!validLocation(value))throw new Error();setPending(value);setMessage('Home address not shared yet. Tap retry.');}setLoaded(true);}).catch(()=>{if(active.current)setMessage('Couldn’t read your saved address. Reload to retry; it has not been replaced.');});return()=>{active.current=false;};},[key]);
 useEffect(()=>{if(!own)return;let live=true;void loadPartyHome(plan.code,own.id).then(async value=>{if(!live||!validLocation(value))return;setPartyHome(value);const current=await loadPlanDraft();if(!live||current?.code!==plan.code)return;const same=!current.remote||current.remote.participantId===own.id;const person=current.participants.find(p=>p.id===own.id);if(!same||!person||validLocation(person.location))return;await savePlanDraft({...current,participants:current.participants.map(p=>p.id===own.id?{...p,location:value}:p)});}).catch(()=>{if(live)setMessage('Couldn’t load your saved home. You can choose an address again.');});return()=>{live=false;};},[plan.code,own?.id]);
 if(!own)return null;
 const save=async(location:GeoLocation)=>{
  if(lock.current)return;lock.current=true;setBusy(true);setPending(location);setMessage('Saving home address…');
  const chosen={label:location.label.slice(0,300),latitude:location.latitude,longitude:location.longitude};
  try{
   if(!validLocation(chosen))throw new Error('Choose a valid home address.');
   await rememberHome(own.name,chosen);
   await rememberPartyHome(plan.code,own.id,chosen);
   await AsyncStorage.setItem(key,JSON.stringify(chosen));
   if(active.current){setRemembered(chosen);setPartyHome(chosen);}
   const current=await loadPlanDraft();
   if(current?.code!==plan.code||current.status==='closed'||current.remote?.participantId!==plan.remote?.participantId)throw new Error('Party changed or closed. Reopen your party to save.');
   const person=current.participants.find(p=>p.id===own.id);
   if(!person)throw new Error('Rejoin your party before saving your address.');
   const next={...current,participants:current.participants.map(p=>p.id===own.id?{...p,location:chosen,origin:chosen.label.slice(0,120)}:p),pendingSync:true};
   await savePlanDraft(next);
   const saved=current.remote?.published
    ? current.remote.role==='guest'
      ? await saveOutingGuest(current.code,person.name,chosen,person.transportMode??'either',current.remote)
      : {...await publishRemotePlan(next),pendingSync:false}
    : next;
   const latest=await loadPlanDraft();
   if(latest?.code!==current.code)throw new Error('Party changed. Reopen it to check your saved address.');
   const latestPerson=latest.participants.find(p=>p.id===own.id);
   const confirmed=JSON.stringify(latestPerson?.location)===JSON.stringify(chosen);
   const sameRoster=latest.participants.map(p=>p.id).join()===next.participants.map(p=>p.id).join();
   const ours=sameRoster&&latest.chosenVenueId===next.chosenVenueId&&confirmed;
   if((latest.revision??0)>=(saved.revision??0)&&confirmed){
    // Polling may have delivered this very save before its response arrived.
   }else{
    if(!ours&&JSON.stringify(latest)!==JSON.stringify(current)&&(latest.pendingSync||(latest.revision??0)>(saved.revision??0)))throw new Error('The party changed while saving. Tap retry to check and save again.');
    const merged=current.remote?.role==='guest'?mergeOuting({...next,pendingSync:current.pendingSync},saved):{...saved,pendingSync:false};
    await savePlanDraft({...keepConfirmedHomes(next,merged),remote:next.remote??merged.remote});
   }
   await AsyncStorage.removeItem(key);
   if(active.current){setEditing(false);setPending(undefined);setMessage(current.remote?.published?'Home address shared ✓':'Home address saved on this device ✓');}
  }catch(error){if(active.current)setMessage((error instanceof Error?error.message:'Couldn’t save.')+' Your address is kept for retry.');}
  finally{lock.current=false;if(active.current)setBusy(false);}
 };
 const address=validLocation(own.location)?own.location:validLocation(pending)?pending:validLocation(partyHome)?partyHome:validLocation(remembered)?remembered:undefined;
 const canEdit=loaded&&profileReady&&!busy&&plan.status!=='closed';
 return <View style={{borderBottomWidth:1,borderColor:colors.line,paddingVertical:14,gap:10}}>
  <View style={{flexDirection:'row',alignItems:'center',gap:12}}><View style={{width:38,height:38,borderRadius:13,backgroundColor:colors.coralSoft,alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:21,color:colors.ink}}>⌂</Text></View><View style={{flex:1,minWidth:0}}><Text style={{fontSize:11,fontWeight:'800',letterSpacing:1,color:colors.muted}}>YOUR HOME</Text><Text style={{fontSize:14,lineHeight:20,fontWeight:'600',color:colors.ink,marginTop:3}}>{address?.label??'Where are we sending you home?'}</Text></View>{address?<Pressable accessibilityRole="button" accessibilityLabel="Change home address" disabled={!canEdit} onPress={()=>setEditing(!editing)} style={{minHeight:44,justifyContent:'center',paddingHorizontal:8}}><Text style={{color:colors.green,fontWeight:'800'}}>{editing?'Done':'Change'}</Text></Pressable>:null}</View>
  {!validLocation(own.location)&&!validLocation(pending)&&!validLocation(partyHome)&&remembered&&canEdit&&!editing?<Button label="Use saved home for this party" onPress={()=>void save(remembered)}/>:null}
  {canEdit&&(editing||!address)?<LocationPicker label="Home address" value={own.location} onChange={value=>void save(value)}/>:null}
  {editing&&remembered?<Pressable accessibilityRole="button" onPress={()=>void forgetHome(own.name).then(()=>{setRemembered(undefined);setMessage('Forgotten on this browser. This party’s address stays.');}).catch(()=>setMessage('Couldn’t forget your saved address. Try again.'))} style={{minHeight:44,justifyContent:'center'}}><Text style={{color:colors.muted,fontSize:12}}>Forget saved home on this browser</Text></Pressable>:null}
  {!remembered&&own.location&&canEdit?<Pressable accessibilityRole="button" onPress={()=>void rememberHome(own.name,own.location!).then(()=>{setRemembered(own.location);setMessage('Home remembered for next time ✓');}).catch(()=>setMessage('Couldn’t remember this address. Try again.'))} style={{minHeight:44,justifyContent:'center'}}><Text style={{color:colors.green,fontWeight:'700'}}>Remember this home for next time</Text></Pressable>:null}
  {editing||!address?<Text style={{color:colors.muted,fontSize:11,lineHeight:16}}>Remembered for {own.name} in this browser. Saving shares it with this party.</Text>:null}
   {message?<Text accessibilityLiveRegion="polite">{message}</Text>:null}
   {pending&&!busy&&loaded&&plan.status!=='closed'?<Button secondary label="Retry sharing home address" onPress={()=>void save(pending)}/>:null}
 </View>;
}

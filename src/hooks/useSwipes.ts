import { useEffect,useRef,useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Place,PlanDraft } from '../types';
import { callRemoteRpc } from '../data/remotePlans';
import { googleReference,persistedVenue } from '../features/meet/googlePlace';
import { Choice,SwipeState } from '../features/meet/swipes';
import { validLocation } from '../features/travel/types';
const empty:SwipeState={venues:[],voters:['host'],swipes:[]};
function parse(value:any):SwipeState{
 if(!value||!Array.isArray(value.venues)||!Array.isArray(value.voters)||!value.voters.every((v:any)=>typeof v==='string')||!Array.isArray(value.swipes)||!value.swipes.every((s:any)=>typeof s.voterId==='string'&&typeof s.venueId==='string'&&['like','pass','neutral'].includes(s.choice)&&(s.special===undefined||typeof s.special==='boolean')))throw new Error('Could not read swipe progress. Your saved copy has not been replaced.');
 const venues=value.venues.map((v:any)=>googleReference(v)??(v && ['onemap','verified'].includes(v.source)&&validLocation({label:v.name,latitude:v.latitude,longitude:v.longitude})?v:null));
 if(venues.some((v:Place|null)=>!v))throw new Error('Could not read the shared shortlist.');
 return {...value,venues};
}
// The feed adds cards with no swipe screen open, so this reads the live deck, not hook state.
export async function addToDeck(plan:PlanDraft,place:Place,shortlist:Place[]){
 const token=plan.remote?.hostToken;
 if(plan.remote?.role==='guest'||!token)throw new Error('Only the host can add restaurants to the swipe.');
 const raw=await callRemoteRpc('get_swipe_state',{p_code:plan.code}),deck=raw?parse(raw):empty;
 if(deck.venues.some(v=>v.id===place.id))return false;
 if(deck.venues.length){await callRemoteRpc('refresh_swipe_deck',{p_code:plan.code,p_token:token,p_venues:[persistedVenue(place)],p_expected:deck.venues.map(persistedVenue),p_append:true});return true;}
 // Nobody has opened the deck yet. Start it as the swipe screen would, with this place first.
 const voterId=plan.remote?.participantId?`guest:${plan.remote.participantId}`:'host';
 const saved=await AsyncStorage.getItem(`bojio.swipes.v1:${plan.code}:${voterId}`),local=saved?parse(JSON.parse(saved)):empty;
 await callRemoteRpc('start_swipe_deck_with_progress',{p_code:plan.code,p_token:token,p_venues:[place,...(local.venues.length?local.venues:shortlist)].slice(0,20).map(persistedVenue),p_swipes:local.swipes.filter(s=>s.voterId===voterId)});
 return true;
}
export function useSwipes(plan:PlanDraft){
 const [state,setState]=useState<SwipeState>(empty),[error,setError]=useState(''),[busy,setBusy]=useState(false),[loaded,setLoaded]=useState(false);
 const shared=!!plan.remote?.published,token=plan.remote?.role==='guest'?plan.remote.guestToken:plan.remote?.hostToken;
 const participantId=plan.remote?.participantId;
 const voterId=participantId?`guest:${participantId}`:'host';
 const key=`bojio.swipes.v1:${plan.code}:${voterId}`;
 const version=useRef(0),writing=useRef(false),current=useRef(state);current.current=state;
 const refresh=async()=>{if(writing.current)return;const v=++version.current;
  try{const raw=shared?await callRemoteRpc('get_swipe_state',{p_code:plan.code}):JSON.parse(await AsyncStorage.getItem(key)||'null');const next=raw?parse(raw):empty;if(v===version.current){setState(next);setError('');setLoaded(true);}}
  catch(e){if(v===version.current)setError(e instanceof Error?e.message:'Could not load swipes.');}
 };
 useEffect(()=>{writing.current=false;setBusy(false);setState(empty);setLoaded(false);void refresh();const timer=setInterval(()=>{if(shared)void refresh();},10000);const online=()=>void refresh();if(typeof window!=='undefined')window.addEventListener('online',online);return()=>{version.current++;clearInterval(timer);if(typeof window!=='undefined')window.removeEventListener('online',online);};},[key,shared,token]);
 const persist=async(next:SwipeState)=>{await AsyncStorage.setItem(key,JSON.stringify({...next,venues:next.venues.map(persistedVenue)}));};
 const run=async(action:()=>Promise<SwipeState>)=>{if(writing.current)return false;writing.current=true;setBusy(true);setError('');const v=++version.current;
  try{const next=await action();if(v!==version.current)return false;setState(next);return true;}
  catch(e){if(v===version.current)setError(`Not saved. ${e instanceof Error?e.message:'Retry when connected.'}`);return false;}
  finally{if(v===version.current){writing.current=false;setBusy(false);}}
 };
 const start=(places:Place[])=>run(async()=>{if(!loaded)throw new Error('Wait for saved progress to load.');if(plan.status==='closed')throw new Error('This plan is closed.');if(shared){const raw=await AsyncStorage.getItem(key);const local=raw?parse(JSON.parse(raw)):empty;return parse(await callRemoteRpc('start_swipe_deck_with_progress',{p_code:plan.code,p_token:token,p_venues:(local.venues.length?local.venues:places).slice(0,20).map(persistedVenue),p_swipes:local.swipes.filter(s=>s.voterId===voterId)}));}const next={venues:places.slice(0,20),voters:participantId?['host',voterId]:['host'],swipes:[]};await persist(next);return next;});
 const update=(places:Place[],append=false)=>run(async()=>{if(!loaded)throw new Error('Wait for saved progress.');if(plan.status==='closed')throw new Error('This plan is closed.');if(shared)return parse(await callRemoteRpc('refresh_swipe_deck',{p_code:plan.code,p_token:token,p_venues:places.slice(0,20).map(persistedVenue),p_expected:current.current.venues.map(persistedVenue),p_append:append}));const venues=[...(append?current.current.venues:[]),...places].filter((p,i,all)=>all.findIndex(q=>q.id===p.id)===i);if(venues.length>60)throw new Error('Choose a new area to replace this list.');const next={...current.current,venues};await persist(next);return next;});
 const swipe=(venue:Place,choice:Choice)=>run(async()=>{if(plan.status==='closed')throw new Error('This plan is closed.');if(!loaded)throw new Error('Wait for saved progress to load.');if(shared){if(!token||!participantId)throw new Error('Save your entry before swiping.');return parse(await callRemoteRpc('set_restaurant_swipe',{p_code:plan.code,p_token:token,p_venue_id:venue.id,p_choice:choice,p_participant_id:participantId}));}const next={...current.current,swipes:[...current.current.swipes.filter(s=>!(s.voterId===voterId&&s.venueId===venue.id)),{voterId,venueId:venue.id,choice}]};await persist(next);return next;});
 const mention=(venue:Place,enabled:boolean)=>run(async()=>{if(plan.status==='closed')throw new Error('This plan is closed.');if(!loaded)throw new Error('Wait for saved progress to load.');if(shared){if(!token||!participantId)throw new Error('Save your entry first.');return parse(await callRemoteRpc('set_restaurant_mention',{p_code:plan.code,p_token:token,p_venue_id:venue.id,p_enabled:enabled,p_participant_id:participantId}));}if(!current.current.venues.some(p=>p.id===venue.id))throw new Error('Restaurant is no longer in this shortlist.');const next:SwipeState={...current.current,swipes:[...current.current.swipes.filter(s=>!(s.voterId===voterId&&s.venueId===venue.id)),{voterId,venueId:venue.id,choice:'like',special:enabled}]};await persist(next);return next;});
 return {state,error,busy,loaded,voterId,start,update,swipe,mention,refresh};
}

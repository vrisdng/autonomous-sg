import { GeoLocation, Place } from '../types';
import { parseGooglePlace } from '../features/meet/googlePlace';
import { functionsConfig } from './functionsConfig';

// Active-session display state only. Never put this map into persistent storage.
const places = new Map<string, Place>();
const failures = new Map<string,string>();
const attempted = new Set<string>();
const pending = new Map<string,Promise<void>>();
const listeners = new Set<()=>void>();
let revision=0, active=0;
const queue: (()=>void)[]=[];
const emit=()=>{revision++;listeners.forEach(fn=>fn());};
export const subscribePlaces=(fn:()=>void)=>{listeners.add(fn);return()=>{listeners.delete(fn);};};
export const placesRevision=()=>revision;
export const resolvedPlace=(place?:Place)=>place?.source==='google_places' ? places.get(place.providerPlaceId!)??place : place;
export const placeFailure=(id:string)=>failures.get(id);
export async function requestGoogle(body: object) {
  const {url,key}=functionsConfig();
  if(!url||!key)throw new Error('Restaurant discovery is not configured.');
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),22000);
  try {const response=await fetch(`${url}/functions/v1/google-places`,{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify(body),signal:controller.signal});const data=await response.json();if(!response.ok)throw new Error(data.error||'Restaurant service unavailable. Retry.');return data;}
  catch(error){if(controller.signal.aborted)throw new Error('Restaurant search timed out. Retry or open Google Maps.');throw error;}
  finally{clearTimeout(timer);}
}
const request=requestGoogle;
function retain(raw:any,checkedAt:string){const place=parseGooglePlace(raw,checkedAt);if(place){places.set(place.providerPlaceId!,place);failures.delete(place.providerPlaceId!);}return place;}
export async function ensurePlace(id:string,retry=false):Promise<void>{
  if(places.has(id))return;
  if(pending.has(id))return pending.get(id);
  if(attempted.has(id)&&!retry)return;
  attempted.add(id);failures.delete(id);
  const task=(async()=>{if(active>=2)await new Promise<void>(resolve=>queue.push(resolve));else active++;
    try{const data=await request({action:'details',placeId:id});if(data.place?.id!==id || !retain(data.place,data.checkedAt))throw new Error('This restaurant is unavailable in Singapore.');}
    catch(error){failures.set(id,error instanceof Error?error.message:'Details unavailable.');}
    finally{const next=queue.shift();if(next)next();else active--;pending.delete(id);emit();}
  })();pending.set(id,task);return task;
}
export type Discovery = { ids:string[]; centerKey:string; radius:number; busy:boolean; error:string; attempted:boolean; batch?:number; mode?:'replace'|'append' };
const searches=new Map<string,Discovery>();
const queuedSearches=new Map<string,{center:GeoLocation;radius:number;mode?:'replace'|'append'}>();
const empty:Discovery={ids:[],centerKey:'',radius:2000,busy:false,error:'',attempted:false};
export const discovery=(code:string)=>searches.get(code)??empty;
export const centerKey=(center?:GeoLocation)=>center?`${center.latitude.toFixed(6)},${center.longitude.toFixed(6)}`:'';
export const searchPlaces=(code:string)=>discovery(code).ids.map(id=>places.get(id)).filter((p):p is Place=>!!p);
export async function discover(code:string,center:GeoLocation,radius=2000,mode?:'replace'|'append'){
  if(discovery(code).busy){queuedSearches.set(code,{center,radius,mode});return;}
  searches.set(code,{...discovery(code),busy:true,error:'',attempted:true});emit();
  try{const data=await request({action:'nearby',center,radius,rankPreference:mode==='append'?'DISTANCE':'POPULARITY'});if(!Array.isArray(data.places))throw new Error('Unreadable restaurant results.');const found=data.places.map((raw:any)=>retain(raw,data.checkedAt)).filter(Boolean) as Place[];searches.set(code,{...discovery(code),ids:found.map(p=>p.providerPlaceId!),centerKey:centerKey(center),radius,busy:false,batch:(discovery(code).batch??0)+1,mode});}
  catch(error){searches.set(code,{...discovery(code),busy:false,error:error instanceof Error?error.message:'Restaurant search failed.'});}
  emit();
  const queued=queuedSearches.get(code);if(queued){queuedSearches.delete(code);void discover(code,queued.center,queued.radius,queued.mode);}
}

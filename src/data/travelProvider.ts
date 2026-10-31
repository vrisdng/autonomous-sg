import { GeoLocation, Participant, Place } from '../types';
import { DriveLeg, RouteResult, TripRequest, validLocation } from '../features/travel/types';
import { createCoordinator } from '../features/travel/coordinator';
import { shortlistRidePairs } from '../features/rides/shortlist';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, '');
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();
const localUrl = __DEV__ ? process.env.EXPO_PUBLIC_TRAVEL_API_URL?.trim() : undefined;
export const travelConfigured = () => Boolean(localUrl || (url && key));

export class TravelError extends Error {
  constructor(public kind: NonNullable<RouteResult['failure']>, message: string) { super(message); }
}
export const travelTimings: { action: string; durationMs: number; outcome: string }[] = [];
async function fetchRequest<T>(body: object, signal?: AbortSignal, provider = 'onemap'): Promise<T> {
  if (!localUrl && (!url || !key)) throw new Error('Location and route services are not connected yet. You can still build your group and enter a bill.');
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener('abort', cancel, { once: true });
  if (signal?.aborted) controller.abort();
  const timer = setTimeout(() => controller.abort(), 'query' in body ? 25_000 : 55_000);
  const started=Date.now(); let outcome='available';
  try {
    const response = await fetch(localUrl || `${url}/functions/v1/${provider}`, {
      method: 'POST', headers: { ...(key ? { apikey: key } : {}), 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: controller.signal,
    });
    const data = await response.json();
    if (!response.ok || data.error) throw new TravelError(response.status===429?'quota':response.status===401||response.status===403?'authentication':'unavailable', data.error || 'Travel service unavailable. Please retry.');
    return data as T;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') { outcome=signal?.aborted?'cancelled':'timeout'; throw new TravelError(outcome as 'cancelled'|'timeout',signal?.aborted?'Journey check cancelled.':'The route service took too long. Please retry or open Google Maps.'); }
    outcome=error instanceof TravelError?error.kind:'unavailable';
    throw error;
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', cancel); travelTimings.push({action:'query' in body?'search':'route',durationMs:Date.now()-started,outcome}); if(travelTimings.length>50)travelTimings.shift(); }
}
const coordinateKey=(point: GeoLocation)=>[point.latitude,point.longitude];
export const tripKey=(trip: TripRequest, departureAt: string)=>JSON.stringify([coordinateKey(trip.from),coordinateKey(trip.to),departureAt]);
type Work={trip:TripRequest;departureAt:string};
let googlePausedUntil=0;
const transitWork=createCoordinator<Work,RouteResult>((item)=>tripKey(item.trip,item.departureAt),async(items,signal)=>{
  // Different departure times cannot share the same provider batch.
  const output:RouteResult[]=new Array(items.length);
  for(const departureAt of new Set(items.map((item)=>item.departureAt))){
    const selected=items.map((item,index)=>({item,index})).filter(({item})=>item.departureAt===departureAt);
    const body={action:'transit',departureAt,trips:selected.map(({item,index})=>({...item.trip,id:String(index)}))};
    let data:{results:RouteResult[]};
    if(localUrl||Date.now()<googlePausedUntil)data=await fetchRequest(body,signal);
    else {
      try {
        data=await fetchRequest(body,signal,'google-transit');
        if(data.results.some(r=>r.failure==='authentication'||r.failure==='quota'))googlePausedUntil=Date.now()+10*60000;
        const failed=data.results.filter(r=>r.failure);
        if(failed.length&&!signal?.aborted){
          const fallback=await fetchRequest<{results:RouteResult[]}>({...body,trips:body.trips.filter(t=>failed.some(r=>r.id===t.id))},signal).catch(()=>undefined);
          if(fallback)data={results:data.results.map(r=>fallback.results.find(f=>f.id===r.id&&f.route)??r)};
        }
      } catch(error) {
        if(signal?.aborted)throw error;
        if(error instanceof TravelError&&(error.kind==='quota'||error.kind==='authentication'))throw error;
        googlePausedUntil=Date.now()+60000;
        data=await fetchRequest(body,signal);
      }
    }
    for(const {index} of selected)output[index]=data.results.find((result)=>result.id===String(index))??{id:String(index),status:'unavailable',message:'No scheduled journey returned.',failure:'unavailable'};
  }
  return output;
});
type DriveOutcome={seconds?:number;failure?:RouteResult['failure'];message?:string};
function noteQuota(outcome: DriveOutcome): DriveOutcome {
  if (outcome.failure === 'quota' || outcome.failure === 'authentication') return outcome;
  if (typeof outcome.message === 'string' && /limit|quota/i.test(outcome.message)) return { ...outcome, failure: 'quota' };
  return outcome;
}
const driveWork=createCoordinator<TripRequest,DriveOutcome>((trip)=>tripKey(trip,''),async(items,signal)=>{
  const data=await fetchRequest<{legs:({id:string}&DriveOutcome)[]}>({action:'drive',trips:items.map((item,index)=>({...item,id:String(index)}))},signal);
  return items.map((_,index)=>noteQuota(data.legs.find((leg)=>leg.id===String(index))??{failure:'unavailable'}));
});
const searchWork=createCoordinator<string,GeoLocation[]>((query)=>query.toLowerCase(),async(items,signal)=>{
  const data=await fetchRequest<{locations:GeoLocation[]}>({action:'search',query:items[0]},signal);return [data.locations.filter(validLocation)];
},1);
export async function searchLocations(query: string, signal?: AbortSignal): Promise<GeoLocation[]> {
  return searchWork(query.trim(),signal);
}
export async function resolveVenue(place: Place): Promise<Place> {
  if (validLocation({ label: place.name, latitude: place.latitude, longitude: place.longitude })) return place;
  const locations = await searchLocations(place.geocodeQuery ?? place.address ?? place.name);
  if (locations.length !== 1) throw new Error(`Please search the address for ${place.name} and choose the matching location; its coordinates are not confirmed.`);
  return { ...place, latitude: locations[0]!.latitude, longitude: locations[0]!.longitude };
}
export const placeLocation = (place: Place): GeoLocation => ({ label: place.address ?? place.name, latitude: place.latitude!, longitude: place.longitude! });
export async function scheduledTrips(trips: TripRequest[], departureAt: string, onProgress?: (results: RouteResult[]) => void, signal?: AbortSignal): Promise<RouteResult[]> {
  const results: RouteResult[] = [];
  // Bound each request and avoid flooding the free routing service for a group.
  for (let index = 0; index < trips.length; index += 4) {
    if (signal?.aborted) throw new Error('Journey check cancelled.');
    const batch=await Promise.all(trips.slice(index,index+4).map(async(trip):Promise<RouteResult>=>{
      try{return {...await transitWork({trip,departureAt},signal),id:trip.id};}
      catch(error){if(signal?.aborted)throw error;return {id:trip.id,status:'unavailable',failure:error instanceof TravelError?error.kind:'unavailable',message:error instanceof Error?error.message:'Journey unavailable. Try Google Maps.'};}
    }));
    results.push(...batch);
    onProgress?.([...results]);
    if(batch.some((result)=>result.failure==='quota'||result.failure==='authentication')){
      results.push(...trips.slice(index+4).map((trip):RouteResult=>({id:trip.id,status:'unavailable',failure:batch.find((result)=>result.failure)?.failure,message:'Service paused. Retry later or open Google Maps.'})));onProgress?.([...results]);break;
    }
  }
  return results;
}
function matrixOrigin(origin: Place | GeoLocation): GeoLocation {
  if (validLocation(origin) && !('source' in origin)) return origin;
  return placeLocation(origin as Place);
}
export async function drivingMatrix(origin: Place | GeoLocation, participants: Participant[], onProgress?: (done: number, total: number, legs: DriveLeg[]) => void, signal?: AbortSignal): Promise<DriveLeg[]> {
  const points = [{ id: 'venue', location: matrixOrigin(origin) }, ...participants.map((person) => ({ id: person.id, location: person.location }))];
  if (points.some((point) => !validLocation(point.location))) throw new Error('Add a pickup and a home for everyone sharing the ride.');
  const ids:[string,string][]=[...participants.map((person):[string,string]=>['venue',person.id]),...shortlistRidePairs(participants).flatMap(([a,b]):[string,string][]=>[[a,b],[b,a]])];
  const pairs=ids.map(([fromId,toId])=>({id:`${fromId}:${toId}`,fromId,toId,from:points.find((point)=>point.id===fromId)!.location!,to:points.find((point)=>point.id===toId)!.location!}));
  const legs: DriveLeg[] = [];
  for (let index = 0; index < pairs.length; index += 4) {
    if(signal?.aborted)throw new Error('Ride check cancelled.');
    const batch=await Promise.all(pairs.slice(index,index+4).map(async(pair)=>({pair,...await driveWork(pair,signal)})));
    for(const {pair,seconds} of batch)if(Number.isFinite(seconds)&&seconds!>=0)legs.push({from:pair.fromId,to:pair.toId,seconds:seconds!});
    onProgress?.(Math.min(index + 4, pairs.length), pairs.length,[...legs]);
    const failure=batch.find((item)=>item.failure==='quota'||item.failure==='authentication');
    if(failure)throw new TravelError(failure.failure!,failure.message??'Routing is unavailable. Retry later or open Google Maps.');
  }
  return legs;
}

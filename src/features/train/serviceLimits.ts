import { RouteStep } from '../travel/types';
export type ServiceLimit={index:number;status:'available'|'unavailable';lastAt?:string;arrivalAt?:string;direction?:string;reason?:string;basis?:string};
export type ServiceLimits={checkedAt:string;serviceDay:string;limits:ServiceLimit[];alerts:{status:'disruption'|'normal-or-minor-delays'|'unknown'};notice:string;live?:{index:number;status:string;at?:string;connectionRisk?:boolean}[]};
export const transitSteps=(steps:RouteStep[])=>steps.filter(s=>['BUS','RAIL','SUBWAY','TRAM'].includes(s.mode));
export const scheduleConflict=(steps:RouteStep[],limits:ServiceLimit[])=>transitSteps(steps).some((s,i)=>s.startAt&&limits[i]?.lastAt&&Date.parse(s.startAt)>Date.parse(limits[i]!.lastAt!)+60000);
export function earlierJourneyTime(steps:RouteStep[],limits:ServiceLimit[]){
 const start=Date.parse(steps[0]?.startAt??'');
 const bounds=transitSteps(steps).flatMap((s,i)=>{const last=Date.parse(limits[i]?.lastAt??''),boarding=Date.parse(s.startAt??'');return Number.isFinite(last)&&Number.isFinite(boarding)?[last-(boarding-start)-60000]:[];});
 // Query before the boundary to avoid the provider repeatedly returning the same
 // later, conflicting departure. This is a recovery probe, not a claimed final trip.
 const at=Math.min(...bounds)-10*60000;return Number.isFinite(at)&&at>Date.now()?new Date(at).toISOString():undefined;
}
// Compare like-for-like: downstream final departure, plus this itinerary's transfer walk.
// For bus stop-level schedules this is an estimate, not proof both rows track the same bus.
export function connectionWarning(steps:RouteStep[],limits:ServiceLimit[],index:number){
 const transit=transitSteps(steps),leg=transit[index],next=transit[index+1];if(!leg||!next)return null;
 const current=limits[index],following=limits[index+1];
 if(!current?.arrivalAt||!following?.lastAt)return {kind:'unknown' as const,message:'Whether this last service connects onwards is unverified. Keep to the complete journey above.'};
 const a=steps.indexOf(leg),b=steps.indexOf(next),walk=steps.slice(a+1,b).reduce((sum,s)=>sum+s.durationSeconds,0)*1000;
 const ready=Date.parse(current.arrivalAt)+walk+3*60000,cutoff=Date.parse(following.lastAt);
 if(!Number.isFinite(ready)||!Number.isFinite(cutoff))return {kind:'unknown' as const,message:'Transfer timing unavailable.'};
 return ready>cutoff?{kind:'miss' as const,message:'Estimated too late for the last scheduled onward service, including transfer walking and 3 minutes to board. Use the earlier complete journey above.'}:{kind:'uncertain' as const,message:'May fit the published onward timing, but this combination is not a validated journey. Do not extend the countdown.'};
}
const pending=new Map<string,Promise<ServiceLimits>>();
export function fetchServiceLimits(steps:RouteStep[]):Promise<ServiceLimits>{
 const transits=transitSteps(steps);
 const legs=transits.map(({mode,from,to,boardingStopCode,alightingStopCode,serviceNo,boardingLocation,alightingLocation,startAt,endAt},index)=>({mode,from,to,boardingStopCode,alightingStopCode,serviceNo,boardingLocation,alightingLocation,startAt,endAt,transferSeconds:transits[index+1]?steps.slice(steps.indexOf(transits[index]!)+1,steps.indexOf(transits[index+1]!)).reduce((sum,s)=>sum+s.durationSeconds,0):0}));
 const identity=JSON.stringify(legs),existing=pending.get(identity);if(existing)return existing;
 const request=(async()=>{const url=process.env.EXPO_PUBLIC_SUPABASE_URL,key=process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;if(!url||!key)throw new Error('Schedule service is not configured.');
 const response=await fetch(url+'/functions/v1/lta',{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify({action:'service-limits',legs}),signal:AbortSignal.timeout(65000)});const data=await response.json();
 if(!response.ok||!Array.isArray(data.limits))throw new Error(data.error||'Schedule check failed.');return data as ServiceLimits;
 })().finally(()=>pending.delete(identity));pending.set(identity,request);return request;
}

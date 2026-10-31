import { ScheduledRoute } from '../travel/types';
export function tonightEnd(now:number):number {
 const local=new Date(now+8*3600000);
 const day=Date.UTC(local.getUTCFullYear(),local.getUTCMonth(),local.getUTCDate());
 return day+(local.getUTCHours()<4?0:86400000)+4*3600000-8*3600000;
}
export function connectedTonight(route:ScheduledRoute,now:number,end:number):boolean {
 const routeStart=Date.parse(route.startAt),routeEnd=Date.parse(route.endAt);
 if(!Number.isFinite(routeStart)||!Number.isFinite(routeEnd)||routeEnd<routeStart||routeStart<now-1000||routeEnd>end||!route.steps.length)return false;
 let previous=Date.parse(route.startAt);
 for(const step of route.steps){const start=Date.parse(step.startAt??''),stop=Date.parse(step.endAt??'');
  if(!Number.isFinite(start)||!Number.isFinite(stop)||start<previous||stop<start||start-previous>45*60000)return false;
  previous=stop;
 }
 return previous<=Date.parse(route.endAt)&&route.steps.some(s=>['BUS','RAIL','SUBWAY','TRAM'].includes(s.mode));
}
export type LatestResult={route?:ScheduledRoute;checks:number;complete:boolean;error?:string;windowEnd:string};

/** Get-ready moment for a journey that starts at `startAt`. Not a new deadline. */
export function leaveByMs(startAt: string, bufferMs: number) {
  const start = Date.parse(startAt);
  if (!Number.isFinite(start)) return NaN;
  return start - (Number.isFinite(bufferMs) && bufferMs > 0 ? bufferMs : 0);
}

/**
 * A saved trip whose get-ready time has already passed, while this supper night
 * (until 4am SGT) is still open. Search again before treating that as the last ride.
 */
export function journeyNeedsRefresh(startAt: string | undefined, now: number, bufferMs: number) {
  if (!startAt) return false;
  const leave = leaveByMs(startAt, bufferMs);
  return Number.isFinite(leave) && leave <= now && now < tonightEnd(now);
}

// A bounded provider search, NOT proof of the final service across every possible route.
// Each returned candidate is a full connected itinerary; never join independent last buses/trains.
export async function latestConnected(now:number,fetchRoute:(at:string)=>Promise<ScheduledRoute|undefined>,signal?:AbortSignal,bufferMs=0):Promise<LatestResult>{
 const end=tonightEnd(now),result:LatestResult={checks:0,complete:true,windowEnd:new Date(end).toISOString()};
 const buffer=Number.isFinite(bufferMs)&&bufferMs>0?bufferMs:0;
 const remember=(route?:ScheduledRoute)=>{if(route&&connectedTonight(route,now,end)&&(!result.route||Date.parse(route.startAt)>Date.parse(result.route.startAt)))result.route=route;return result.route&&route&&result.route.startAt===route.startAt?route:undefined;};
 const test=async(time:number)=>{if(signal?.aborted)throw new Error('Journey check cancelled.');if(time<now-1000||time>=end)return;result.checks++;try{return remember(await fetchRoute(new Date(time).toISOString()));}catch(e){if(signal?.aborted)throw e;result.complete=false;result.error=e instanceof Error?e.message:'A route check failed.';return;}};
 // Cover the open night, including mid-evening, not only the last hours before 4am.
 // Eight calls total. A next-bus hit must not hide a later connected ride.
 const anchors=[1,2.5,4,5.5].map(hours=>end-hours*3600000).filter(time=>time>now+60000);
 anchors.push(now);anchors.sort((a,b)=>b-a);
 let ceiling=end;
 for(const time of anchors){
  if(result.checks>=8)break;
  const route=await test(time);
  if(!result.complete)return result;
  if(!route){ceiling=time;continue;}
  let lower=Math.max(time,Date.parse(route.startAt));
  while(result.checks<8&&ceiling-lower>15*60000){
   const mid=Math.floor((lower+ceiling)/2000)*1000;
   const later=await test(mid);
   if(!result.complete)return result;
   if(later)lower=Math.max(mid,Date.parse(later.startAt));else ceiling=mid;
  }
  break;
 }
 if(result.complete&&result.route&&Date.parse(result.route.startAt)-buffer<=now){
  let cursor=Date.parse(result.route.startAt)+30*60000;
  while(result.checks<8&&cursor<end-60000){
   const before=Date.parse(result.route.startAt);
   const later=await test(cursor);
   if(!result.complete)return result;
   if(!later)break;
   const start=Date.parse(later.startAt);
   if(!(start>before+5000))break;
   cursor=start+30*60000;
  }
 }
 return result;
}

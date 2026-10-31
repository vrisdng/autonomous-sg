import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('cancelled travel work',()=>{
 beforeEach(()=>{vi.resetModules();vi.stubGlobal('__DEV__',false);vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL','https://test.supabase.co');vi.stubEnv('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY','test-key');});
 afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
 const location={label:'Test',latitude:1.31,longitude:103.81};
 it('maps shared coordinates back to distinct participant IDs',async()=>{
  vi.stubGlobal('fetch',vi.fn(async(_url,init)=>{const body=JSON.parse(init.body);return Response.json({legs:body.trips.map((trip:any)=>({id:trip.id,seconds:120}))});}));
  const {drivingMatrix}=await import('./travelProvider');const {verifiedVenues}=await import('./venues');
  const legs=await drivingMatrix(verifiedVenues[0]!,[{id:'a',name:'A',origin:'',location},{id:'b',name:'B',origin:'',location}]);
  expect(legs.map((leg)=>`${leg.from}:${leg.to}`).sort()).toEqual(['a:b','b:a','venue:a','venue:b']);
 });
 it('routes a typed pickup when there is no meetup',async()=>{
  const fetch=vi.fn(async(_url:unknown,init:any)=>{const body=JSON.parse(init.body);return Response.json({legs:body.trips.map((trip:any)=>({id:trip.id,seconds:90}))});});
  vi.stubGlobal('fetch',fetch);
  const {drivingMatrix}=await import('./travelProvider');
  const pickup={label:'School gate',latitude:1.3521,longitude:103.9445};
  const legs=await drivingMatrix(pickup,[{id:'a',name:'A',origin:'Home',location:{label:'Home',latitude:1.34,longitude:103.93}}]);
  expect(legs).toEqual([{from:'venue',to:'a',seconds:90}]);
  expect(JSON.parse(fetch.mock.calls[0]![1].body).trips[0].from).toMatchObject(pickup);
 });
 it('preserves successful routes and marks omitted responses unavailable',async()=>{
  vi.stubGlobal('fetch',vi.fn(async(_url,init)=>{const body=JSON.parse(init.body);return Response.json({results:[{id:body.trips[0].id,status:'available',route:{durationSeconds:600}}]});}));
  const {scheduledTrips}=await import('./travelProvider');const results=await scheduledTrips([{id:'a',from:location,to:location},{id:'b',from:location,to:{...location,longitude:103.9}}],new Date().toISOString());
  expect(results[0]?.status).toBe('available');expect(results[1]?.status).toBe('unavailable');
 });
 it('stops further batches at a quota failure',async()=>{
  const fetch=vi.fn(async()=>Response.json({error:'Quota busy'},{status:429}));vi.stubGlobal('fetch',fetch);
  const {scheduledTrips}=await import('./travelProvider');const results=await scheduledTrips(Array.from({length:8},(_,i)=>({id:String(i),from:location,to:{...location,longitude:103.8+i/100}})),new Date().toISOString());
  expect(results).toHaveLength(8);expect(results.every((result)=>result.failure==='quota')).toBe(true);expect(fetch).toHaveBeenCalledTimes(1);
 });
 it('stops the next transit batch after inputs change',async()=>{
  const controller=new AbortController();
  const fetch=vi.fn(async()=>Response.json({results:[{id:'a',status:'unavailable'}]}));vi.stubGlobal('fetch',fetch);
  const {scheduledTrips}=await import('./travelProvider');
  await expect(scheduledTrips(Array.from({length:8},(_,i)=>({id:String(i),from:location,to:location})),new Date().toISOString(),()=>controller.abort(),controller.signal)).rejects.toThrow('cancelled');
  expect(fetch).toHaveBeenCalledTimes(1);
 });
 it('stops the next driving batch after leaving the tab',async()=>{
  const controller=new AbortController();
  const fetch=vi.fn(async()=>Response.json({legs:[]}));vi.stubGlobal('fetch',fetch);
  const {drivingMatrix}=await import('./travelProvider');
  const {verifiedVenues}=await import('./venues');
  await expect(drivingMatrix(verifiedVenues[0]!,Array.from({length:3},(_,i)=>({id:String(i),name:'Test',origin:'Test',location})),()=>controller.abort(),controller.signal)).rejects.toThrow('cancelled');
  expect(fetch).toHaveBeenCalledTimes(1);
 });
});

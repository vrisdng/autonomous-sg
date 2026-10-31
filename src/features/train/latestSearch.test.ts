import { expect,it } from 'vitest';
import { connectedTonight,journeyNeedsRefresh,latestConnected,tonightEnd } from './latestSearch';
import { ScheduledRoute } from '../travel/types';
const now=Date.parse('2026-09-16T14:00:00Z');
function route(at:number):ScheduledRoute{return {source:'onemap',checkedAt:new Date(now).toISOString(),startAt:new Date(at).toISOString(),endAt:new Date(at+1800000).toISOString(),durationSeconds:1800,steps:[{mode:'BUS',from:'A',to:'B',instruction:'Bus',durationSeconds:900,startAt:new Date(at).toISOString(),endAt:new Date(at+900000).toISOString()},{mode:'RAIL',from:'B',to:'C',instruction:'Train',durationSeconds:900,startAt:new Date(at+900000).toISOString(),endAt:new Date(at+1800000).toISOString()}]};}
it('uses the same overnight window after midnight',()=>{expect(tonightEnd(now)).toBe(Date.parse('2026-09-16T20:00:00Z'));expect(tonightEnd(Date.parse('2026-09-16T17:00:00Z'))).toBe(tonightEnd(now));});
it('rejects invalid timestamps and long waits between services',()=>{const r=route(now);r.startAt='invalid';expect(connectedTonight(r,now,tonightEnd(now))).toBe(false);const wait=route(now);wait.steps[1]!.startAt=new Date(now+3600000).toISOString();wait.steps[1]!.endAt=new Date(now+3700000).toISOString();expect(connectedTonight(wait,now,tonightEnd(now))).toBe(false);});
it('does not turn cancellation into a completed search',async()=>{const abort=new AbortController();abort.abort();await expect(latestConnected(now,async()=>route(now),abort.signal)).rejects.toThrow('cancelled');});
it('rejects missed transfers and next-morning routes',()=>{const r=route(now);r.steps[1]!.startAt=new Date(now+800000).toISOString();expect(connectedTonight(r,now,tonightEnd(now))).toBe(false);expect(connectedTonight(route(tonightEnd(now)),now,tonightEnd(now))).toBe(false);});
it('finds complete late candidates within bounded calls',async()=>{const last=now+90*60000;const found=await latestConnected(now,async at=>Date.parse(at)<=last?route(last):undefined);expect(found.route?.startAt).toBe(new Date(last).toISOString());expect(found.checks).toBeLessThanOrEqual(8);expect(found.complete).toBe(true);});
it('keeps successful routes but marks failed refinement incomplete',async()=>{let calls=0;const found=await latestConnected(now,async at=>{if(++calls===2)throw new Error('timeout');return route(Date.parse(at));});expect(found.route).toBeDefined();expect(found.complete).toBe(false);});
it('at 8pm SGT keeps a later tonight ride instead of the next bus',async()=>{
 const evening=Date.parse('2026-10-02T12:00:00Z');
 const soon=evening+5*60000, later=evening+160*60000;
 const found=await latestConnected(evening,async at=>{const requested=Date.parse(at);const start=requested<=soon?soon:requested<=later?later:NaN;return Number.isFinite(start)?route(start):undefined;},undefined,15*60000);
 expect(found.route?.startAt).toBe(new Date(later).toISOString());
 expect(Date.parse(found.route!.startAt)-15*60000).toBeGreaterThan(evening);
 expect(found.checks).toBeLessThanOrEqual(8);
 expect(tonightEnd(evening)).toBe(Date.parse('2026-10-02T20:00:00Z'));
});
it('keeps the only ride when nothing later connects tonight',async()=>{
 const evening=Date.parse('2026-10-02T12:00:00Z');
 const soon=evening+5*60000;
 const found=await latestConnected(evening,async at=>Date.parse(at)<=soon?route(soon):undefined,undefined,15*60000);
 expect(found.route?.startAt).toBe(new Date(soon).toISOString());
 expect(journeyNeedsRefresh(found.route?.startAt,evening,15*60000)).toBe(true);
 expect(journeyNeedsRefresh(new Date(evening+90*60000).toISOString(),evening,15*60000)).toBe(false);
});

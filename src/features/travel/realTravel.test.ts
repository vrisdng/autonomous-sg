import { describe, expect, it } from 'vitest';
import { groupLeaveBy, parseSingaporeInput, RouteResult } from './types';
import { parseTransit, singaporeRouteParams } from '../../../supabase/functions/_shared/onemapPayload';
import { matchActualRides, splitEnteredFare } from '../rides/actualRides';
import { rankScheduledPlaces } from '../meet/scheduledRanking';
import { verifiedVenues } from '../../data/venues';

describe('real travel results', () => {
  it('uses Singapore dates across midnight and rejects impossible calendar input', () => {
    expect(parseSingaporeInput('2026-09-16 00:15')).toBe('2026-09-15T16:15:00.000Z');
    expect(parseSingaporeInput('2026-02-30 12:00')).toBeNull();
    expect(singaporeRouteParams('2026-09-15T16:15:00Z')).toEqual({date:'09-16-2026',time:'00:15:00'});
  });
  const start=Date.parse('2026-09-15T15:00:00Z');
  const raw=(mode:string)=>({plan:{itineraries:[{startTime:start,endTime:start+1200000,duration:1200,legs:[{mode,startTime:start,endTime:start+1200000,duration:1200,from:{name:'A'},to:{name:'B'}}]}]}});
  it('rejects walking-only fallback and malformed routes',()=>{
    expect(parseTransit(raw('WALK'),'2026-09-15T14:50:00Z','2026-09-15T14:50:00Z')).toBeNull();
    expect(parseTransit({plan:{itineraries:[{startTime:NaN}]}},'2026-09-15T14:50:00Z','2026-09-15T14:50:00Z')).toBeNull();
  });
  it('compares scheduled starts at the same whole-second precision used by OneMap',()=>{
    expect(parseTransit(raw('BUS'),'2026-09-15T15:00:00.999Z','2026-09-15T14:50:00Z')).not.toBeNull();
    expect(parseTransit(raw('BUS'),'2026-09-15T15:00:01.000Z','2026-09-15T14:50:00Z')).toBeNull();
    expect(parseTransit(raw('BUS'),'invalid','2026-09-15T14:50:00Z')).toBeNull();
  });
  it('rejects inconsistent step times rather than showing an impossible journey',()=>{
    const value=raw('BUS');
    value.plan.itineraries[0]!.legs[0]!.endTime=start+1800000;
    expect(parseTransit(value,'2026-09-15T14:50:00Z','2026-09-15T14:50:00Z')).toBeNull();
  });
  it('never offers a group deadline for partial or expired results',()=>{
    const route=parseTransit(raw('BUS'),'2026-09-15T14:50:00Z','2026-09-15T14:50:00Z')!;
    const results:RouteResult[]=[{id:'a',status:'available',route}];
    expect(groupLeaveBy(results,['a','b'],15,start-1800000)).toBeNull();
    expect(groupLeaveBy(results,['a'],15,start)).toBeNull();
    expect(groupLeaveBy(results,['a'],15,start-1800000)).toBe('2026-09-15T14:45:00.000Z');
  });
  it('does not rank an incomplete venue above a complete one',()=>{
    const route=parseTransit(raw('BUS'),'2026-09-15T14:50:00Z','2026-09-15T14:50:00Z')!;
    const places=verifiedVenues.slice(0,2);
    const ranked=rankScheduledPlaces([{id:'a',name:'A',origin:'A'}],places,{[places[1]!.id]:[{id:'a',status:'available',route}]});
    expect(ranked[0]!.place.id).toBe(places[1]!.id);
    expect(ranked[1]!.max).toBeNull();
  });
  it('requires both drop orders and uses real detours',()=>{
    const people=[{id:'a',name:'A',origin:'A'},{id:'b',name:'B',origin:'B'}];
    const legs=[{from:'venue',to:'a',seconds:600},{from:'venue',to:'b',seconds:900},{from:'a',to:'b',seconds:500}];
    expect(matchActualRides(people,legs)).toHaveLength(2);
    const pair=matchActualRides(people,[...legs,{from:'b',to:'a',seconds:1000}])[0]!;
    expect(pair.dropOrder.map((p)=>p.id)).toEqual(['a','b']);
    expect(pair.extraSeconds).toBe(200);
  });
  it('splits actual money exactly and rejects negative or malformed fares',()=>{
    expect(splitEnteredFare('10.01',['b','a'])).toEqual({a:501,b:500});
    expect(splitEnteredFare('-10',['a'])).toBeNull();
    expect(splitEnteredFare('10.001',['a'])).toBeNull();
  });
});

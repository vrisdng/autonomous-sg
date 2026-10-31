import { expect,it } from 'vitest';
import { parseGoogleTransit } from '../../../supabase/functions/_shared/googleTransit';
import { matchStop } from '../../../supabase/functions/_shared/stopMatch';
import { grabLink,rideStopText } from '../rides/rideLinks';
import { directions } from './types';
const at='2026-09-17T15:50:00Z';
const walk={travelMode:'WALK',staticDuration:'120s'};
const bus={travelMode:'TRANSIT',transitDetails:{transitLine:{nameShort:'12',vehicle:{type:'BUS'}},stopDetails:{departureTime:'2026-09-17T15:55:00Z',arrivalTime:'2026-09-17T16:10:00Z',departureStop:{name:'A',location:{latLng:{latitude:1.3,longitude:103.8}}},arrivalStop:{name:'B'}}}};
it('keeps a midnight bus itinerary with walking, service and stop coordinates',()=>{
 const r=parseGoogleTransit({routes:[{legs:[{steps:[walk,bus,walk]}]}]},at,at)!;
 expect(r.source).toBe('google');expect(r.startAt).toBe('2026-09-17T15:53:00.000Z');expect(r.endAt).toBe('2026-09-17T16:12:00.000Z');expect(r.steps[1]?.serviceNo).toBe('12');expect(r.steps[1]?.boardingLocation?.latitude).toBe(1.3);
});
it('rejects incomplete, backwards and too-early routes',()=>{
 for(const steps of [[walk], [bus,bus], [walk,{...bus,transitDetails:{}}]])expect(parseGoogleTransit({routes:[{legs:[{steps}]}]},at,at)).toBeUndefined();
 expect(parseGoogleTransit({routes:[{legs:[{steps:[walk,bus]}]}]},'2026-09-17T16:00:00Z',at)).toBeUndefined();
});
it('does not guess ambiguous opposite-road bus stops',()=>{
 const p={latitude:1.3,longitude:103.8},rows=[{BusStopCode:'12345',Latitude:1.3,Longitude:103.8}];
 expect(matchStop(p,rows)).toBe('12345');expect(matchStop(p,[...rows,{BusStopCode:'12346',Latitude:1.30001,Longitude:103.8}])).toBeUndefined();expect(matchStop({latitude:1.4,longitude:103.8},rows)).toBeUndefined();
});
it('encodes experimental Grab addresses; Maps preserves every ordered stop',()=>{
 const a={label:'A & B #1',latitude:1.3,longitude:103.8},b={...a,label:'B',latitude:1.31},c={...a,label:'C',latitude:1.32};
 const u=new URL(grabLink(a,c));expect(u.searchParams.get('pickUpAddress')).toBe(a.label);expect(u.searchParams.get('dropOffLatitude')).toBe('1.32');
 expect(new URL(directions(a,c,'driving',[b])).searchParams.get('waypoints')).toBe('1.31,103.8');expect(rideStopText(a,[b,c])).toContain('1. B\n2. C');
});

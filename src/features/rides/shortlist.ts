import { Participant } from '../../types';

// Geometry selects work, never journey durations or a confirmed ride match.
export function shortlistRidePairs(people: Participant[], limit = 12): [string, string][] {
  const ordered = [...people].sort((a,b) => a.id.localeCompare(b.id));
  const distance = (a: Participant, b: Participant) => a.location && b.location
    ? (a.location.latitude-b.location.latitude)**2 + (a.location.longitude-b.location.longitude)**2 : Infinity;
  return ordered.flatMap((a,index) => ordered.slice(index+1).map((b) => ({ a,b,distance:distance(a,b) })))
    .sort((a,b) => a.distance-b.distance || a.a.id.localeCompare(b.a.id) || a.b.id.localeCompare(b.b.id))
    .slice(0,limit).map(({a,b}) => [a.id,b.id]);
}

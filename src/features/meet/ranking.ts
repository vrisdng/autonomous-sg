import { stationPoints } from '../../data/mocks';
import { Participant, Place } from '../../types';

export type RankedPlace = Place & { travelTimes: { participantId: string; name: string; minutes: number }[]; maxMinutes: number; spreadMinutes: number; score: number };

export function estimateTravelMinutes(origin: string, destination: { x: number; y: number }) {
  const start = stationPoints[origin];
  if (!start) return null;
  const gridDistance = Math.hypot(start.x - destination.x, start.y - destination.y);
  return Math.max(8, Math.round(7 + gridDistance * 0.72));
}

export function rankPlaces(participants: Participant[], places: Place[]): RankedPlace[] {
  return places.map((place) => {
    const travelTimes = participants.map((person) => ({ participantId: person.id, name: person.name, minutes: estimateTravelMinutes(person.origin, place.point) ?? 99 }));
    const values = travelTimes.map(({ minutes }) => minutes);
    const maxMinutes = Math.max(...values);
    const spreadMinutes = maxMinutes - Math.min(...values);
    return { ...place, travelTimes, maxMinutes, spreadMinutes, score: maxMinutes * 2 + spreadMinutes };
  }).sort((a, b) => a.score - b.score || a.name.localeCompare(b.name));
}

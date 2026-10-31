import { Participant, Place } from '../../types';
import { RouteResult } from '../travel/types';

export function rankScheduledPlaces(people: Participant[], places: Place[], results: Record<string, RouteResult[]>) {
  return places.map((place) => {
    const routes = results[place.id] ?? [];
    const durations = people.map((person) => routes.find((result) => result.id === person.id && result.status === 'available')?.route?.durationSeconds);
    const complete = people.length > 0 && durations.every((seconds) => typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0);
    const max = complete ? Math.max(...durations as number[]) : null;
    const gap = complete ? max! - Math.min(...durations as number[]) : null;
    return { place, routes, complete, max, gap, score: complete ? max! * 2 + gap! : Infinity };
  // Keep the curated browse order until there is actual journey evidence.
  }).sort((a, b) => a.score - b.score || (a.complete && b.complete ? a.place.name.localeCompare(b.place.name) : 0));
}

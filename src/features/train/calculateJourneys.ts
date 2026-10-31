import { estimateTravelMinutes } from '../meet/ranking';
import { Participant, Place } from '../../types';

export type JourneyRecommendation = { participantId: string; name: string; home: string; travelMinutes: number; transfers: number; lastDepartureMinutes: number; leaveByMinutes: number };

export type PrototypeRouteStep = { label: string; detail: string };

export function calculateJourneys(participants: Participant[], venue: Place, safetyMinutes: number): JourneyRecommendation[] {
  return participants.map((person) => {
    const travelMinutes = estimateTravelMinutes(person.origin, venue.point) ?? 60;
    const transfers = travelMinutes >= 34 ? 1 : 0;
    const lastArrivalMinutes = 24 * 60 + (transfers ? 10 : 20);
    const lastDepartureMinutes = lastArrivalMinutes - travelMinutes;
    return { participantId: person.id, name: person.name, home: person.origin, travelMinutes, transfers, lastDepartureMinutes, leaveByMinutes: lastDepartureMinutes - 8 - safetyMinutes };
  });
}

export function formatClock(totalMinutes: number) {
  const normalized = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const hour24 = Math.floor(normalized / 60);
  const minute = normalized % 60;
  return `${hour24 % 12 || 12}:${String(minute).padStart(2, '0')} ${hour24 >= 12 ? 'pm' : 'am'}`;
}

export function buildPrototypeRouteSteps(journey: JourneyRecommendation, venue: Place): PrototypeRouteStep[] {
  const transferDetail = journey.transfers === 0
    ? 'The prototype estimate assumes no interchange.'
    : `The prototype estimate includes about ${journey.transfers} interchange${journey.transfers === 1 ? '' : 's'}.`;

  return [
    { label: `Leave by ${formatClock(journey.leaveByMinutes)}`, detail: `Head out from ${venue.name} with the saved safety buffer included.` },
    { label: `Walk to ${venue.nearestStation}`, detail: 'Allow about 8 minutes for the walk from the venue.' },
    { label: `Tap in by ${formatClock(journey.lastDepartureMinutes)}`, detail: `${transferDetail} Check live directions before leaving.` },
    { label: `Alight at ${journey.home} MRT`, detail: 'Google Maps will show the current line, stops, interchange, and walking directions.' },
  ];
}

export function createGoogleMapsTransitUrl(venue: Place, homeStation: string) {
  const origin = encodeURIComponent(`${venue.name}, ${venue.area}, Singapore`);
  const destination = encodeURIComponent(`${homeStation} MRT Station, Singapore`);
  const originPlaceId = venue.providerPlaceId ? `&origin_place_id=${encodeURIComponent(venue.providerPlaceId)}` : '';
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}${originPlaceId}&destination=${destination}&travelmode=transit`;
}

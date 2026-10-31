import { stationPoints } from '../../data/mocks';
import { Participant, Place } from '../../types';

type Point = { x: number; y: number };

export type RideGroup = {
  id: string;
  riders: Participant[];
  dropOrder: Participant[];
  routeKnown: boolean;
  estimatedFareCents: number;
  separateFareCents: number;
  savingCents: number;
  extraMinutes: number;
  perRiderFareCents: Record<string, number>;
  match: 'great' | 'okay' | 'solo';
};

export type RidePlan = {
  groups: RideGroup[];
  estimatedFareCents: number;
  separateFareCents: number;
  savingCents: number;
};

export function planSharedRides(participants: Participant[], venue: Place): RidePlan {
  const candidates = participants.flatMap((first, firstIndex) => participants.slice(firstIndex + 1).map((second) => {
    const firstPoint = stationPoints[first.origin];
    const secondPoint = stationPoints[second.origin];
    if (!firstPoint || !secondPoint || !areCompatible(venue.point, firstPoint, secondPoint)) return null;
    const route = bestDropOrder(venue.point, first, firstPoint, second, secondPoint);
    const separateFareCents = estimateRideFareCents(distance(venue.point, firstPoint)) + estimateRideFareCents(distance(venue.point, secondPoint));
    const estimatedFareCents = estimateRideFareCents(route.distance);
    return { first, second, route, separateFareCents, estimatedFareCents, savingCents: Math.max(0, separateFareCents - estimatedFareCents) };
  }).filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate)))
    .sort((a, b) => b.savingCents - a.savingCents || a.route.distance - b.route.distance);

  const assigned = new Set<string>();
  const groups: RideGroup[] = [];
  for (const candidate of candidates) {
    if (assigned.has(candidate.first.id) || assigned.has(candidate.second.id)) continue;
    assigned.add(candidate.first.id);
    assigned.add(candidate.second.id);
    const riders = [candidate.first, candidate.second];
    groups.push({
      id: riders.map((rider) => rider.id).sort().join(':'),
      riders,
      dropOrder: candidate.route.order,
      routeKnown: true,
      estimatedFareCents: candidate.estimatedFareCents,
      separateFareCents: candidate.separateFareCents,
      savingCents: candidate.savingCents,
      extraMinutes: candidate.route.extraMinutes,
      perRiderFareCents: splitCents(candidate.estimatedFareCents, riders),
      match: candidate.savingCents >= 600 && candidate.route.extraMinutes <= 12 ? 'great' : 'okay',
    });
  }

  for (const rider of participants.filter((participant) => !assigned.has(participant.id))) {
    const destination = stationPoints[rider.origin];
    const fare = destination ? estimateRideFareCents(distance(venue.point, destination)) : 0;
    groups.push({
      id: rider.id,
      riders: [rider],
      dropOrder: [rider],
      routeKnown: Boolean(destination),
      estimatedFareCents: fare,
      separateFareCents: fare,
      savingCents: 0,
      extraMinutes: 0,
      perRiderFareCents: { [rider.id]: fare },
      match: 'solo',
    });
  }

  const estimatedFareCents = groups.reduce((sum, group) => sum + group.estimatedFareCents, 0);
  const separateFareCents = groups.reduce((sum, group) => sum + group.separateFareCents, 0);
  return { groups, estimatedFareCents, separateFareCents, savingCents: Math.max(0, separateFareCents - estimatedFareCents) };
}

export function createDrivingRouteUrl(venue: Place, group: RideGroup) {
  const stops = group.dropOrder.map((rider) => `${rider.origin} MRT Station, Singapore`);
  const params = [
    'api=1',
    `origin=${encodeURIComponent(`${venue.name}, ${venue.area}, Singapore`)}`,
    `destination=${encodeURIComponent(stops.at(-1) ?? `${venue.name}, Singapore`)}`,
    'travelmode=driving',
  ];
  if (venue.providerPlaceId) params.push(`origin_place_id=${encodeURIComponent(venue.providerPlaceId)}`);
  if (stops.length > 1) params.push(`waypoints=${encodeURIComponent(stops.slice(0, -1).join('|'))}`);
  return `https://www.google.com/maps/dir/?${params.join('&')}`;
}

function areCompatible(venue: Point, first: Point, second: Point) {
  const firstVector = { x: first.x - venue.x, y: first.y - venue.y };
  const secondVector = { x: second.x - venue.x, y: second.y - venue.y };
  const firstLength = Math.hypot(firstVector.x, firstVector.y);
  const secondLength = Math.hypot(secondVector.x, secondVector.y);
  if (!firstLength || !secondLength || distance(first, second) > 24) return false;
  const directionSimilarity = (firstVector.x * secondVector.x + firstVector.y * secondVector.y) / (firstLength * secondLength);
  return directionSimilarity >= 0.45;
}

function bestDropOrder(venue: Point, first: Participant, firstPoint: Point, second: Participant, secondPoint: Point) {
  const between = distance(firstPoint, secondPoint);
  const firstThenSecond = distance(venue, firstPoint) + between;
  const secondThenFirst = distance(venue, secondPoint) + between;
  if (firstThenSecond <= secondThenFirst) {
    return { order: [first, second], distance: firstThenSecond, extraMinutes: Math.max(0, Math.round((firstThenSecond - distance(venue, secondPoint)) * 0.72)) };
  }
  return { order: [second, first], distance: secondThenFirst, extraMinutes: Math.max(0, Math.round((secondThenFirst - distance(venue, firstPoint)) * 0.72)) };
}

function estimateRideFareCents(gridDistance: number) {
  return Math.round((450 + gridDistance * 42) / 10) * 10;
}

function splitCents(total: number, riders: Participant[]) {
  const share = Math.floor(total / riders.length);
  let remainder = total % riders.length;
  return Object.fromEntries(riders.map((rider) => [rider.id, share + (remainder-- > 0 ? 1 : 0)]));
}

function distance(first: Point, second: Point) {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

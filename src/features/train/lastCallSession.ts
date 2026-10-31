import { GeoLocation } from '../../types';
import { validLocation } from '../travel/types';
import { LatestResult, tonightEnd } from './latestSearch';

export type JourneySlot = {
  signature: string;
  result: LatestResult;
  disruption?: boolean;
};

const journeys = new Map<string, Map<string, JourneySlot>>();
const groupOrigins = new Map<string, GeoLocation | undefined>();

export function resetLastCallSession() {
  journeys.clear();
  groupOrigins.clear();
}

export function journeySignature(origin: GeoLocation | undefined, location: GeoLocation | undefined, windowEnd: string) {
  return JSON.stringify([origin ?? null, location ?? null, windowEnd]);
}

export function sameRouteSteps(previous?: LatestResult, next?: LatestResult) {
  return JSON.stringify(previous?.route?.steps ?? null) === JSON.stringify(next?.route?.steps ?? null);
}

/** Keep journeys whose origin, home, and night window are unchanged. Everyone else is fetched. */
export function reconcileJourneys(cached: Iterable<[string, JourneySlot]> | undefined, people: { id: string; signature: string }[]) {
  const byId = new Map(cached ?? []);
  const kept: Record<string, LatestResult> = {};
  const disruptions: Record<string, boolean> = {};
  const missingIds: string[] = [];
  for (const person of people) {
    const slot = byId.get(person.id);
    if (!slot || slot.signature !== person.signature) {
      missingIds.push(person.id);
      continue;
    }
    kept[person.id] = slot.result;
    if (typeof slot.disruption === 'boolean') disruptions[person.id] = slot.disruption;
  }
  return { kept, disruptions, missingIds };
}

export function peekJourneys(scope: string) {
  return journeys.get(scope);
}

export function saveJourney(scope: string, id: string, slot: JourneySlot) {
  let bucket = journeys.get(scope);
  if (!bucket) {
    bucket = new Map();
    journeys.set(scope, bucket);
  }
  const previous = bucket.get(id);
  const carryDisruption = slot.disruption !== undefined ? slot.disruption : sameRouteSteps(previous?.result, slot.result) ? previous?.disruption : undefined;
  bucket.set(id, { ...slot, disruption: carryDisruption });
}

export function saveDisruption(scope: string, id: string, signature: string, disruption: boolean) {
  const slot = journeys.get(scope)?.get(id);
  if (!slot || slot.signature !== signature) return;
  slot.disruption = disruption;
}

/** Undefined means this party has not been read yet. A hit may still have no custom pin. */
export function readGroupOrigin(code: string): { location: GeoLocation | undefined } | undefined {
  if (!groupOrigins.has(code)) return undefined;
  return { location: groupOrigins.get(code) };
}

export function writeGroupOrigin(code: string, location: GeoLocation | undefined) {
  groupOrigins.set(code, location);
}

/** Last Call stays mounted across tab changes. A new party entry starts it over. */
export function retainLastCall(alive: boolean, epoch: number, tab: string, entryVersion: number) {
  if (epoch !== entryVersion) return { epoch: entryVersion, alive: tab === 'train' };
  return { epoch, alive: alive || tab === 'train' };
}

/** Keep the last group countdown on screen while a roster patch is still in flight. */
export function shownGroupDeadline(ready: number, pending: boolean, remembered: number) {
  if (Number.isFinite(ready)) return ready;
  return pending && Number.isFinite(remembered) ? remembered : NaN;
}

/** One search attempt for a person, keyed by the route we started from. */
export function journeyAttemptToken(id: string, buffer: number, signature: string, startAt?: string) {
  return `${id}:${buffer}:${signature}:${startAt ?? ''}`;
}

/**
 * Who still needs a provider search. An attempt is recorded only after that
 * person's result is stored, so a cancelled batch can retry the people it skipped.
 */
export function journeyFetchIds(missingIds: string[], staleIds: string[], attempted: ReadonlySet<string>, tokenFor: (id: string) => string) {
  return [...new Set([...missingIds, ...staleIds])].filter((id) => !attempted.has(tokenFor(id)));
}

/**
 * Earliest validated leave-by among people who have a home. A friend without a
 * home does not hide the clock. A finished check with no route is empty for
 * that person only (`pending: false`). NaN while a homed friend is still
 * unchecked. A past leave-by is a real result (the overdue clock).
 */
export function sharedLeaveBy(members: { home: boolean; leaveBy: number; pending?: boolean }[]) {
  const travelling = members.filter((member) => member.home);
  const stillOpen = (member: { leaveBy: number; pending?: boolean }) => member.pending ?? !Number.isFinite(member.leaveBy);
  if (!travelling.length || travelling.some(stillOpen)) return NaN;
  const times = travelling.map((member) => member.leaveBy).filter((value) => Number.isFinite(value));
  if (!times.length) return NaN;
  return Math.min(...times);
}

const sgtHour = (ms: number) => new Date(ms + 8 * 3600_000).getUTCHours();

/**
 * The saved party leave-by. NaN when the plan has no commute time yet.
 * A post-midnight clock time saved on today's date is this morning. From 4pm
 * until 4am SGT that same clock time is the morning that ends tonight, so
 * 12:52am viewed at 11:33pm counts forward about 1h19m and reads as the next
 * calendar morning. A daytime leave-by, and this morning checked after dawn,
 * stay on the stored instant — including when that is genuinely overdue.
 */
export function partyLeaveBy(commuteAt?: string | null, now = Date.now()) {
  const value = Date.parse(commuteAt ?? '');
  if (!Number.isFinite(value)) return Number.NaN;
  if (!(value < now) || sgtHour(value) >= 4) return value;
  const hourNow = sgtHour(now);
  if (!(hourNow >= 16 || hourNow < 4)) return value;
  const shifted = value + 24 * 3600_000;
  const end = tonightEnd(now);
  if (shifted >= end - 4 * 3600_000 && shifted <= end) return shifted;
  return value;
}

/** A later search that finds nothing must not erase the ride already on screen. A limit error must not keep a route to the wrong place. */
export function keepShownRoute(previous: LatestResult | undefined, next: LatestResult): LatestResult {
  if (next.error && /limit|quota/i.test(next.error)) return { ...next, route: undefined };
  if (next.route || !previous?.route) return next;
  return { ...next, route: previous.route };
}

/** Header under the journeys. Do not claim a route was found when none is shown. */
export function lastCallSummary(routesFound: boolean) {
  return routesFound ? 'Latest route found · last service not guaranteed' : 'No late route yet · last service not guaranteed';
}

/**
 * Who Last Call can search. Someone without a home stays on the roster for
 * their own row. They do not stop the search or the group clock.
 */
export function lastCallHomeGate<T>(people: readonly T[]) {
  const ready: T[] = [];
  const waiting: T[] = [];
  for (const person of people) {
    const location = person && typeof person === 'object' && 'location' in person ? person.location : undefined;
    (validLocation(location) ? ready : waiting).push(person);
  }
  return { ready, waiting, canSearch: ready.length > 0 };
}

/**
 * Group copy above the journeys. Null when anyone already has a home — the
 * screen must not tell the party to wait until every home is set.
 * When nobody has a home yet, name them without that wait.
 */
export function lastCallGroupNotice(people: { name?: string; location?: unknown }[]): string | null {
  const { canSearch, waiting } = lastCallHomeGate(people);
  if (canSearch || waiting.length === 0) return null;
  const names = waiting.map((person) => person.name?.trim() || 'this person').join(', ');
  return `Add a home location for ${names}.`;
}

/** Own-row cue. A missing home wins over a missing start, so it stays on that row. */
export function lastCallRowCue(location: unknown, originReady: boolean): string | null {
  if (!validLocation(location)) return 'Add home location';
  if (!originReady) return 'Choose starting point';
  return null;
}

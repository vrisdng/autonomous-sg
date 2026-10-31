import { expect, it } from 'vitest';
import { GeoLocation } from '../../types';
import { LatestResult } from './latestSearch';
import { clock } from '../travel/types';
import { journeyAttemptToken, journeyFetchIds, journeySignature, keepShownRoute, lastCallGroupNotice, lastCallHomeGate, lastCallRowCue, lastCallSummary, partyLeaveBy, peekJourneys, reconcileJourneys, resetLastCallSession, retainLastCall, saveDisruption, saveJourney, sharedLeaveBy, shownGroupDeadline } from './lastCallSession';

const origin: GeoLocation = { label: 'Lau Pa Sat', latitude: 1.28, longitude: 103.85 };
const home: GeoLocation = { label: 'Home', latitude: 1.35, longitude: 103.82 };
const other: GeoLocation = { label: 'Other home', latitude: 1.4, longitude: 103.9 };
const windowEnd = '2026-10-02T20:00:00.000Z';
const result: LatestResult = { checks: 2, complete: true, windowEnd, route: { source: 'onemap', checkedAt: windowEnd, startAt: windowEnd, endAt: windowEnd, durationSeconds: 60, steps: [] } };

function person(id: string, location: GeoLocation = home) {
  return { id, signature: journeySignature(origin, location, windowEnd) };
}

it('keeps the last countdown when the roster is unchanged', () => {
  const cached = new Map([['ada', { signature: person('ada').signature, result, disruption: false }]]);
  const next = reconcileJourneys(cached, [person('ada')]);
  expect(next.missingIds).toEqual([]);
  expect(next.kept.ada).toBe(result);
  expect(next.disruptions.ada).toBe(false);
});

it('patches a new person and a changed home without dropping everyone else', () => {
  const cached = new Map([
    ['ada', { signature: person('ada').signature, result, disruption: false }],
    ['lex', { signature: person('lex').signature, result, disruption: false }],
  ]);
  const next = reconcileJourneys(cached, [person('ada'), person('lex', other), person('jun')]);
  expect(next.kept.ada).toBe(result);
  expect(next.disruptions.ada).toBe(false);
  expect(next.kept.lex).toBeUndefined();
  expect(next.missingIds).toEqual(['lex', 'jun']);
});

it('does not restore a countdown for a different origin', () => {
  const cached = new Map([['ada', { signature: person('ada').signature, result, disruption: false }]]);
  const moved = journeySignature({ ...origin, label: 'Elsewhere' }, home, windowEnd);
  const next = reconcileJourneys(cached, [{ id: 'ada', signature: moved }]);
  expect(next.kept).toEqual({});
  expect(next.missingIds).toEqual(['ada']);
});

it('remembers a service verdict only for the journey that produced it', () => {
  resetLastCallSession();
  const signature = person('ada').signature;
  saveJourney('party', 'ada', { signature, result });
  saveDisruption('party', 'ada', signature, false);
  saveDisruption('party', 'ada', 'stale', true);
  expect(reconcileJourneys(peekJourneys('party'), [person('ada')]).disruptions.ada).toBe(false);
  saveJourney('party', 'ada', { signature, result: { ...result, route: { ...result.route!, steps: [{ mode: 'BUS', from: 'A', to: 'B', instruction: 'Bus', durationSeconds: 1 }] } } });
  expect(peekJourneys('party')?.get('ada')?.disruption).toBeUndefined();
});

it('keeps Last Call alive across tab changes and resets it for a new party entry', () => {
  expect(retainLastCall(false, 0, 'home', 0)).toEqual({ epoch: 0, alive: false });
  expect(retainLastCall(false, 0, 'train', 0)).toEqual({ epoch: 0, alive: true });
  expect(retainLastCall(true, 0, 'meet', 0)).toEqual({ epoch: 0, alive: true });
  expect(retainLastCall(true, 0, 'meet', 1)).toEqual({ epoch: 1, alive: false });
  expect(retainLastCall(true, 0, 'train', 1)).toEqual({ epoch: 1, alive: true });
});

it('retries a friend whose search was cancelled and skips a finished attempt', () => {
  const ada = journeyAttemptToken('ada', 15, person('ada').signature, undefined);
  const attempted = new Set([ada]);
  expect(journeyFetchIds(['ada', 'lex'], [], attempted, (id) => journeyAttemptToken(id, 15, person(id).signature, undefined))).toEqual(['lex']);
  const later = '2026-10-02T18:00:00.000Z';
  expect(journeyFetchIds([], ['ada'], attempted, (id) => journeyAttemptToken(id, 15, person(id).signature, later))).toEqual(['ada']);
});

it('shows the shared leave-by for people who have homes, including when it is overdue', () => {
  const overdue = Date.parse('2026-10-02T12:00:00Z');
  const later = overdue + 20 * 60000;
  expect(sharedLeaveBy([
    { home: true, leaveBy: later },
    { home: true, leaveBy: overdue },
    { home: false, leaveBy: NaN },
  ])).toBe(overdue);
  expect(sharedLeaveBy([
    { home: true, leaveBy: later },
    { home: true, leaveBy: NaN },
  ])).toBeNaN();
  expect(sharedLeaveBy([{ home: false, leaveBy: later }])).toBeNaN();
  expect(sharedLeaveBy([
    { home: true, leaveBy: overdue, pending: false },
    { home: true, leaveBy: Number.NaN, pending: false },
    { home: false, leaveBy: Number.NaN, pending: false },
  ])).toBe(overdue);
  expect(sharedLeaveBy([
    { home: true, leaveBy: Number.NaN, pending: false },
    { home: false, leaveBy: later },
  ])).toBeNaN();
});

it('keeps the ride on screen when a later search finds nothing', () => {
  const empty: LatestResult = { checks: 4, complete: true, windowEnd };
  expect(keepShownRoute(result, empty).route).toBe(result.route);
  expect(keepShownRoute(undefined, empty).route).toBeUndefined();
  const later = { ...result, route: { ...result.route!, startAt: '2026-10-02T18:00:00.000Z' } };
  expect(keepShownRoute(result, later).route?.startAt).toBe('2026-10-02T18:00:00.000Z');
  const limited = { ...empty, error: 'Free routing request limit reached. Please try again later.' };
  expect(keepShownRoute(result, limited).route).toBeUndefined();
});

it('uses the saved leave-by instead of a last-train clock', () => {
  expect(partyLeaveBy('2026-10-03T09:35:00.000Z')).toBe(Date.parse('2026-10-03T09:35:00.000Z'));
  expect(partyLeaveBy('2026-10-03T09:35:00+00:00')).toBe(Date.parse('2026-10-03T09:35:00.000Z'));
  expect(partyLeaveBy(undefined)).toBeNaN();
});

it('counts a 12:52am leave-by forward at 11:33pm instead of this morning', () => {
  const now = Date.parse('2026-10-03T15:33:00.000Z');
  const thisMorning = '2026-10-02T16:52:00.000Z';
  const comingMorning = Date.parse('2026-10-03T16:52:00.000Z');
  const leave = partyLeaveBy(thisMorning, now);
  expect(leave).toBe(comingMorning);
  expect(leave - now).toBe(79 * 60 * 1000);
  expect(clock(new Date(leave).toISOString())).toBe('4 Oct, 12:52 am');
});

it('keeps a leave-by overdue when it is actually past, not one day early', () => {
  const evening = Date.parse('2026-10-03T15:33:00.000Z');
  const afternoon = '2026-10-03T07:00:00.000Z';
  expect(partyLeaveBy(afternoon, evening)).toBe(Date.parse(afternoon));
  const midMorning = Date.parse('2026-10-03T02:00:00.000Z');
  const alreadyDawn = '2026-10-02T16:52:00.000Z';
  expect(partyLeaveBy(alreadyDawn, midMorning)).toBe(Date.parse(alreadyDawn));
  const justAfter = Date.parse('2026-10-03T17:00:00.000Z');
  expect(partyLeaveBy('2026-10-03T16:52:00.000Z', justAfter)).toBe(Date.parse('2026-10-03T16:52:00.000Z'));
  expect(partyLeaveBy(alreadyDawn, justAfter)).toBe(Date.parse('2026-10-03T16:52:00.000Z'));
});

it('does not say a route was found when the rows have none', () => {
  expect(lastCallSummary(true)).toBe('Latest route found · last service not guaranteed');
  expect(lastCallSummary(false)).toBe('No late route yet · last service not guaranteed');
  expect(lastCallSummary(false)).not.toMatch(/Latest route found/);
});

it('searches and shows leave-by for members who have homes when someone else does not', () => {
  const ada = { id: 'ada', name: 'Ada', location: home };
  const bo = { id: 'bo', name: 'Bo', location: other };
  const ghost = { id: 'ghost', name: 'Ghost' };
  const gate = lastCallHomeGate([ada, bo, ghost]);
  expect(gate.canSearch).toBe(true);
  expect(gate.ready.map((person) => person.id)).toEqual(['ada', 'bo']);
  expect(gate.waiting.map((person) => person.id)).toEqual(['ghost']);
  expect(lastCallGroupNotice([ada, bo, ghost])).toBeNull();
  expect(lastCallRowCue(undefined, true)).toBe('Add home location');
  expect(lastCallRowCue(undefined, false)).toBe('Add home location');
  expect(lastCallRowCue(ada.location, false)).toBe('Choose starting point');
  expect(lastCallRowCue(ada.location, true)).toBeNull();
  const overdue = Date.parse('2026-10-02T12:00:00Z');
  const later = overdue + 20 * 60000;
  expect(sharedLeaveBy([
    { home: true, leaveBy: later },
    { home: true, leaveBy: overdue },
    { home: false, leaveBy: Number.NaN },
  ])).toBe(overdue);
});

it('does not tell the party to wait for every home when nobody has one yet', () => {
  const notice = lastCallGroupNotice([{ name: 'Ghost' }, { name: 'Lex' }]);
  expect(notice).toBe('Add a home location for Ghost, Lex.');
  expect(notice).not.toMatch(/before checking/i);
  expect(notice).not.toMatch(/Home needed/i);
  expect(lastCallHomeGate([{ name: 'Ghost' }]).canSearch).toBe(false);
  expect(lastCallGroupNotice([])).toBeNull();
});

it('holds the previous group countdown only while a patch is still running', () => {
  expect(shownGroupDeadline(1000, false, 500)).toBe(1000);
  expect(shownGroupDeadline(Number.NaN, true, 500)).toBe(500);
  expect(shownGroupDeadline(Number.NaN, false, 500)).toBeNaN();
});

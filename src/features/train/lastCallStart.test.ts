import { expect, it } from 'vitest';
import { GeoLocation, PlanDraft } from '../../types';
import { applyOwnStartingPoint, lastCallRouteOrigin, originMissing, showLastCallStart } from './lastCallStart';

const home: GeoLocation = { label: '221 Bukit Batok East Avenue 3 Singapore 650221', latitude: 1.35, longitude: 103.75 };
const lexHome: GeoLocation = { label: 'Bedok MRT', latitude: 1.32, longitude: 103.93 };
const here: GeoLocation = { label: 'Current location', latitude: 1.28, longitude: 103.85 };
const venue: GeoLocation = { label: 'Lau Pa Sat', latitude: 1.28, longitude: 103.85 };

function plan(people: PlanDraft['participants']): PlanDraft {
  return { code: 'P2W585', participants: people, remote: { role: 'host', participantId: 'wn', published: true } };
}

it('treats a blank origin as missing and a saved home label as set', () => {
  expect(originMissing('')).toBe(true);
  expect(originMissing('  ')).toBe(true);
  expect(originMissing('Location not set')).toBe(true);
  expect(originMissing('Not set')).toBe(true);
  expect(originMissing(home.label)).toBe(false);
});

it('asks for a starting point when none was saved, even if this person already has a home', () => {
  expect(showLastCallStart(undefined, { origin: home.label })).toBe(true);
  expect(showLastCallStart(undefined, { origin: '' })).toBe(true);
  expect(showLastCallStart(here, { origin: '' })).toBe(true);
  expect(showLastCallStart(here, { origin: 'Location not set' })).toBe(true);
  expect(showLastCallStart(here, undefined)).toBe(false);
  expect(showLastCallStart(here, { origin: home.label })).toBe(false);
});

it('refreshes the route from the new pin instead of the venue', () => {
  expect(lastCallRouteOrigin(undefined, false, venue)).toBeUndefined();
  expect(lastCallRouteOrigin(undefined, true, venue)).toBe(venue);
  expect(lastCallRouteOrigin(here, true, venue)).toBe(here);
});

it('keeps an existing home and everyone else’s home when this person sets a starting point', () => {
  const next = applyOwnStartingPoint(plan([
    { id: 'wn', name: 'Wn', origin: home.label, location: home },
    { id: 'lex', name: 'Lex', origin: 'Bedok MRT', location: lexHome },
  ]), here, 'wn');
  expect(next.participants.find((person) => person.id === 'wn')).toMatchObject({ origin: 'Current location', location: home });
  expect(next.participants.find((person) => person.id === 'lex')).toMatchObject({ origin: 'Bedok MRT', location: lexHome, name: 'Lex' });
});

it('fills origin and home together when this person has no origin yet', () => {
  const next = applyOwnStartingPoint(plan([
    { id: 'wn', name: 'Wn', origin: '' },
    { id: 'lex', name: 'Lex', origin: 'Bedok MRT', location: lexHome },
  ]), here, 'wn');
  const wn = next.participants.find((person) => person.id === 'wn');
  expect(wn?.origin).toBe('Current location');
  expect(wn?.location).toEqual({ label: 'Current location', latitude: 1.28, longitude: 103.85 });
  expect(next.participants.find((person) => person.id === 'lex')?.location).toEqual(lexHome);
});

it('does not invent a row or rewrite someone else when the actor is missing', () => {
  const current = plan([{ id: 'lex', name: 'Lex', origin: 'Bedok MRT', location: lexHome }]);
  expect(applyOwnStartingPoint(current, here, 'wn')).toBe(current);
  expect(applyOwnStartingPoint(current, { label: 'Elsewhere', latitude: 40, longitude: -74 }, 'lex')).toBe(current);
});

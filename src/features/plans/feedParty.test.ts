import { describe, expect, it } from 'vitest';
import { verifiedVenues } from '../../data/venues';
import { PlanDraft } from '../../types';
import { feedParty } from './feedParty';

const person = { id: 'p1', name: 'Mei', origin: 'Bishan', transportMode: 'either' as const };
const plan: PlanDraft = { code: 'ABC234', participants: [person] };

describe('feed party strip', () => {
  it('has nothing to return to before anyone joins', () => {
    expect(feedParty(null)).toBeNull();
    expect(feedParty({ ...plan, participants: [] })).toBeNull();
  });
  it('drops closed and expired parties', () => {
    expect(feedParty({ ...plan, status: 'closed' })).toBeNull();
    expect(feedParty({ ...plan, expiresAt: '2026-10-31T00:00:00Z' }, Date.parse('2026-10-31T00:00:01Z'))).toBeNull();
    expect(feedParty({ ...plan, expiresAt: '2026-10-31T00:00:02Z' }, Date.parse('2026-10-31T00:00:01Z'))).not.toBeNull();
  });
  it('only calls a published outing a party', () => {
    expect(feedParty(plan)?.kicker).toBe('DRAFT ON THIS DEVICE · 1 KAKI');
    expect(feedParty({ ...plan, participants: [person, { ...person, id: 'p2' }], remote: { role: 'host', published: true } })?.kicker).toBe('PARTY ABC234 · 2 KAKIS');
  });
  it('shows the chosen venue, and ignores unconfirmed sources', () => {
    const venue = verifiedVenues[0]!;
    expect(feedParty(plan)?.title).toBe('Still choosing where to makan');
    expect(feedParty({ ...plan, chosenVenue: venue })?.title).toBe(venue.name);
    expect(feedParty({ ...plan, chosenVenue: { ...venue, source: 'prototype' } })?.title).toBe('Still choosing where to makan');
  });
});

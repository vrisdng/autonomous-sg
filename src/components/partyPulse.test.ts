import { describe, expect, it } from 'vitest';
import { buildPartyPulse, type PulseDeck } from './partyPulse';
import { PlanDraft } from '../types';

const deck: PulseDeck = {
  venues: [{ id: 'a' }, { id: 'b' }],
  voters: ['host', 'guest:mei'],
  swipes: [
    { voterId: 'host', venueId: 'a' },
    { voterId: 'guest:mei', venueId: 'a' },
    { voterId: 'guest:mei', venueId: 'b' },
  ],
};

function plan(people: { id: string; name: string }[], remote?: PlanDraft['remote']): PlanDraft {
  return {
    code: 'ABC234',
    participants: people.map((person) => ({ ...person, origin: '' })),
    remote,
  };
}

describe('Party pulse', () => {
  it('stays empty and honest when there is no party', () => {
    const pulse = buildPartyPulse(null, null, 'ready');
    expect(pulse.people).toEqual([]);
    expect(pulse.summary).toBe('No party yet');
    expect(pulse.note).toMatch(/no party/i);
    expect(pulse.note.toLowerCase()).not.toContain('online');
  });

  it('lists party names without inventing online or swipe status', () => {
    const pulse = buildPartyPulse(plan([{ id: 'wei', name: ' Wei ' }, { id: 'mei', name: '' }]), null, 'ready');
    expect(pulse.people.map((person) => person.name)).toEqual(['Wei', 'Unnamed kaki']);
    expect(pulse.people.every((person) => person.kind === 'roster' && person.label === 'In the party')).toBe(true);
    expect(pulse.summary).toBe('2 in the party');
    expect(pulse.note).toMatch(/no swipe deck/i);
    expect(JSON.stringify(pulse).toLowerCase()).not.toContain('online');
  });

  it('marks you from this device’s saved participant', () => {
    const pulse = buildPartyPulse(plan([{ id: 'wei', name: 'Wei' }], { role: 'host', participantId: 'wei' }), null, 'ready');
    expect(pulse.people[0]).toMatchObject({ you: true, kind: 'roster' });
  });

  it('splits still swiping, quiet, and finished from the deck', () => {
    const pulse = buildPartyPulse(plan(
      [{ id: 'wei', name: 'Wei' }, { id: 'mei', name: 'Mei' }, { id: 'jun', name: 'Jun' }],
      { role: 'host', participantId: 'wei' },
    ), {
      ...deck,
      voters: ['host', 'guest:mei', 'guest:jun'],
      swipes: [...deck.swipes, { voterId: 'host', venueId: 'gone' }],
    }, 'ready');
    expect(pulse.people.map((person) => [person.name, person.kind, person.label])).toEqual([
      ['Wei', 'swiping', 'Still swiping · 1 of 2'],
      ['Mei', 'done', 'Done swiping'],
      ['Jun', 'quiet', 'Quiet · no swipes yet'],
    ]);
    expect(pulse.summary).toBe('1 swiping · 1 quiet · 1 finished');
    expect(pulse.note).toMatch(/not a live online light/i);
  });

  it('counts each person from their own swipes and keeps the host bucket off everyone else', () => {
    const ambiguous = buildPartyPulse(plan(
      [{ id: 'wei', name: 'Wei' }, { id: 'ada', name: 'Ada' }, { id: 'jun', name: 'Jun' }],
      { role: 'guest', participantId: 'ada' },
    ), { venues: [{ id: 'a' }], voters: ['host', 'guest:ada'], swipes: [{ voterId: 'host', venueId: 'a' }] }, 'ready');
    expect(ambiguous.people.find((person) => person.name === 'Wei')).toMatchObject({ kind: 'roster', label: 'In the party' });
    expect(ambiguous.people.find((person) => person.name === 'Jun')).toMatchObject({ kind: 'roster' });
    expect(ambiguous.people.find((person) => person.name === 'Ada')).toMatchObject({ kind: 'quiet', you: true });

    const hostDevice = buildPartyPulse(plan(
      [{ id: 'wei', name: 'Wei' }, { id: 'ada', name: 'Ada' }],
      { role: 'host', participantId: 'wei' },
    ), { venues: [{ id: 'a' }], voters: ['host'], swipes: [{ voterId: 'host', venueId: 'a' }] }, 'ready');
    expect(hostDevice.people.find((person) => person.name === 'Wei')).toMatchObject({ kind: 'done', you: true });
    expect(hostDevice.people.find((person) => person.name === 'Ada')).toMatchObject({ kind: 'roster', label: 'In the party' });

    const lone = buildPartyPulse(plan(
      [{ id: 'ada', name: 'Ada' }, { id: 'lex', name: 'Lex' }],
      { role: 'guest', participantId: 'ada' },
    ), {
      venues: [{ id: 'a' }, { id: 'b' }],
      voters: ['host', 'guest:ada'],
      swipes: [{ voterId: 'host', venueId: 'a' }, { voterId: 'host', venueId: 'b' }],
    }, 'ready');
    expect(lone.people.find((person) => person.name === 'Lex')).toMatchObject({ kind: 'roster', label: 'In the party' });
    expect(lone.people.find((person) => person.name === 'Ada')).toMatchObject({ kind: 'quiet' });

    const owned = buildPartyPulse(plan(
      [{ id: 'lex', name: 'Lex' }, { id: 'ada', name: 'Ada' }],
      { role: 'guest', participantId: 'lex' },
    ), {
      venues: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      voters: ['host', 'guest:lex', 'guest:ada'],
      swipes: [
        { voterId: 'guest:lex', venueId: 'a' },
        { voterId: 'guest:lex', venueId: 'b' },
        { voterId: 'guest:lex', venueId: 'c' },
        { voterId: 'host', venueId: 'a' },
      ],
    }, 'ready');
    expect(owned.people.find((person) => person.name === 'Lex')).toMatchObject({ kind: 'done' });
    expect(owned.people.find((person) => person.name === 'Ada')).toMatchObject({ kind: 'quiet' });
  });

  it('keeps the roster while swipe progress is loading or missing', () => {
    const members = plan([{ id: 'wei', name: 'Wei' }], { role: 'host', participantId: 'wei' });
    expect(buildPartyPulse(members, deck, 'loading').people[0]?.label).toBe('In the party');
    expect(buildPartyPulse(members, deck, 'loading').note).toMatch(/checking the swipe deck/i);
    expect(buildPartyPulse(members, null, 'unavailable').note).toMatch(/didn’t load/i);
    expect(buildPartyPulse(members, null, 'unavailable').people[0]?.kind).toBe('roster');
  });
});

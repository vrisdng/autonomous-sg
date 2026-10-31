import { describe, expect, it } from 'vitest';
import { activeParty, addFriendToPlan, isInParty, maxPartySize } from './friends';
import { PlanDraft } from '../../types';

const party = (changes: Partial<PlanDraft> = {}): PlanDraft => ({
  code: 'ABC234',
  participants: [{ id: 'host', name: 'Jie', origin: 'Location not set' }],
  remote: { role: 'host', hostToken: 'token', participantId: 'host', published: true },
  ...changes,
});

describe('addFriendToPlan', () => {
  it('adds a friend the server will accept, leaving the host untouched', () => {
    const next = addFriendToPlan(party(), ' Aisha ', 'friend');
    expect(next.participants).toHaveLength(2);
    expect(next.participants[0]).toEqual(party().participants[0]);
    expect(next.participants[1]).toEqual({ id: 'friend', name: 'Aisha', origin: 'Location not set', transportMode: 'either' });
  });

  it('does not add the same name twice, whatever the case', () => {
    const once = addFriendToPlan(party(), 'Aisha', 'first');
    expect(addFriendToPlan(once, 'aisha', 'second')).toBe(once);
    expect(isInParty(once, 'AISHA')).toBe(true);
  });

  it('stops at the server limit', () => {
    const participants = Array.from({ length: maxPartySize }, (_, index) => ({ id: String(index), name: `Person ${index}`, origin: '' }));
    expect(() => addFriendToPlan(party({ participants }), 'Aisha', 'friend')).toThrow('12 people');
  });
});

describe('activeParty', () => {
  const now = Date.parse('2026-10-31T12:00:00Z');

  it('accepts a published party for hosts and guests', () => {
    expect(activeParty(party(), now)?.code).toBe('ABC234');
    expect(activeParty(party({ remote: { role: 'guest', guestToken: 'token', published: true } }), now)?.code).toBe('ABC234');
    expect(activeParty(party({ expiresAt: '2026-11-01T12:00:00Z' }), now)?.code).toBe('ABC234');
  });

  it('ignores anything friends cannot join', () => {
    expect(activeParty(null, now)).toBeUndefined();
    expect(activeParty(party({ remote: undefined }), now)).toBeUndefined();
    expect(activeParty(party({ remote: { role: 'host', hostToken: 'token', published: false } }), now)).toBeUndefined();
    expect(activeParty(party({ status: 'closed' }), now)).toBeUndefined();
    expect(activeParty(party({ expiresAt: '2026-10-30T12:00:00Z' }), now)).toBeUndefined();
  });
});

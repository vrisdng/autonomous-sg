import { describe, expect, it } from 'vitest';
import { meetReady, meetSelf } from './meetReady';
import { PlanDraft } from '../../types';

const home = { label: 'Home', latitude: 1.3, longitude: 103.8 };
const person = (id: string, name: string, location?: typeof home) => ({ id, name, origin: location?.label ?? '', location, transportMode: 'either' as const });

describe('meet first step', () => {
  it('waits until this person has a name and a home pin', () => {
    const empty: PlanDraft = { code: 'ABC234', participants: [] };
    expect(meetReady(empty)).toBe(false);
    expect(meetReady({ ...empty, participants: [person('a', 'Ada')] })).toBe(false);
    expect(meetReady({ ...empty, participants: [person('a', '   ', home)] })).toBe(false);
    expect(meetReady({ ...empty, participants: [person('a', 'Ada', home)] })).toBe(true);
  });

  it('uses the signed-in guest, not someone else who already has a home', () => {
    const plan: PlanDraft = {
      code: 'ABC234',
      participants: [person('host', 'Host', home), person('guest', 'Gus')],
      remote: { role: 'guest', participantId: 'guest' },
    };
    expect(meetSelf(plan)?.id).toBe('guest');
    expect(meetReady(plan)).toBe(false);
    expect(meetReady({ ...plan, participants: [person('host', 'Host', home), person('guest', 'Gus', home)] })).toBe(true);
  });

  it('sends a returning host with a name and home straight to the cards', () => {
    const plan: PlanDraft = {
      code: 'ABC234',
      participants: [person('me', 'Ada', home), person('friend', 'Ben')],
      remote: { role: 'host', participantId: 'me', published: true },
    };
    expect(meetReady(plan)).toBe(true);
  });
});

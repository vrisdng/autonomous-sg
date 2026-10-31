import { describe, expect, it } from 'vitest';
import { preserveOtherParticipants, sameInstant } from './preserveRoster';
import { PlanDraft } from '../../types';

const bedok = { label: '315 New Upper Changi Road', latitude: 1.32, longitude: 103.93 };
const tampines = { label: '15 Tampines Central 1', latitude: 1.353, longitude: 103.945 };

function plan(people: PlanDraft['participants'], extra: Partial<PlanDraft> = {}): PlanDraft {
  return { code: 'DAPYCJ', participants: people, ...extra };
}

describe('preserve other participants', () => {
  it('treats equivalent timestamps as the same leave-by', () => {
    expect(sameInstant('2026-10-03T09:35:00.000Z', '2026-10-03T09:35:00+00:00')).toBe(true);
    expect(sameInstant('2026-10-03T09:35:00.000Z', '2026-10-03T09:07:00.000Z')).toBe(false);
    expect(sameInstant(undefined, '2026-10-03T09:35:00.000Z')).toBe(false);
  });

  it('applies only the actor home and keeps everyone else, including the host', () => {
    const server = plan([
      { id: 'ada', name: 'Ada', origin: 'Old', location: tampines },
      { id: 'lex', name: 'Lex', origin: 'Bedok MRT', location: bedok },
    ]);
    const local = plan([
      { id: 'ada', name: 'Ada', origin: 'Tampines MRT', location: tampines },
      { id: 'lex', name: 'Lex', origin: 'Tampines MRT', location: tampines },
    ]);
    const saved = preserveOtherParticipants(local, server, 'ada');
    expect(saved.participants.find((person) => person.id === 'lex')).toMatchObject({ origin: 'Bedok MRT', location: bedok, name: 'Lex' });
    expect(saved.participants.find((person) => person.id === 'ada')).toMatchObject({ origin: 'Tampines MRT', location: tampines });
  });

  it('puts the actor back when the local roster dropped the host', () => {
    const server = plan([{ id: 'lex', name: 'Lex', origin: 'Bedok MRT', location: bedok }]);
    const local = plan([{ id: 'ada', name: 'Ada', origin: 'Tampines MRT', location: tampines }]);
    const saved = preserveOtherParticipants(local, server, 'ada');
    expect(saved.participants.map((person) => person.id).sort()).toEqual(['ada', 'lex']);
    expect(saved.participants.find((person) => person.id === 'lex')?.location).toEqual(bedok);
  });
});

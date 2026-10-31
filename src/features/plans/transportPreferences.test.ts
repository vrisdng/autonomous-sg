import { describe, expect, it } from 'vitest';
import { participantsForTransport } from './transportPreferences';

const people = [
  { id: 'train', name: 'Train', origin: 'Bishan', transportMode: 'train' as const },
  { id: 'ride', name: 'Ride', origin: 'Bedok', transportMode: 'ride' as const },
  { id: 'either', name: 'Either', origin: 'Bugis', transportMode: 'either' as const },
];

describe('transport preferences', () => {
  it('includes either-mode people in both plans and excludes the opposite mode', () => {
    expect(participantsForTransport(people, 'train').map((person) => person.id)).toEqual(['train', 'either']);
    expect(participantsForTransport(people, 'ride').map((person) => person.id)).toEqual(['ride', 'either']);
  });
});

import { describe, expect, it } from 'vitest';
import { Place, Participant } from '../../types';
import { estimateTravelMinutes, rankPlaces } from './ranking';

const people: Participant[] = [
  { id: 'west', name: 'West', origin: 'Clementi' },
  { id: 'east', name: 'East', origin: 'Tampines' },
];

function place(id: string, name: string, x: number, y: number): Place {
  return { id, name, area: 'Test', nearestStation: 'Test MRT', detail: '', openUntil: 'late', tags: [], point: { x, y }, source: 'prototype' };
}

describe('meet ranking', () => {
  it('rejects an unknown station estimate without pretending it is live data', () => {
    expect(estimateTravelMinutes('Missing station', { x: 50, y: 50 })).toBeNull();
  });

  it('penalizes the longest trip and fairness spread', () => {
    const [result] = rankPlaces(people, [place('middle', 'Middle', 56, 47)]);
    expect(result?.score).toBe(result!.maxMinutes * 2 + result!.spreadMinutes);
    expect(result?.travelTimes).toHaveLength(2);
  });

  it('breaks equal-score ties by venue name for stable results', () => {
    const results = rankPlaces(people, [place('z', 'Zulu', 56, 47), place('a', 'Alpha', 56, 47)]);
    expect(results.map(({ name }) => name)).toEqual(['Alpha', 'Zulu']);
  });
});

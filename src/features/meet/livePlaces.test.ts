import { describe, expect, it } from 'vitest';
import { formatPlaceFreshness, parseLivePlaces } from './livePlaces';

describe('live place parsing', () => {
  it('normalises valid provider results and drops malformed ones', () => {
    const places = parseLivePlaces({ sourceTimestamp: '2026-09-14T12:30:00.000Z', places: [
      { id: 'abc', name: 'Night Noodles', address: 'Bugis, Singapore', latitude: 1.3, longitude: 103.85, isOpenNow: true, openUntil: '2:00 am', tags: ['Noodles'] },
      { id: 'missing-coordinates', name: 'No Map' },
    ] });
    expect(places).toHaveLength(1);
    expect(places[0]).toMatchObject({ id: 'google-abc', providerPlaceId: 'abc', source: 'google_places', isOpenNow: true });
    expect(places[0]?.point.x).toBeGreaterThan(0);
  });

  it('labels prototype data without implying it is live', () => {
    const place = parseLivePlaces({ places: [{ id: 'abc', name: 'Night Noodles', latitude: 1.3, longitude: 103.85 }] })[0]!;
    expect(formatPlaceFreshness({ ...place, source: 'prototype' })).toBe('Prototype venue and hours');
  });
});

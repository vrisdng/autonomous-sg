import { describe, expect, it } from 'vitest';
import { supperSpots } from '../../data/mocks';
import { createPlaceMapsUrl } from './maps';

describe('place map links', () => {
  it('creates a Google Maps search for prototype venues', () => {
    const url = new URL(createPlaceMapsUrl(supperSpots[0]!));
    expect(url.pathname).toBe('/maps/search/');
    expect(url.searchParams.get('query')).toContain('Swee Choon');
  });

  it('pins live results to their provider place id', () => {
    const url = new URL(createPlaceMapsUrl({ ...supperSpots[0]!, source: 'google_places', providerPlaceId: 'google-123' }));
    expect(url.searchParams.get('query_place_id')).toBe('google-123');
  });
});

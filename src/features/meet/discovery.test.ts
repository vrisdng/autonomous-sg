import { describe, expect, it } from 'vitest';
import { verifiedVenues } from '../../data/venues';
import { cuisine, matchesVenue, variedVenues, venueMapsUrl } from './discovery';
import { rankScheduledPlaces } from './scheduledRanking';

describe('venue discovery', () => {
  it('filters name, postcode, cuisine and area together without live-hours claims', () => {
    const place = verifiedVenues[0]!;
    expect(matchesVenue(place, '208882 dim', 'Dim sum', 'Jalan Besar')).toBe(true);
    expect(matchesVenue(place, '', 'Prata & curry', '')).toBe(false);
    expect(matchesVenue(place, '', '', 'Changi')).toBe(false);
  });
  it('starts with different food options rather than three branches of one chain', () => {
    const places = variedVenues(verifiedVenues);
    expect(new Set(places.slice(0, 3).map(cuisine)).size).toBe(3);
    expect(new Set(places.map((p) => p.id)).size).toBe(verifiedVenues.length);
    expect(rankScheduledPlaces([], places, {}).map((r) => r.place.id)).toEqual(places.map((p) => p.id));
  });
  it('links the restaurant name AND branch address, not just a building pin', () => {
    const place = verifiedVenues[0]!;
    const url = new URL(venueMapsUrl(place));
    expect(url.hostname).toBe('www.google.com');
    expect(url.searchParams.get('api')).toBe('1');
    expect(url.searchParams.get('query')).toContain(place.address);
    expect(url.searchParams.get('query')).toContain(place.name);
  });
});

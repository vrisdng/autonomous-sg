import { describe, expect, it } from 'vitest';
import { googleReference } from '../features/meet/googlePlace';
import { venuePhotoSource, verifiedVenues } from './venues';

describe('venue photos', () => {
  it('gives every checked venue a usable Google place', () => {
    for (const venue of verifiedVenues) {
      const source = venuePhotoSource(venue.id);
      expect(source, venue.id).toBeDefined();
      expect(googleReference({ source: 'google_places', providerPlaceId: source!.placeId })?.providerPlaceId).toBe(source!.placeId);
    }
  });
  it('only claims the branch it actually matched', () => {
    expect(verifiedVenues.filter((venue) => venuePhotoSource(venue.id)?.sameBranch).map((venue) => venue.id).sort()).toEqual(['azhar-bt', 'casuarina', 'prata-clementi', 'swee-jalan-besar']);
  });
  it('leaves Google and address results alone', () => {
    expect(venuePhotoSource('google-ChIJabc')).toBeUndefined();
    expect(venuePhotoSource('onemap-1.3-103.8')).toBeUndefined();
  });
});

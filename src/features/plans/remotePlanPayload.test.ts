import { describe, expect, it } from 'vitest';
import { parseRemotePlan } from './remotePlanPayload';

describe('parseRemotePlan', () => {
  it('keeps lifecycle status and expiry from the server payload', () => {
    expect(parseRemotePlan({
      code: 'abc234',
      chosen_venue_id: 'swee-choon',
      status: 'closed',
      expires_at: '2026-10-14T00:00:00.000Z',
      participants: [
        { id: 'p1', name: 'A', origin: 'Bedok', transportMode: 'either' },
        { id: 'p2', name: 'B', origin: 'Tampines', transportMode: 'either' },
      ],
    })).toEqual({
      code: 'ABC234',
      chosenVenueId: 'swee-choon',
      status: 'closed',
      expiresAt: '2026-10-14T00:00:00.000Z',
      participants: [
        { id: 'p1', name: 'A', origin: 'Bedok', transportMode: 'either' },
        { id: 'p2', name: 'B', origin: 'Tampines', transportMode: 'either' },
      ],
      syncedParticipants: [
        { id: 'p1', name: 'A', origin: 'Bedok', transportMode: 'either' },
        { id: 'p2', name: 'B', origin: 'Tampines', transportMode: 'either' },
      ],
    });
  });

  it('restores a shared live venue for every guest device', () => {
    const result = parseRemotePlan({
      code: 'abc234',
      chosen_venue_id: 'google-place-123',
      chosen_venue_source_timestamp: '2026-09-14T12:30:00.000Z',
      chosen_venue: { id: 'place-123', name: 'Night Noodles', address: 'Bugis, Singapore', latitude: 1.3, longitude: 103.85, isOpenNow: true },
      participants: [
        { id: 'p1', name: 'A', origin: 'Bedok' },
        { id: 'p2', name: 'B', origin: 'Tampines' },
      ],
    });
    expect(result.chosenVenue).toMatchObject({ id: 'google-place-123', providerPlaceId: 'place-123', source: 'google_places' });
    expect(result.chosenVenue?.latitude).toBeUndefined();
    expect(result.chosenVenue?.name).not.toBe('Night Noodles');
  });
});

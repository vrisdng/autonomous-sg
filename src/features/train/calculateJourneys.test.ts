import { describe, expect, it } from 'vitest';
import { Place, Participant } from '../../types';
import { buildPrototypeRouteSteps, calculateJourneys, createGoogleMapsTransitUrl, formatClock } from './calculateJourneys';

const venue: Place = { id: 'venue', name: 'Venue', area: 'Test', nearestStation: 'Test MRT', detail: '', openUntil: 'late', tags: [], point: { x: 59, y: 45 }, source: 'prototype' };

describe('last-train recommendations', () => {
  it('formats times on either side of midnight', () => {
    expect(formatClock(0)).toBe('12:00 am');
    expect(formatClock(24 * 60 + 5)).toBe('12:05 am');
    expect(formatClock(-5)).toBe('11:55 pm');
    expect(formatClock(12 * 60)).toBe('12:00 pm');
  });

  it('subtracts walking and the selected safety buffer from departure', () => {
    const participants: Participant[] = [{ id: 'p1', name: 'Weining', origin: 'Clementi' }];
    const journey = calculateJourneys(participants, venue, 15)[0]!;
    expect(journey?.leaveByMinutes).toBe(journey!.lastDepartureMinutes - 8 - 15);
  });

  it('builds a clearly labelled prototype route checklist', () => {
    const participants: Participant[] = [{ id: 'p1', name: 'Weining', origin: 'Clementi' }];
    const journey = calculateJourneys(participants, venue, 15)[0]!;

    expect(buildPrototypeRouteSteps(journey, venue)).toEqual([
      { label: `Leave by ${formatClock(journey.leaveByMinutes)}`, detail: 'Head out from Venue with the saved safety buffer included.' },
      { label: 'Walk to Test MRT', detail: 'Allow about 8 minutes for the walk from the venue.' },
      { label: `Tap in by ${formatClock(journey.lastDepartureMinutes)}`, detail: 'The prototype estimate assumes no interchange. Check live directions before leaving.' },
      { label: 'Alight at Clementi MRT', detail: 'Google Maps will show the current line, stops, interchange, and walking directions.' },
    ]);
  });

  it('creates a Google Maps transit route from the venue to the participant MRT', () => {
    const url = new URL(createGoogleMapsTransitUrl(venue, 'Clementi'));
    expect(url.origin).toBe('https://www.google.com');
    expect(url.pathname).toBe('/maps/dir/');
    expect(url.searchParams.get('api')).toBe('1');
    expect(url.searchParams.get('origin')).toBe('Venue, Test, Singapore');
    expect(url.searchParams.get('destination')).toBe('Clementi MRT Station, Singapore');
    expect(url.searchParams.get('travelmode')).toBe('transit');
  });

  it('uses the exact provider place id for a live venue route', () => {
    const url = new URL(createGoogleMapsTransitUrl({ ...venue, providerPlaceId: 'place-123' }, 'Bedok'));
    expect(url.searchParams.get('origin_place_id')).toBe('place-123');
  });
});

import { describe, expect, it, vi } from 'vitest';
import { verifiedVenues } from '../../data/venues';
import { Place } from '../../types';
import { ridePickup } from './rideOrigin';

const custom = { label: 'School gate', latitude: 1.3521, longitude: 103.9445 };

describe('ride pickup without a meetup', () => {
  it('uses a typed pickup when no meetup is chosen', () => {
    expect(ridePickup(undefined, custom)).toEqual(custom);
    expect(ridePickup(undefined, { label: 'Outside', latitude: 40, longitude: -74 })).toBeUndefined();
  });

  it('keeps the meetup pin as pickup and ignores a saved device pickup', async () => {
    vi.stubGlobal('__DEV__', false);
    const { placeLocation } = await import('../../data/travelProvider');
    const venue = verifiedVenues[0]!;
    expect(ridePickup(venue, custom)).toEqual(placeLocation(venue));
    vi.unstubAllGlobals();
  });

  it('does not replace an unresolved meetup pin with a typed pickup', () => {
    const pending = { ...verifiedVenues[0]!, latitude: undefined, longitude: undefined } as Place;
    expect(ridePickup(pending, custom)).toBeUndefined();
    const prototype = { ...verifiedVenues[0]!, source: 'prototype' as const };
    expect(ridePickup(prototype, custom)).toEqual(custom);
  });
});

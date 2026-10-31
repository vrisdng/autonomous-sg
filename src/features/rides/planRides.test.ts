import { describe, expect, it } from 'vitest';
import { supperSpots } from '../../data/mocks';
import { createDrivingRouteUrl, planSharedRides } from './planRides';

const venue = supperSpots[0]!;

describe('planSharedRides', () => {
  it('pairs people heading in the same direction and splits cents exactly', () => {
    const plan = planSharedRides([
      { id: 'bedok', name: 'Bea', origin: 'Bedok' },
      { id: 'tampines', name: 'Tam', origin: 'Tampines' },
      { id: 'clementi', name: 'Clem', origin: 'Clementi' },
    ], venue);
    const shared = plan.groups.find((group) => group.riders.length === 2)!;
    expect(shared.riders.map((rider) => rider.id).sort()).toEqual(['bedok', 'tampines']);
    expect(Object.values(shared.perRiderFareCents).reduce((sum, cents) => sum + cents, 0)).toBe(shared.estimatedFareCents);
    expect(plan.savingCents).toBeGreaterThan(0);
  });

  it('keeps people travelling in opposite directions in separate rides', () => {
    const plan = planSharedRides([
      { id: 'west', name: 'West', origin: 'Clementi' },
      { id: 'east', name: 'East', origin: 'Tampines' },
    ], venue);
    expect(plan.groups).toHaveLength(2);
    expect(plan.groups.every((group) => group.match === 'solo')).toBe(true);
  });

  it('builds a driving route with the first drop as a waypoint', () => {
    const group = planSharedRides([
      { id: 'bedok', name: 'Bea', origin: 'Bedok' },
      { id: 'tampines', name: 'Tam', origin: 'Tampines' },
    ], venue).groups[0]!;
    const url = new URL(createDrivingRouteUrl(venue, group));
    expect(url.searchParams.get('travelmode')).toBe('driving');
    expect(url.searchParams.get('waypoints')).toContain('MRT Station, Singapore');
    expect(url.searchParams.get('destination')).toContain('MRT Station, Singapore');
  });
});

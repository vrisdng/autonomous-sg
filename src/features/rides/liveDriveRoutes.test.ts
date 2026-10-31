import { describe, expect, it } from 'vitest';
import { parseLiveDriveRoutes } from './liveDriveRoutes';

describe('live driving routes', () => {
  it('normalises timestamped duration and distance', () => {
    expect(parseLiveDriveRoutes({ sourceTimestamp: '2026-09-14T12:00:00Z', routes: [{ groupId: 'a:b', durationMinutes: 24.7, distanceMeters: 13840 }] })).toEqual([
      { groupId: 'a:b', durationMinutes: 25, distanceKm: 13.8, sourceTimestamp: '2026-09-14T12:00:00Z' },
    ]);
  });
});

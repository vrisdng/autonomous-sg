import { describe, expect, it } from 'vitest';
import { liveLeaveBy, parseLiveJourneys } from './liveJourneys';

describe('live journeys', () => {
  it('normalises timestamped provider routes', () => {
    const routes = parseLiveJourneys({ sourceTimestamp: '2026-09-14T12:00:00Z', journeys: [{
      participantId: 'p1', durationMinutes: 34.4, departureTime: '2026-09-14T15:30:00Z', arrivalTime: '2026-09-14T16:04:00Z', transfers: 1, walkToTransitMinutes: 6,
      steps: [{ mode: 'TRANSIT', instruction: 'Take the train', line: 'Downtown Line' }],
    }] });
    expect(routes[0]).toMatchObject({ participantId: 'p1', durationMinutes: 34, transfers: 1, walkToTransitMinutes: 6, sourceTimestamp: '2026-09-14T12:00:00Z' });
    expect(liveLeaveBy(routes[0]!, 15).toISOString()).toBe('2026-09-14T15:09:00.000Z');
  });
});

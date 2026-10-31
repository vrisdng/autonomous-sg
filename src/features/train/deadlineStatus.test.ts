import { describe, expect, it } from 'vitest';
import { liveDeadlineStatus, prototypeDeadlineStatus } from './deadlineStatus';

describe('deadline status', () => {
  it('shows a useful countdown for an explicit live deadline', () => {
    expect(liveDeadlineStatus(new Date('2026-09-15T14:00:00Z'), new Date('2026-09-15T15:25:00Z')))
      .toEqual({ label: '1 hr 25 min left', state: 'safe' });
  });

  it('marks the last 30 minutes as urgent', () => {
    expect(liveDeadlineStatus(new Date('2026-09-15T15:00:00Z'), new Date('2026-09-15T15:20:00Z')).state).toBe('urgent');
  });

  it('treats after-midnight time as part of the previous supper night', () => {
    expect(prototypeDeadlineStatus(new Date('2026-09-14T16:30:00Z'), 23 * 60))
      .toEqual({ label: 'Last train window likely passed', state: 'missed' });
  });

  it('counts down to a prototype deadline in Singapore time', () => {
    expect(prototypeDeadlineStatus(new Date('2026-09-15T12:00:00Z'), 23 * 60 + 15))
      .toEqual({ label: '3 hr 15 min left', state: 'safe' });
  });
});

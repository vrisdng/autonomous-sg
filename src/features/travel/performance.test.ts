import { describe, expect, it, vi } from 'vitest';
import { singleFlight } from './singleFlight';
import { mapPairs } from '../../../supabase/functions/_shared/parallel';

describe('bounded provider work', () => {
  it('deduplicates concurrent work but never caches completed responses', async () => {
    const once = singleFlight<number>();
    const work = vi.fn(async () => 42);
    expect(await Promise.all([once('route', work), once('route', work)])).toEqual([42,42]);
    expect(work).toHaveBeenCalledTimes(1);
    await once('route', work);
    expect(work).toHaveBeenCalledTimes(2);
  });
  it('does not cache failed requests', async () => {
    const once = singleFlight<number>();
    await expect(once('route', async () => { throw new Error('timeout'); })).rejects.toThrow('timeout');
    expect(await once('route', async () => 7)).toBe(7);
  });
  it('runs two at once, retains order and completes every journey', async () => {
    let running = 0; let peak = 0;
    const results = await mapPairs([1,2,3,4,5], async (id) => {
      running++; peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, 2)); running--; return id;
    });
    expect(peak).toBe(2); expect(results).toEqual([1,2,3,4,5]);
  });
});

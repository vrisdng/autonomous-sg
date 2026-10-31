import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const result = { ADDRESS: '312A CLEMENTI AVENUE 4 SINGAPORE 121312', LATITUDE: '1.3190', LONGITUDE: '103.7644' };
const isPublic = (url: unknown) => String(url).startsWith('https://www.onemap.gov.sg/');
const missing = () => Response.json({ code: 'NOT_FOUND', message: 'Requested function was not found' }, { status: 404 });

describe('address search', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('__DEV__', false);
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'publishable');
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it('prefers the onemap function when it answers', async () => {
    const fetch = vi.fn(async () => Response.json({ locations: [{ label: 'Function', latitude: 1.31, longitude: 103.81 }] }));
    vi.stubGlobal('fetch', fetch);
    const { searchLocations } = await import('./travelProvider');
    expect((await searchLocations('121312')).map((place) => place.label)).toEqual(['Function']);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('falls back to public OneMap search when the function is not deployed, then stops retrying it', async () => {
    const fetch = vi.fn(async (url: unknown) => isPublic(url) ? Response.json({ error: 'Authentication token missing.', results: [result] }) : missing());
    vi.stubGlobal('fetch', fetch);
    const { searchLocations } = await import('./travelProvider');
    expect((await searchLocations('121312')).map((place) => place.label)).toEqual([result.ADDRESS]);
    await searchLocations('Clementi');
    expect(fetch.mock.calls.filter(([url]) => !isPublic(url))).toHaveLength(1);
    expect(fetch.mock.calls.filter(([url]) => isPublic(url))).toHaveLength(2);
  });
  it('falls back when the browser blocks the failed preflight', async () => {
    const fetch = vi.fn(async (url: unknown) => { if (isPublic(url)) return Response.json({ results: [result] }); throw new TypeError('Failed to fetch'); });
    vi.stubGlobal('fetch', fetch);
    const { searchLocations } = await import('./travelProvider');
    expect(await searchLocations('121312')).toHaveLength(1);
  });
  it('keeps quota limits instead of working around them', async () => {
    const fetch = vi.fn(async () => Response.json({ error: 'Quota busy' }, { status: 429 }));
    vi.stubGlobal('fetch', fetch);
    const { searchLocations } = await import('./travelProvider');
    await expect(searchLocations('121312')).rejects.toThrow('Quota busy');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('reports a closed public search as a failure, not as no results', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: unknown) => isPublic(url) ? Response.json({ error: 'Authentication token missing.' }, { status: 401 }) : missing()));
    const { searchLocations } = await import('./travelProvider');
    await expect(searchLocations('121312')).rejects.toThrow('Address search is unavailable');
  });
});

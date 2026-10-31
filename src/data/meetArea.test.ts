import { afterEach, describe, expect, it, vi } from 'vitest';
import { readMeetArea, writeMeetArea } from './meetArea';

const area = { label: 'Tiong Bahru', latitude: 1.286, longitude: 103.827 };
const store = new Map<string, string>();

describe('meet neighbourhood', () => {
  afterEach(() => {
    store.clear();
    writeMeetArea('SAEYHM');
    writeMeetArea('OTHER1');
    vi.unstubAllGlobals();
  });

  it('remembers a neighbourhood for the party and forgets it when the midpoint is chosen', () => {
    stubSession();
    writeMeetArea('SAEYHM', area);
    expect(readMeetArea('SAEYHM')).toEqual(area);
    expect(store.get('bojio.meet-area:SAEYHM')).toContain('Tiong Bahru');
    expect(readMeetArea('OTHER1')).toBeUndefined();
    writeMeetArea('SAEYHM');
    expect(readMeetArea('SAEYHM')).toBeUndefined();
    expect(store.has('bojio.meet-area:SAEYHM')).toBe(false);
  });

  it('restores a saved neighbourhood after the in-memory copy is gone and ignores an invalid one', () => {
    stubSession();
    store.set('bojio.meet-area:SAEYHM', JSON.stringify(area));
    expect(readMeetArea('SAEYHM')).toEqual(area);
    writeMeetArea('SAEYHM');
    store.set('bojio.meet-area:SAEYHM', JSON.stringify({ label: 'Nope', latitude: 0, longitude: 0 }));
    expect(readMeetArea('SAEYHM')).toBeUndefined();
  });
});

function stubSession() {
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
  });
}

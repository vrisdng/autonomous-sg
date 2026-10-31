import { GeoLocation } from '../types';
import { validLocation } from '../features/travel/types';

const key = (code: string) => `bojio.meet-area:${code}`;

/** In-tab copy so leaving Meet and coming back does not wait on storage. */
const memory = new Map<string, GeoLocation>();

function readStored(code: string): GeoLocation | undefined {
  try {
    const raw = typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(key(code));
    if (!raw) return;
    const parsed = JSON.parse(raw) as unknown;
    if (!validLocation(parsed)) return;
    return { label: parsed.label, latitude: parsed.latitude, longitude: parsed.longitude };
  } catch {
    return;
  }
}

/** Host's chosen restaurant neighbourhood for this party. Absent means use the group midpoint. */
export function readMeetArea(code: string): GeoLocation | undefined {
  const cached = memory.get(code);
  if (cached) return cached;
  const stored = readStored(code);
  if (stored) memory.set(code, stored);
  return stored;
}

export function writeMeetArea(code: string, area?: GeoLocation) {
  if (!area || !validLocation(area)) {
    memory.delete(code);
    try { sessionStorage?.removeItem(key(code)); } catch { /* private mode keeps the cleared memory copy */ }
    return;
  }
  const saved = { label: area.label, latitude: area.latitude, longitude: area.longitude };
  memory.set(code, saved);
  try { sessionStorage?.setItem(key(code), JSON.stringify(saved)); } catch { /* in-memory copy still restores this tab */ }
}

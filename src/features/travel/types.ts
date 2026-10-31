import { GeoLocation } from '../../types';

export type RouteStep = {
  mode: string; instruction: string; from: string; to: string;
  boardingLocation?: {latitude:number;longitude:number}; alightingLocation?: {latitude:number;longitude:number};
  boardingStopCode?: string; alightingStopCode?: string; serviceNo?: string;
  startAt?: string; endAt?: string; durationSeconds: number;
};
export type ScheduledRoute = {
  startAt: string; endAt: string; durationSeconds: number; steps: RouteStep[];
  source: 'onemap' | 'google'; checkedAt: string;
};
export type RouteResult = {
  id: string; status: 'available' | 'unavailable'; route?: ScheduledRoute; message?: string;
  failure?: 'timeout' | 'quota' | 'authentication' | 'cancelled' | 'unavailable';
};
export type TripRequest = { id: string; from: GeoLocation; to: GeoLocation };
export type DriveLeg = { from: string; to: string; seconds: number };

export function validLocation(value: unknown): value is GeoLocation {
  if (!value || typeof value !== 'object') return false;
  const location = value as GeoLocation;
  return typeof location.label === 'string' && location.label.trim().length > 0
    && Number.isFinite(location.latitude) && location.latitude >= 1.1 && location.latitude <= 1.6
    && Number.isFinite(location.longitude) && location.longitude >= 103.5 && location.longitude <= 104.2;
}

export function singaporeInput(date = new Date()) {
  return new Date(date.getTime() + 8 * 3600_000).toISOString().slice(0, 16).replace('T', ' ');
}
export function parseSingaporeInput(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(value.replace(' ', 'T') + ':00+08:00');
  return Number.isFinite(date.getTime()) && singaporeInput(date) === value.replace('T', ' ') ? date.toISOString() : null;
}
export function clock(value: string) {
  return new Date(value).toLocaleString('en-SG', { timeZone: 'Asia/Singapore', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
export function directions(from: GeoLocation, to: GeoLocation, mode: 'transit' | 'driving' = 'transit', via?: GeoLocation | GeoLocation[]) {
  const coordinate = (point: GeoLocation) => `${point.latitude},${point.longitude}`;
  const stops = via ? (Array.isArray(via) ? via : [via]) : [];
  return `https://www.google.com/maps/dir/?api=1&origin=${coordinate(from)}&destination=${coordinate(to)}&travelmode=${mode}${stops.length ? `&waypoints=${encodeURIComponent(stops.map(coordinate).join('|'))}` : ''}`;
}
export function groupLeaveBy(results: RouteResult[], ids: string[], buffer: number, now = Date.now()) {
  if (!ids.length) return null;
  const deadlines = ids.map((id) => {
    const result = results.find((item) => item.id === id && item.status === 'available');
    return result?.route ? Date.parse(result.route.startAt) - buffer * 60_000 : NaN;
  });
  return deadlines.every((value) => Number.isFinite(value) && value >= now) ? new Date(Math.min(...deadlines)).toISOString() : null;
}

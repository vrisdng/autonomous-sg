import { Place } from '../../types';

type LivePlacePayload = {
  id?: unknown;
  name?: unknown;
  address?: unknown;
  detail?: unknown;
  openUntil?: unknown;
  isOpenNow?: unknown;
  tags?: unknown;
  latitude?: unknown;
  longitude?: unknown;
};

function singaporePoint(latitude: number, longitude: number) {
  return {
    x: Math.max(0, Math.min(100, Math.round(((longitude - 103.6) / 0.4) * 100))),
    y: Math.max(0, Math.min(100, Math.round(((latitude - 1.22) / 0.25) * 100))),
  };
}

export function parseLivePlaces(value: unknown): Place[] {
  if (!value || typeof value !== 'object') return [];
  const record = value as { places?: unknown; sourceTimestamp?: unknown };
  if (!Array.isArray(record.places)) return [];
  const sourceTimestamp = typeof record.sourceTimestamp === 'string' ? record.sourceTimestamp : new Date().toISOString();

  return record.places.flatMap((raw) => {
    if (!raw || typeof raw !== 'object') return [];
    const place = raw as LivePlacePayload;
    if (typeof place.id !== 'string' || typeof place.name !== 'string' || typeof place.latitude !== 'number' || typeof place.longitude !== 'number') return [];
    const address = typeof place.address === 'string' ? place.address : 'Singapore';
    return [{
      id: `google-${place.id}`,
      providerPlaceId: place.id,
      latitude: place.latitude,
      longitude: place.longitude,
      name: place.name,
      area: address,
      address,
      nearestStation: 'check live route in Maps',
      detail: typeof place.detail === 'string' ? place.detail : 'Live place result for late-night makan',
      openUntil: typeof place.openUntil === 'string' ? place.openUntil : 'hours unavailable',
      isOpenNow: typeof place.isOpenNow === 'boolean' ? place.isOpenNow : undefined,
      tags: Array.isArray(place.tags) ? place.tags.filter((tag): tag is string => typeof tag === 'string').slice(0, 3) : [],
      point: singaporePoint(place.latitude, place.longitude),
      source: 'google_places' as const,
      sourceTimestamp,
    }];
  });
}

export function formatPlaceFreshness(place: Place) {
  if (place.source === 'prototype') return 'Prototype venue and hours';
  const checked = place.sourceTimestamp ? new Date(place.sourceTimestamp) : null;
  if (!checked || Number.isNaN(checked.getTime())) return 'Google Places · checked live';
  return `Google Places · checked ${checked.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
}

import { Place } from '../../types';

// Categories describe the operator-checked shortlist, not inferred dietary claims.
export function cuisine(place: Place): string {
  if (place.id.startsWith('swee-')) return 'Dim sum';
  if (place.id.startsWith('azhar-')) return 'Indian & regional';
  if (place.id.startsWith('prata-') || place.id === 'casuarina') return 'Prata & curry';
  return 'Other places';
}
export function matchesVenue(place: Place, query: string, food: string, area: string) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const text = `${place.name} ${place.address ?? ''} ${place.area} ${cuisine(place)}`.toLowerCase();
  return (!food || cuisine(place) === food) && (!area || place.area === area) && words.every((word) => text.includes(word));
}
export function venueMapsUrl(place: Place) {
  if(place.source==='google_places' && place.providerPlaceId)return `https://www.google.com/maps/search/?api=1&query=restaurant&query_place_id=${encodeURIComponent(place.providerPlaceId)}`;
  // Name + branch address, not coordinates alone: a building pin has no restaurant reviews.
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.name}, ${place.address ?? place.area}, Singapore`)}`;
}

export function variedVenues(places: Place[]): Place[] {
  const groups = new Map<string, Place[]>();
  for (const place of places) {
    const key = cuisine(place);
    groups.set(key, [...(groups.get(key) ?? []), place]);
  }
  const ordered: Place[] = [];
  while (ordered.length < places.length) {
    for (const group of groups.values()) { const place = group.shift(); if (place) ordered.push(place); }
  }
  return ordered;
}

import { Place } from '../../types';

export function createPlaceMapsUrl(place: Place) {
  const query = encodeURIComponent(`${place.name}, ${place.address ?? place.area}, Singapore`);
  const placeId = place.providerPlaceId ? `&query_place_id=${encodeURIComponent(place.providerPlaceId)}` : '';
  return `https://www.google.com/maps/search/?api=1&query=${query}${placeId}`;
}

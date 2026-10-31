import { GeoLocation, Place } from '../../types';
import { validLocation } from '../travel/types';

const meetupSources = new Set<Place['source']>(['verified', 'onemap', 'google_places']);

export function isMeetupChoice(venue?: Place): venue is Place {
  return Boolean(venue && meetupSources.has(venue.source));
}

// A chosen Meet venue is the pickup, even while its pin is still loading.
// An unresolved pin must not fall through to a typed pickup.
export function ridePickup(venue: Place | undefined, custom?: GeoLocation): GeoLocation | undefined {
  if (isMeetupChoice(venue)) {
    if (typeof venue.latitude !== 'number' || typeof venue.longitude !== 'number') return undefined;
    return { label: venue.address ?? venue.name, latitude: venue.latitude, longitude: venue.longitude };
  }
  return validLocation(custom) ? custom : undefined;
}

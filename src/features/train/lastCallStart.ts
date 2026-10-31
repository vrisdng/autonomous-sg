import { GeoLocation, PlanDraft } from '../../types';
import { validLocation } from '../travel/types';

const UNSET_ORIGIN = new Set(['', 'location not set', 'not set']);

/** A blank or placeholder origin still needs a starting point on Last Call. */
export function originMissing(origin?: string | null) {
  return UNSET_ORIGIN.has((origin ?? '').trim().toLowerCase());
}

/**
 * Open the Last Call picker when this device has no pin, or this person never
 * saved an origin. A home on the row does not count as a starting point.
 */
export function showLastCallStart(pin?: GeoLocation, person?: { origin?: string | null } | null) {
  if (!validLocation(pin)) return true;
  if (!person) return false;
  return originMissing(person.origin);
}

/** The route leaves from the pin once it exists. Until then, a loaded venue can stand in. */
export function lastCallRouteOrigin(pin: GeoLocation | undefined, ready: boolean, venue?: GeoLocation) {
  if (validLocation(pin)) return pin;
  return ready && validLocation(venue) ? venue : undefined;
}

/**
 * Write the pin onto this person the way a home pin does: origin becomes the
 * label, and a missing home is filled in. An existing home stays. Everyone
 * else is copied through unchanged.
 */
export function applyOwnStartingPoint(plan: PlanDraft, pin: GeoLocation, actorId: string): PlanDraft {
  const chosen = { label: pin.label.trim().slice(0, 300), latitude: pin.latitude, longitude: pin.longitude };
  if (!validLocation(chosen) || !actorId || !plan.participants.some((person) => person.id === actorId)) return plan;
  const origin = chosen.label.slice(0, 120);
  return {
    ...plan,
    pendingSync: true,
    participants: plan.participants.map((person) => {
      if (person.id !== actorId) return person;
      if (!validLocation(person.location)) return { ...person, location: chosen, origin };
      return { ...person, origin };
    }),
  };
}


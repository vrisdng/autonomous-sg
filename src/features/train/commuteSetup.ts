import { Participant, PlanDraft } from '../../types';
import { validLocation } from '../travel/types';

// Train / either, plus you even if you chose a ride, so your own card stays.
// Ride-only friends stay on Share a ride. Never invent someone who is not in
// the live party.
export function lastCallGroup(plan: PlanDraft | null): Participant[] {
  const participants = plan?.participants ?? [];
  const travelling = participants.filter((person) => person.transportMode !== 'ride');
  const self = participants.find((person) => person.id === plan?.remote?.participantId);
  const ordered = self ? [self, ...travelling.filter((person) => person.id !== self.id)] : travelling;
  const seen = new Set<string>();
  return ordered.filter((person) => seen.has(person.id) ? false : (seen.add(person.id), true));
}

export function commuteSetup(plan: PlanDraft | null) {
  const venue = plan?.chosenVenue && ['verified', 'onemap', 'google_places'].includes(plan.chosenVenue.source)
    && validLocation({ label: plan.chosenVenue.name, latitude: plan.chosenVenue.latitude, longitude: plan.chosenVenue.longitude }) ? plan.chosenVenue : undefined;
  const people = plan?.participants.filter((person) => person.transportMode !== 'ride') ?? [];
  const readyPeople = people.filter((person) => validLocation(person.location));
  return { venue, people, readyPeople, missingPeople: people.filter((person) => !validLocation(person.location)) };
}

import { Participant, PlanDraft } from '../../types';

/** Same moment, whether the server printed `Z` or `+00:00`. */
export function sameInstant(left?: string | null, right?: string | null) {
  const a = Date.parse(left ?? '');
  const b = Date.parse(right ?? '');
  return Number.isFinite(a) && a === b;
}

/**
 * A host save may change this person's row and the shared leave-by.
 * Everyone else stays as the server last confirmed them, including people
 * the local draft omitted.
 */
export function preserveOtherParticipants(local: PlanDraft, server: PlanDraft, actorId?: string): PlanDraft {
  if (local.code !== server.code) return local;
  const seen = new Set<string>();
  const participants: Participant[] = server.participants.map((person) => {
    seen.add(person.id);
    if (!actorId || person.id !== actorId) return person;
    const mine = local.participants.find((candidate) => candidate.id === actorId);
    if (!mine) return person;
    return { ...person, name: mine.name, origin: mine.origin, location: mine.location, transportMode: mine.transportMode };
  });
  for (const person of local.participants) {
    if (!seen.has(person.id)) participants.push(person);
  }
  if (actorId && !participants.some((person) => person.id === actorId)) {
    const mine = local.participants.find((person) => person.id === actorId);
    if (mine) participants.unshift(mine);
  }
  return { ...local, participants };
}

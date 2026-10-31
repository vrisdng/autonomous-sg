import { SwipeState } from '../features/meet/swipes';
import { Participant, PlanDraft } from '../types';

/** Enough of a swipe deck to tell who has rated cards. No timestamps, so this is not presence. */
export type PulseDeck = {
  venues: { id: string }[];
  voters: string[];
  swipes: { voterId: string; venueId: string }[];
};

export type PulsePhase = 'loading' | 'ready' | 'unavailable';

export type PulseKind = 'roster' | 'swiping' | 'quiet' | 'done';

export type PulsePerson = {
  id: string;
  name: string;
  you: boolean;
  kind: PulseKind;
  label: string;
};

export type PartyPulseModel = {
  people: PulsePerson[];
  summary: string;
  note: string;
};

/**
 * Best-effort party readout for Bao’s ask bubble.
 * Names always come from the party. Swipe labels are used only when a deck is loaded and a person maps to one voter.
 * There is no live presence, so nobody is marked online.
 */
export function buildPartyPulse(plan: PlanDraft | null | undefined, deck: PulseDeck | null, phase: PulsePhase): PartyPulseModel {
  const members = plan?.participants ?? [];
  const people = members.map((person) => personRow(person, plan, deck, phase));
  const hasDeck = phase === 'ready' && !!deck && deck.venues.length > 0;
  return {
    people,
    summary: summarize(people),
    note: pulseNote(members.length, phase, hasDeck),
  };
}

export function pulseDeckFromSwipes(state: SwipeState | null | undefined): PulseDeck | null {
  if (!state) return null;
  return {
    venues: state.venues.map((venue) => ({ id: venue.id })),
    voters: state.voters,
    swipes: state.swipes.map((swipe) => ({ voterId: swipe.voterId, venueId: swipe.venueId })),
  };
}

function personRow(person: Participant, plan: PlanDraft | null | undefined, deck: PulseDeck | null, phase: PulsePhase): PulsePerson {
  const name = person.name.trim() || 'Unnamed kaki';
  const you = !!plan?.remote?.participantId && person.id === plan.remote.participantId;
  const activity = phase === 'ready' ? swipeActivity(person, plan, deck) : undefined;
  return { id: person.id, name, you, kind: activity?.kind ?? 'roster', label: activity?.label ?? 'In the party' };
}

function swipeActivity(person: Participant, plan: PlanDraft | null | undefined, deck: PulseDeck | null): { kind: PulseKind; label: string } | undefined {
  if (!deck || deck.venues.length === 0) return;
  const voters = votersFor(person, plan, deck);
  if (!voters) return;
  const venueIds = new Set(deck.venues.map((venue) => venue.id));
  const rated = new Set(deck.swipes.filter((swipe) => voters.includes(swipe.voterId) && venueIds.has(swipe.venueId)).map((swipe) => swipe.venueId));
  if (rated.size === 0) return { kind: 'quiet', label: 'Quiet · no swipes yet' };
  if (rated.size >= venueIds.size) return { kind: 'done', label: 'Done swiping' };
  return { kind: 'swiping', label: `Still swiping · ${rated.size} of ${venueIds.size}` };
}

/**
 * Count `guest:<id>` for that person. Legacy `host` rows stay on this device's
 * host only. They are never painted onto the one person who has no guest row.
 */
function votersFor(person: Participant, plan: PlanDraft | null | undefined, deck: PulseDeck): string[] | undefined {
  const guest = `guest:${person.id}`;
  const ownHost = plan?.remote?.role === 'host' && plan.remote.participantId === person.id && deck.voters.includes('host');
  if (!deck.voters.includes(guest) && !ownHost) return;
  const voters = deck.voters.includes(guest) ? [guest] : [];
  if (ownHost) voters.push('host');
  return voters;
}

function summarize(people: PulsePerson[]): string {
  if (!people.length) return 'No party yet';
  const swiping = people.filter((person) => person.kind === 'swiping').length;
  const quiet = people.filter((person) => person.kind === 'quiet').length;
  const done = people.filter((person) => person.kind === 'done').length;
  if (swiping + quiet + done === 0) return people.length === 1 ? '1 in the party' : `${people.length} in the party`;
  const parts: string[] = [];
  if (swiping) parts.push(swiping === 1 ? '1 swiping' : `${swiping} swiping`);
  if (quiet) parts.push(quiet === 1 ? '1 quiet' : `${quiet} quiet`);
  if (done) parts.push(done === 1 ? '1 finished' : `${done} finished`);
  const roster = people.length - swiping - quiet - done;
  if (roster) parts.push(roster === 1 ? '1 in the party' : `${roster} in the party`);
  return parts.join(' · ');
}

function pulseNote(count: number, phase: PulsePhase, hasDeck: boolean): string {
  if (!count) return phase === 'loading' ? 'Looking for this party…' : 'No party on this device yet.';
  if (phase === 'loading') return 'Party names. Checking the swipe deck…';
  if (phase === 'unavailable') return 'Party names only. The swipe deck didn’t load.';
  if (!hasDeck) return 'Party names. No swipe deck yet.';
  return 'Party names and swipe deck. Not a live online light.';
}

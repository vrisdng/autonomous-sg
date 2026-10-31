import { PlanDraft } from '../../types';

export const maxPartySize = 12;

/** Sample names for the demo. There are no accounts, so this is not a real friend graph. */
export const demoFriends = ['Aisha', 'Farhan', 'Hui Min', 'Jun Hao', 'Priya', 'Wei Ming'];

const sameName = (left: string, right: string) => left.trim().toLocaleLowerCase() === right.trim().toLocaleLowerCase();

export const isInParty = (plan: PlanDraft, name: string) => plan.participants.some((person) => sameName(person.name, name));

/** Adds a friend to the roster. They claim this name themselves when they open the invite. */
export function addFriendToPlan(plan: PlanDraft, name: string, id: string): PlanDraft {
  if (isInParty(plan, name)) return plan;
  if (plan.participants.length >= maxPartySize) throw new Error(`A party fits ${maxPartySize} people.`);
  return { ...plan, participants: [...plan.participants, { id, name: name.trim(), origin: 'Location not set', transportMode: 'either' }] };
}

/** The shared party the Bao menu acts on. Local drafts, closed and expired plans do not count. */
export function activeParty(plan: PlanDraft | null | undefined, now = Date.now()) {
  if (!plan?.remote?.published || plan.status === 'closed') return undefined;
  const expires = Date.parse(plan.expiresAt ?? '');
  return Number.isFinite(expires) && expires <= now ? undefined : plan;
}

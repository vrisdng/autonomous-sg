import { GeoLocation, PlanDraft } from '../../types';
import { loadPlanDraft, savePlanDraft } from '../../data/planDraft';
import { publishRemotePlan, saveOutingGuest } from '../../data/remotePlans';
import { meetSelf } from '../meet/meetReady';
import { keepConfirmedHomes, mergeOuting } from '../plans/mergeOuting';
import { validLocation } from '../travel/types';
import { applyOwnStartingPoint } from './lastCallStart';

/** Persist this person's origin. Other homes stay on the server copy. */
export async function persistOwnStartingPoint(plan: PlanDraft, pin: GeoLocation) {
  const actor = meetSelf(plan);
  if (!actor) return;
  const current = await loadPlanDraft();
  if (current?.code !== plan.code || current.status === 'closed' || current.remote?.participantId !== plan.remote?.participantId) {
    throw new Error('Party changed or closed. Reopen your party to save.');
  }
  const person = current.participants.find((candidate) => candidate.id === actor.id);
  if (!person) throw new Error('Rejoin your party before saving your starting point.');
  const next = applyOwnStartingPoint(current, pin, actor.id);
  if (next === current) throw new Error('Choose a starting point in Singapore.');
  const published = Boolean(current.remote?.published);
  const draft = published ? next : { ...next, pendingSync: false };
  await savePlanDraft(draft);
  if (!published || !current.remote) return;
  const mine = next.participants.find((candidate) => candidate.id === actor.id);
  if (!mine || !validLocation(mine.location)) throw new Error('Choose a starting point in Singapore.');
  const saved = current.remote.role === 'guest'
    ? await saveOutingGuest(current.code, person.name, mine.location, person.transportMode ?? 'either', current.remote, mine.origin)
    : { ...await publishRemotePlan(draft), pendingSync: false as const };
  const latest = await loadPlanDraft();
  if (latest?.code !== current.code) throw new Error('Party changed. Reopen it to check your starting point.');
  const merged = current.remote.role === 'guest' ? mergeOuting({ ...draft, pendingSync: true }, saved) : saved;
  await savePlanDraft({ ...keepConfirmedHomes(draft, merged), pendingSync: false, remote: draft.remote ?? merged.remote });
}

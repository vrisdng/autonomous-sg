import { Participant, PlanDraft } from '../../types';
import { validLocation } from '../travel/types';

/** This device's person: the signed-in participant, or the only local one. */
export function meetSelf(plan: PlanDraft): Participant | undefined {
  const guest = plan.remote?.role === 'guest';
  return plan.participants.find((person) => person.id === plan.remote?.participantId)
    ?? (!guest && plan.participants.length === 1 ? plan.participants[0] : undefined);
}

/** Cards stay hidden until this person has a name and a saved home pin. */
export function meetReady(plan: PlanDraft): boolean {
  const self = meetSelf(plan);
  return !!self && self.name.trim().length > 0 && validLocation(self.location);
}

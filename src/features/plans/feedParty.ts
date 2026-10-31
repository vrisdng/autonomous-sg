import { PlanDraft } from '../../types';

export type FeedParty = { kicker: string; title: string };

/** What the feed shows about this device's outing, or null when there is nothing to return to. */
export function feedParty(plan: PlanDraft | null, now = Date.now()): FeedParty | null {
  if (!plan?.participants.length || plan.status === 'closed') return null;
  if (plan.expiresAt && Date.parse(plan.expiresAt) <= now) return null;
  const venue = plan.chosenVenue && ['verified', 'onemap', 'google_places'].includes(plan.chosenVenue.source) ? plan.chosenVenue : undefined;
  const people = plan.participants.length;
  const kakis = `${people} ${people === 1 ? 'kaki' : 'kakis'}`;
  return {
    kicker: plan.remote?.published ? `PARTY ${plan.code} · ${kakis.toUpperCase()}` : `DRAFT ON THIS DEVICE · ${kakis.toUpperCase()}`,
    title: venue?.name || 'Still choosing where to makan',
  };
}

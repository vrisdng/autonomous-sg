import { normalizePlanCode } from '../features/plans/links';
import { parseRemoteBill, persistedFinalCents, serializeAdjustments, serializeSharedBillItems, SharedBillDraft } from '../features/split/sharedBill';
import { PlanDraft } from '../types';
import { callRemoteRpc } from './remotePlans';

export type { SharedBillDraft } from '../features/split/sharedBill';

export async function loadRemoteBill(code: string): Promise<SharedBillDraft | null> {
  const response = await callRemoteRpc('get_bill', { p_code: normalizePlanCode(code) });
  return parseRemoteBill(response);
}

export async function saveRemoteBill(plan: PlanDraft, draft: SharedBillDraft) {
  if (plan.remote?.role !== 'host' || !plan.remote.hostToken) {
    throw new Error('Only the plan host can edit the shared bill.');
  }
  const response = await callRemoteRpc('save_bill_with_adjustments', {
    p_revision: draft.revision ?? 0,
    p_code: normalizePlanCode(plan.code),
    p_host_token: plan.remote.hostToken,
    p_service_percent: Number(draft.servicePercent) || 0,
    p_gst_percent: Number(draft.gstPercent) || 0,
    p_items: serializeSharedBillItems(draft.items),
    p_adjustments: serializeAdjustments(draft.adjustments),
    p_final_total_cents: persistedFinalCents(draft),
  });
  const parsed = parseRemoteBill(response);
  if (!parsed) throw new Error('The shared bill could not be saved.');
  return parsed;
}

export async function startRemoteGuestBill(plan: PlanDraft, draft: SharedBillDraft) {
  if (plan.remote?.role !== 'guest' || !plan.remote.guestToken) {
    throw new Error('Your guest access is required to start the shared bill.');
  }
  const response = await callRemoteRpc('start_guest_bill_with_adjustments', {
    p_code: normalizePlanCode(plan.code),
    p_guest_token: plan.remote.guestToken,
    p_service_percent: Number(draft.servicePercent) || 0,
    p_gst_percent: Number(draft.gstPercent) || 0,
    p_items: serializeSharedBillItems(draft.items).map(item=>({...item,claimant_ids:[]})),
    p_adjustments: serializeAdjustments(draft.adjustments),
    p_final_total_cents: persistedFinalCents(draft),
  });
  const parsed = parseRemoteBill(response);
  if (!parsed) throw new Error('The shared bill could not be started.');
  return parsed;
}

export async function confirmRemoteBillTotal(plan: PlanDraft, totalCents: number, revision: number) {
  if (plan.remote?.role !== 'host' || !plan.remote.hostToken) {
    throw new Error('Only the plan host can confirm the total.');
  }
  return requireRemoteBill(await callRemoteRpc('confirm_bill_total', {
    p_code: normalizePlanCode(plan.code),
    p_host_token: plan.remote.hostToken,
    p_confirmed_total_cents: totalCents,
    p_revision: revision,
  }));
}

export async function reopenRemoteBillConfirmation(plan: PlanDraft, revision: number) {
  if (plan.remote?.role !== 'host' || !plan.remote.hostToken) {
    throw new Error('Only the plan host can change the confirmed total.');
  }
  return requireRemoteBill(await callRemoteRpc('reopen_bill_confirmation', {
    p_code: normalizePlanCode(plan.code),
    p_host_token: plan.remote.hostToken,
    p_revision: revision,
  }));
}

export async function setRemoteBillClaim(plan: PlanDraft, itemId: string, claimed: boolean) {
  if (plan.remote?.role !== 'guest' || !plan.remote.guestToken) {
    throw new Error('A guest capability is required to claim an item.');
  }
  const response = await callRemoteRpc('set_bill_claim', {
    p_code: normalizePlanCode(plan.code),
    p_guest_token: plan.remote.guestToken,
    p_item_id: itemId,
    p_claimed: claimed,
  });
  const parsed = parseRemoteBill(response);
  if (!parsed) throw new Error('The shared bill is unavailable.');
  return parsed;
}

export async function setRemoteGuestPaymentSent(plan: PlanDraft, amountCents: number, sent: boolean) {
  if (plan.remote?.role !== 'guest' || !plan.remote.guestToken) throw new Error('Your guest capability is required to update payment.');
  return requireRemoteBill(await callRemoteRpc('set_guest_payment_sent', {
    p_code: normalizePlanCode(plan.code), p_guest_token: plan.remote.guestToken, p_amount_cents: amountCents, p_sent: sent,
  }));
}

export async function setRemoteHostPaymentStatus(plan: PlanDraft, participantId: string, amountCents: number, status: 'unpaid' | 'sent' | 'received') {
  if (plan.remote?.role !== 'host' || !plan.remote.hostToken) throw new Error('Only the plan host can confirm received payments.');
  return requireRemoteBill(await callRemoteRpc('set_host_payment_status', {
    p_code: normalizePlanCode(plan.code), p_host_token: plan.remote.hostToken, p_participant_id: participantId, p_amount_cents: amountCents, p_status: status,
  }));
}

function requireRemoteBill(response: unknown) {
  const parsed = parseRemoteBill(response);
  if (!parsed) throw new Error('The shared bill is unavailable.');
  return parsed;
}

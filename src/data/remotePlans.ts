import 'react-native-url-polyfill/auto';
import * as Crypto from 'expo-crypto';
import { RealtimeClient } from '@supabase/realtime-js';
import { normalizePlanCode } from '../features/plans/links';
import { keepConfirmedHomes } from '../features/plans/mergeOuting';
import { preserveOtherParticipants, sameInstant } from '../features/plans/preserveRoster';
import { parseRemotePlan, RpcPlan } from '../features/plans/remotePlanPayload';
import { GeoLocation, PlanDraft, TransportMode } from '../types';
import { loadHostAccess, loadPlanAccess } from './planDraft';
import { persistedVenue } from '../features/meet/googlePlace';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, '');
const supabasePublicKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()
  || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();
let realtimeClient: RealtimeClient | null = null;

export function isRemotePlansConfigured() {
  return Boolean(supabaseUrl && supabasePublicKey);
}

export function callRemoteRpc(name: string, body: Record<string, unknown>) {
  return callRpc(getConfig(), name, body);
}

export function prepareRemoteHost(draft: PlanDraft): PlanDraft {
  const hostToken = draft.remote?.role === 'host' && draft.remote.hostToken
    ? draft.remote.hostToken
    : Crypto.randomUUID().replace(/-/g, '') + Crypto.randomUUID().replace(/-/g, '');
  return { ...draft, remote: { role: 'host', hostToken, participantId: draft.remote?.role==='host'?draft.remote.participantId:undefined, published: draft.remote?.published ?? false } };
}

export async function publishRemotePlan(draft: PlanDraft): Promise<PlanDraft> {
  const config = getConfig();
  const prepared = prepareRemoteHost(draft);
  const hostToken = prepared.remote!.hostToken!;
  let actorId = prepared.remote?.participantId;
  if (prepared.remote?.role === 'host') {
    const sticky = await loadHostAccess(prepared.code).catch(() => undefined);
    if (sticky?.participantId) actorId = sticky.participantId;
  }
  let roster = prepared.participants;
  let revision = prepared.revision ?? null;
  if (revision != null || prepared.remote?.published) {
    try {
      const remote = await loadRemotePlan(prepared.code, prepared.remote);
      roster = preserveOtherParticipants(prepared, remote, actorId).participants;
      if (revision == null && remote.revision != null) revision = remote.revision;
    } catch { /* A brand-new party has nothing to preserve yet. */ }
  }
  const send = (rev: number | null) => callRpc(config, 'save_outing', {
    p_code: normalizePlanCode(prepared.code), p_host_token: hostToken,
    p_participants: roster.map(person=>({...person,origin:(person.origin.trim()||person.location?.label||'Location not set').slice(0,120)})),
    p_venue: prepared.chosenVenue && ['verified', 'onemap', 'google_places'].includes(prepared.chosenVenue.source) ? persistedVenue(prepared.chosenVenue) : null,
    p_meetup_at: prepared.meetupAt ?? null, p_commute_at: prepared.commuteAt ?? null,
    p_revision: rev, p_actor_id: actorId ?? null,
  });
  let response = await send(revision);
  let parsed = parseRemotePlan(response);
  // A null revision on an existing party returns the row and writes nothing.
  if (prepared.commuteAt && !sameInstant(prepared.commuteAt, parsed.commuteAt) && revision == null && parsed.revision != null) {
    response = await send(parsed.revision);
    parsed = parseRemotePlan(response);
  }
  if (prepared.commuteAt && !sameInstant(prepared.commuteAt, parsed.commuteAt)) {
    throw new Error('Leave-by was not saved. Refresh and try again.');
  }
  return keepConfirmedHomes(prepared, { ...prepared, ...parsed, participants: parsed.participants, remote: { ...prepared.remote, role: 'host', hostToken, participantId: actorId, published: true } });
}

// Parties intentionally allow name-based re-entry on another device. This grants
// only that participant's guest capability, never the host capability.
export async function joinParty(code: string, name: string, participantId: string | undefined, token: string): Promise<PlanDraft> {
  const response = await callRemoteRpc('join_party', { p_code: normalizePlanCode(code), p_name: name.trim(), p_participant_id: participantId ?? null, p_guest_token: token });
  const row=response as {participant_id?:string;guest_token?:string};
  if(!row.participant_id || !row.guest_token)throw new Error('Your entry was not confirmed. Please retry.');
  return {...parseRemotePlan(response),remote:{role:'guest',participantId:row.participant_id,guestToken:row.guest_token,published:true}};
}

export async function saveOutingGuest(code: string, name: string, location: GeoLocation, mode: TransportMode, access: NonNullable<PlanDraft['remote']>, origin?: string) {
  if (!access.guestToken) throw new Error('Guest access was not saved. Reopen the plan and retry.');
  const startingPoint = origin?.trim().slice(0, 120);
  const response = await callRemoteRpc('save_guest_outing', {
    p_code: normalizePlanCode(code), p_guest_token: access.guestToken, p_name: name.trim(), p_location: location, p_mode: mode,
    ...(startingPoint ? { p_origin: startingPoint } : {}),
  });
  const participantId = (response as RpcPlan).participant_id;
  if (typeof participantId !== 'string') throw new Error('The server did not confirm your entry.');
  return { ...parseRemotePlan(response), remote: { ...access, role: 'guest' as const, participantId, published: true } };
}

export async function setRemotePlanStatus(draft: PlanDraft, status: 'planning' | 'closed') {
  const hostToken = requireHostToken(draft);
  const response = await callRemoteRpc('set_plan_status', {
    p_code: normalizePlanCode(draft.code),
    p_host_token: hostToken,
    p_status: status,
  });
  return { ...draft, ...parseRemotePlan(response) };
}

export async function extendRemotePlanExpiry(draft: PlanDraft) {
  const hostToken = requireHostToken(draft);
  const response = await callRemoteRpc('extend_plan_expiry', {
    p_code: normalizePlanCode(draft.code),
    p_host_token: hostToken,
  });
  return { ...draft, ...parseRemotePlan(response) };
}

export async function deleteRemotePlan(draft: PlanDraft) {
  const hostToken = requireHostToken(draft);
  await callRemoteRpc('delete_plan', {
    p_code: normalizePlanCode(draft.code),
    p_host_token: hostToken,
  });
}

export async function loadRemotePlan(code: string, access?: PlanDraft['remote']): Promise<PlanDraft> {
  const config = getConfig();
  const response = await callRpc(config, 'get_plan', { p_code: normalizePlanCode(code) });
  const payload = parseRemotePlan(response);
  const retainedAccess = access ?? await loadPlanAccess(normalizePlanCode(code));
  return { ...payload, remote: { ...(retainedAccess ?? { role: 'guest' }), published: true } };
}

export async function saveRemoteGuest(code: string, name: string, origin: string, access?: PlanDraft['remote']): Promise<PlanDraft> {
  const config = getConfig();
  const guestToken = access?.role === 'guest' && access.guestToken
    ? access.guestToken
    : Crypto.randomUUID().replace(/-/g, '') + Crypto.randomUUID().replace(/-/g, '');
  const response = await callRpc(config, 'upsert_guest_participant', {
    p_code: normalizePlanCode(code),
    p_guest_token: guestToken,
    p_display_name: name.trim(),
    p_origin: origin.trim(),
  });
  const payload = parseRemotePlan(response);
  const participantId = typeof (response as RpcPlan | null)?.participant_id === 'string'
    ? (response as RpcPlan).participant_id as string
    : undefined;
  if (!participantId) throw new Error('The shared plan did not return your participant entry.');
  return { ...payload, remote: { role: 'guest', guestToken, participantId, published: true } };
}

export async function setRemoteGuestTransportMode(code: string, mode: 'train' | 'ride' | 'either', access?: PlanDraft['remote']) {
  if (access?.role !== 'guest' || !access.guestToken) throw new Error('Your guest capability is required to update transport.');
  const response = await callRemoteRpc('set_guest_transport_mode', {
    p_code: normalizePlanCode(code), p_guest_token: access.guestToken, p_transport_mode: mode,
  });
  const payload = parseRemotePlan(response);
  return { ...payload, remote: { ...access, published: true } } as PlanDraft;
}

export function subscribeToRemotePlan(code: string, onChange: () => void, onStatus: (status: 'live' | 'fallback') => void) {
  const config = getConfig();
  if (!realtimeClient) {
    realtimeClient = new RealtimeClient(`${config.url}/realtime/v1`, {
      params: { apikey: config.publicKey },
    });
  }

  let active = true;
  let refreshTimer: ReturnType<typeof setTimeout> | undefined;
  const requestRefresh = () => {
    if (!active) return;
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(onChange, 250);
  };
  const channel = realtimeClient
    .channel(`plan:${normalizePlanCode(code)}`, { config: { private: false } })
    .on('broadcast', { event: 'plan_changed' }, requestRefresh)
    .subscribe((status) => {
      if (!active) return;
      onStatus(status === 'SUBSCRIBED' ? 'live' : 'fallback');
    });

  return () => {
    active = false;
    if (refreshTimer) clearTimeout(refreshTimer);
    void realtimeClient?.removeChannel(channel);
  };
}

async function callRpc(config: { url: string; publicKey: string }, name: string, body: Record<string, unknown>) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
  const response = await fetch(`${config.url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: config.publicKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: controller.signal,
  });
  const data = await response.json().catch(() => null) as unknown;
  if (!response.ok) {
    const message = data && typeof data === 'object' && 'message' in data && typeof data.message === 'string'
      ? data.message
      : 'The shared plan service did not respond.';
    throw new Error(message);
  }
  return data;
  } catch (error) {
    if(controller.signal.aborted || error instanceof Error && ['AbortError','TimeoutError'].includes(error.name)) {
      throw new Error('The connection took too long. Please retry. Your saved details are kept.');
    }
    if(error instanceof TypeError) throw new Error('Couldn’t connect. Check your internet connection and retry.');
    throw error;
  } finally { clearTimeout(timer); }
}

function getConfig() {
  if (!isRemotePlansConfigured()) throw new Error('Cloud sharing is not configured for this build yet.');
  return { url: supabaseUrl!, publicKey: supabasePublicKey! };
}

function requireHostToken(draft: PlanDraft) {
  if (draft.remote?.role !== 'host' || !draft.remote.hostToken) throw new Error('Only the plan host can change plan access.');
  return draft.remote.hostToken;
}

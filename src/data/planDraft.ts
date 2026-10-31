import AsyncStorage from '@react-native-async-storage/async-storage';
import { PlanDraft } from '../types';
import * as Crypto from 'expo-crypto';
import { googleReference, serializePlan } from '../features/meet/googlePlace';

const STORAGE_KEY = 'bojio.plan-draft.v1';
const listeners = new Set<(draft: PlanDraft) => void>();
export function subscribePlanDraft(listener: (draft: PlanDraft) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export const isPlanStorageKey = (key: string | null) => key === STORAGE_KEY || key === null;

export function createPlanCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(Crypto.getRandomBytes(6), (byte) => alphabet[byte % alphabet.length]).join('');
}

export async function loadPlanDraft(): Promise<PlanDraft | null> {
  await pendingSave;
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  if (!stored) return null;

  try {
    const parsed = JSON.parse(stored) as PlanDraft;
    if (!parsed || !parsed.code || !Array.isArray(parsed.participants)) throw new Error('Invalid saved plan');
    const draft = await withStickyHost(parsed);
    if(draft.chosenVenue?.source==='google_places') {
      draft.chosenVenue=googleReference(draft.chosenVenue); draft.chosenVenueId=draft.chosenVenue?.id;
      const sanitized=serializePlan(draft);
      if(sanitized!==stored){
        // Migration uses the same write queue and compares the original bytes:
        // a concurrent edit must not be replaced by an older loaded snapshot.
        pendingSave=pendingSave.catch(()=>undefined).then(async()=>{if(await AsyncStorage.getItem(STORAGE_KEY)===stored)await AsyncStorage.setItem(STORAGE_KEY,sanitized);});
        await pendingSave;
      }
    }
    if (draft.chosenVenue?.source === 'prototype' || (!draft.chosenVenue && draft.chosenVenueId)) {
      return { ...draft, chosenVenue: undefined, chosenVenueId: undefined };
    }
    return draft;
  } catch {
    throw new Error('Could not read the saved plan. Your stored data has not been replaced.');
  }
}

let pendingSave: Promise<unknown> = Promise.resolve();
export async function loadPartyDraft(code: string): Promise<PlanDraft | null> {
  await pendingSave;
  const value=await AsyncStorage.getItem(`bojio.party-draft:${code}`);
  if(!value)return null;
  try {const draft=JSON.parse(value) as PlanDraft;if(draft.code!==code||!Array.isArray(draft.participants))throw new Error();return draft;}
  catch {throw new Error('Could not read this party’s saved edits. They have not been replaced.');}
}
export type RememberedParty={code:string;role:'host'|'guest'|'local';names:string;meetupAt?:string;status?:string};
// Remove from the chooser only. Never destroy host access, bills or unsynced edits.
export function setPartyListed(code:string,listed:boolean) {
  if(!/^[A-HJ-NP-Z2-9]{6}$/.test(code))return Promise.reject(new Error('Invalid party code'));
  pendingSave=pendingSave.catch(()=>undefined).then(()=>AsyncStorage.setItem(`bojio.party-hidden:${code}`,listed?'0':'1'));
  return pendingSave;
}
export async function loadRememberedParties(): Promise<RememberedParty[]> {
  await pendingSave;
  const current=await loadPlanDraft();
  const keys=await AsyncStorage.getAllKeys();
  const codes=new Set(keys.filter(key=>/^bojio\.(?:plan-access|party-draft):[A-HJ-NP-Z2-9]{6}$/.test(key)).map(key=>key.split(':')[1]!));
  if(current)codes.add(current.code);
  const visible=await Promise.all([...codes].map(async code=>await AsyncStorage.getItem(`bojio.party-hidden:${code}`)==='1'?null:code));
  const parties=await Promise.all(visible.filter((code):code is string=>code!==null).map(async code=>{
    const draft=code===current?.code?current:await loadPartyDraft(code);
    const access=await loadPlanAccess(code);
    return {code,role:access?.role??'local',names:draft?.participants.map(p=>p.name).filter(Boolean).join(' · ')??'',meetupAt:draft?.meetupAt,status:draft?.status} as RememberedParty;
  }));
  return parties.sort((a,b)=>a.code===current?.code?-1:b.code===current?.code?1:(b.meetupAt??'').localeCompare(a.meetupAt??''));
}
export async function loadPlanAccess(code: string): Promise<PlanDraft['remote']> {
  await pendingSave.catch(() => undefined);
  const value = await AsyncStorage.getItem(`bojio.plan-access:${code}`);
  try { return value ? JSON.parse(value) : undefined; } catch { return undefined; }
}
/** Host capability kept when this browser later uses a different name. Normal open still reads plan-access. */
export async function loadHostAccess(code: string): Promise<{ hostToken: string; participantId?: string } | undefined> {
  await pendingSave.catch(() => undefined);
  try {
    const parsed = JSON.parse(await AsyncStorage.getItem(`bojio.host-access:${code}`) || 'null') as { hostToken?: unknown; participantId?: unknown } | null;
    if (!parsed || typeof parsed.hostToken !== 'string' || parsed.hostToken.length < 32) return;
    return { hostToken: parsed.hostToken, participantId: typeof parsed.participantId === 'string' ? parsed.participantId : undefined };
  } catch { return; }
}
export function savePlanDraft(draft: PlanDraft) {
  const serialized = serializePlan(draft);
  const snapshot = JSON.parse(JSON.stringify(draft)) as PlanDraft;
  // Publish edits immediately; disk writes remain ordered below. Consumers do not
  // need to wait for the 15-second shared-plan poll to see local Meet changes.
  for (const listener of listeners) listener(snapshot);
  pendingSave = pendingSave.catch(() => undefined).then(async () => {
    if (snapshot.remote?.role === 'host' && snapshot.remote.hostToken) {
      let participantId = snapshot.remote.participantId;
      try {
        const parsed = JSON.parse(await AsyncStorage.getItem(`bojio.host-access:${snapshot.code}`) || 'null') as { participantId?: unknown } | null;
        if (parsed && typeof parsed.participantId === 'string' && parsed.participantId) participantId = parsed.participantId;
      } catch { /* Keep the id on this draft when the backup cannot be read. */ }
      await AsyncStorage.setItem(`bojio.host-access:${snapshot.code}`, JSON.stringify({ hostToken: snapshot.remote.hostToken, participantId }));
    }
    if (snapshot.remote) await AsyncStorage.setItem(`bojio.plan-access:${snapshot.code}`, JSON.stringify(snapshot.remote));
    await AsyncStorage.setItem(`bojio.party-draft:${snapshot.code}`, serialized);
    await AsyncStorage.setItem(STORAGE_KEY, serialized);
  });
  return pendingSave;
}

/** Host identity stays on the person who created the party, even if a later draft points at someone else. */
async function withStickyHost(draft: PlanDraft): Promise<PlanDraft> {
  if (draft.remote?.role !== 'host') return draft;
  try {
    const parsed = JSON.parse(await AsyncStorage.getItem(`bojio.host-access:${draft.code}`) || 'null') as { participantId?: unknown } | null;
    const participantId = parsed && typeof parsed.participantId === 'string' ? parsed.participantId : undefined;
    if (!participantId || participantId === draft.remote.participantId || !draft.participants.some((person) => person.id === participantId)) return draft;
    return { ...draft, remote: { ...draft.remote, participantId } };
  } catch { return draft; }
}

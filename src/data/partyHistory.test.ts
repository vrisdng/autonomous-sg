import {describe,it,expect,vi} from 'vitest';
const values=vi.hoisted(()=>new Map<string,string>());
vi.mock('@react-native-async-storage/async-storage',()=>({default:{getItem:async(k:string)=>values.get(k)??null,setItem:async(k:string,v:string)=>{values.set(k,v);},getAllKeys:async()=>[...values.keys()]}}));
vi.mock('expo-crypto',()=>({getRandomBytes:()=>new Uint8Array(6)}));
import {savePlanDraft,loadPlanDraft,loadPartyDraft,loadRememberedParties,setPartyListed,loadPlanAccess,loadHostAccess} from './planDraft';
describe('remembered parties',()=>{
 it('removes only the list entry, survives saves, and can be undone without losing host access',async()=>{
  values.clear();const party={code:'ABC234',participants:[{id:'a',name:'Alice',origin:''}],remote:{role:'host' as const,hostToken:'keep-host'}};
  await savePlanDraft(party);await setPartyListed(party.code,false);await savePlanDraft(party);
  expect(await loadRememberedParties()).toEqual([]);expect((await loadPlanAccess(party.code))?.hostToken).toBe('keep-host');expect(await loadPartyDraft(party.code)).toEqual(party);
  await setPartyListed(party.code,true);expect(await loadRememberedParties()).toHaveLength(1);
 });
 it('keeps independent pending drafts and host/guest roles when switching',async()=>{
  values.clear();
  await savePlanDraft({code:'ABC234',participants:[{id:'a',name:'Alice',origin:''}],pendingSync:true,remote:{role:'host',hostToken:'test-host'}});
  await savePlanDraft({code:'DEF234',participants:[{id:'b',name:'Ben',origin:''}],remote:{role:'guest',participantId:'b',guestToken:'test-guest'}});
  expect((await loadPartyDraft('ABC234'))?.pendingSync).toBe(true);
  expect((await loadRememberedParties()).map(p=>[p.code,p.role])).toEqual([['DEF234','guest'],['ABC234','host']]);
 });
 it('discovers pre-upgrade access records without requiring a new history index',async()=>{
  values.clear();values.set('bojio.plan-access:ABC234',JSON.stringify({role:'host',hostToken:'test-host'}));
  expect(await loadRememberedParties()).toEqual([{code:'ABC234',role:'host',names:'',meetupAt:undefined,status:undefined}]);
 });
 it('keeps host access when the active session becomes another name',async()=>{
  values.clear();
  const hostToken='h'.repeat(64);
  await savePlanDraft({code:'ABC234',participants:[{id:'jun',name:'Jun',origin:''}],remote:{role:'host',hostToken,participantId:'jun'}});
  await savePlanDraft({code:'ABC234',participants:[{id:'ada',name:'Ada',origin:''}],remote:{role:'guest',participantId:'ada',guestToken:'g'.repeat(64)}});
  expect((await loadPlanAccess('ABC234'))?.role).toBe('guest');
  expect((await loadPlanAccess('ABC234'))?.participantId).toBe('ada');
  expect(await loadHostAccess('ABC234')).toEqual({hostToken,participantId:'jun'});
  await savePlanDraft({code:'ABC234',participants:[{id:'jun',name:'Jun',origin:''},{id:'lex',name:'Lex',origin:'Bedok'}],remote:{role:'host',hostToken,participantId:'lex'}});
  expect(await loadHostAccess('ABC234')).toEqual({hostToken,participantId:'jun'});
  expect((await loadPlanDraft())?.remote?.participantId).toBe('jun');
 });
 it('does not overwrite corrupt per-party edits',async()=>{
  values.clear();values.set('bojio.party-draft:ABC234','broken');
  await expect(loadPartyDraft('ABC234')).rejects.toThrow('not been replaced');expect(values.get('bojio.party-draft:ABC234')).toBe('broken');
 });
});

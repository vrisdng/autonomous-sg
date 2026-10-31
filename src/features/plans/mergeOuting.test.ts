import {describe,it,expect} from 'vitest';
import {mergeOuting} from './mergeOuting';
import {PlanDraft} from '../../types';
const person={id:'g',name:'Guest',origin:'Not set',transportMode:'either' as const};
const local:PlanDraft={code:'ABC234',participants:[person],syncedParticipants:[person],pendingSync:true,revision:1,chosenVenueId:'local-choice'};
describe('pending outing merge',()=>{
 it('retains local name edits but receives home and transport changes',()=>{
  const merged=mergeOuting({...local,participants:[{...person,name:'Edited'}]},{code:local.code,participants:[{...person,location:{label:'Home',latitude:1.3,longitude:103.8},transportMode:'ride'}],revision:2});
  expect(merged.participants[0]).toMatchObject({name:'Edited',transportMode:'ride',location:{label:'Home'}});
  expect(merged.revision).toBe(1);expect(merged.chosenVenueId).toBe('local-choice');
 });
 it('receives new participants and closure without resurrecting locally removed participants',()=>{
  const result=mergeOuting({...local,participants:[]},{code:local.code,status:'closed',participants:[person,{...person,id:'new'}]});
  expect(result.participants.map(p=>p.id)).toEqual(['new']);expect(result.status).toBe('closed');expect(result.pendingSync).toBe(true);
 });
 it('never merges another party',()=>expect(mergeOuting(local,{code:'XYZ234',participants:[]})).toBe(local));
 it('drops someone the live party removed even if this device edited them',()=>{
  const lex={id:'lex',name:'Lex',origin:'Not set',transportMode:'either' as const,location:{label:'Old home',latitude:1.31,longitude:103.82}};
  const mira={id:'mira',name:'Mira',origin:'Not set',transportMode:'either' as const};
  const merged=mergeOuting({...local,participants:[person,lex],syncedParticipants:[person,lex]},{code:local.code,participants:[person,mira],revision:3});
  expect(merged.participants.map(p=>p.id)).toEqual(['g','mira']);
 });
 it('keeps a home this device confirmed when the live party omits it',()=>{
  const home={label:'Blk 123',latitude:1.35,longitude:103.84};
  const kept=mergeOuting({...local,pendingSync:false,participants:[{...person,location:home}]},{code:local.code,participants:[person],revision:4});
  expect(kept.participants[0]!.location).toEqual(home);
  expect(kept.revision).toBe(4);
 });
 it('accepts a newer home from the live party',()=>{
  const incoming={label:'New home',latitude:1.33,longitude:103.85};
  const kept=mergeOuting({...local,pendingSync:false,participants:[{...person,location:{label:'Old',latitude:1.31,longitude:103.82}}]},{code:local.code,participants:[{...person,location:incoming}],revision:5});
  expect(kept.participants[0]!.location).toEqual(incoming);
 });
 it('accepts a friend home when this device only had an empty one',()=>{
  const friend={id:'f',name:'Friend',origin:'Not set',transportMode:'either' as const};
  const home={label:'221 example',latitude:1.347,longitude:103.754};
  const merged=mergeOuting({...local,remote:{role:'guest',participantId:'g',published:true},participants:[person,{...friend}],syncedParticipants:[person,{...friend,location:null as unknown as undefined}]},{code:local.code,participants:[person,{...friend,location:home}],revision:6});
  expect(merged.participants.find(p=>p.id==='f')?.location).toEqual(home);
 });
 it('keeps this device’s unsaved home edit',()=>{
  const home={label:'Mine',latitude:1.31,longitude:103.82};
  const merged=mergeOuting({...local,participants:[{...person,location:home}]},{code:local.code,participants:[{...person,location:{label:'Theirs',latitude:1.33,longitude:103.85}}],revision:7});
  expect(merged.participants[0]!.location).toEqual(home);
 });
 it('takes the shared leave-by on a guest device even with a pending home edit',()=>{
  const merged=mergeOuting({...local,commuteAt:'2026-10-03T09:07:00.000Z',meetupAt:'2026-10-03T08:00:00.000Z',remote:{role:'guest',participantId:'g',published:true},participants:[{...person,location:{label:'Mine',latitude:1.31,longitude:103.82}}]},{code:local.code,commuteAt:'2026-10-03T09:35:00.000Z',meetupAt:'2026-10-03T08:30:00.000Z',participants:[person],revision:8});
  expect(merged.commuteAt).toBe('2026-10-03T09:35:00.000Z');
  expect(merged.meetupAt).toBe('2026-10-03T08:30:00.000Z');
  expect(merged.participants[0]!.location?.label).toBe('Mine');
 });
 it('keeps the host leave-by edit until that save lands',()=>{
  const merged=mergeOuting({...local,commuteAt:'2026-10-03T09:35:00.000Z',remote:{role:'host',participantId:'g',hostToken:'h'.repeat(64),published:true}},{code:local.code,commuteAt:'2026-10-03T09:07:00.000Z',participants:[person],revision:8});
  expect(merged.commuteAt).toBe('2026-10-03T09:35:00.000Z');
 });
 it('keeps an unpublished person who was never on the confirmed roster',()=>{
  const draft={id:'draft',name:'Draft',origin:'Not set',transportMode:'either' as const};
  const merged=mergeOuting({...local,participants:[person,draft],syncedParticipants:[person]},{code:local.code,participants:[person],revision:3});
  expect(merged.participants.map(p=>p.id)).toEqual(['g','draft']);
 });
});

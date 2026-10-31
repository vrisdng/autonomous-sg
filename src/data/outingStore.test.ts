import {describe,it,expect,vi,beforeEach,afterEach} from 'vitest';
const mocks=vi.hoisted(()=>({load:vi.fn(),remote:vi.fn(),save:vi.fn(),listen:undefined as undefined|((plan:any)=>void)}));
vi.mock('./planDraft',()=>({loadPlanDraft:mocks.load,savePlanDraft:mocks.save,isPlanStorageKey:(key:string)=>key==='plan',subscribePlanDraft:(listener:any)=>{mocks.listen=listener;return()=>{};}}));
vi.mock('./remotePlans',()=>({isRemotePlansConfigured:()=>true,loadRemotePlan:mocks.remote,subscribeToRemotePlan:()=>()=>{}}));
describe('one outing subscription',()=>{
 beforeEach(()=>{vi.resetModules();mocks.load.mockReset();mocks.remote.mockReset();mocks.save.mockReset();});
 afterEach(()=>vi.restoreAllMocks());
 it('shares one refresh between consumers and does not overwrite an edit with an older response',async()=>{
  const plan={code:'ABC234',participants:[],remote:{published:true,role:'host'}};mocks.load.mockResolvedValue(plan);
  let resolve!:(value:unknown)=>void;mocks.remote.mockImplementation(()=>new Promise((done)=>{resolve=done;}));
  const {subscribeOuting,getOuting}=await import('./outingStore');
  const stop1=subscribeOuting(()=>{}),stop2=subscribeOuting(()=>{});
  await vi.waitFor(()=>expect(mocks.remote).toHaveBeenCalledTimes(1));
  mocks.listen!({...plan,pendingSync:true,participants:[{id:'new'}]});resolve(plan);
  await new Promise((done)=>setTimeout(done,10));expect(getOuting().plan?.participants).toEqual([{id:'new'}]);expect(mocks.save.mock.calls.at(-1)?.[0].participants).toEqual([{id:'new'}]);stop1();stop2();
 });
 it('refreshes friends while preserving pending edits and revision protection',async()=>{
  const guest={id:'g',name:'Guest',origin:'Not set'};
  mocks.load.mockResolvedValue({code:'ABC234',participants:[guest],syncedParticipants:[guest],revision:1,chosenVenueId:'local',pendingSync:true,remote:{published:true}});
  mocks.remote.mockResolvedValue({code:'ABC234',participants:[{...guest,location:{label:'Home',latitude:1.3,longitude:103.8}}],revision:2});
  const {subscribeOuting,getOuting}=await import('./outingStore');const stop=subscribeOuting(()=>{});
  await vi.waitFor(()=>expect(mocks.save).toHaveBeenCalled());expect(mocks.save.mock.calls[0]![0]).toMatchObject({chosenVenueId:'local',pendingSync:true,revision:1,participants:[{location:{label:'Home'}}]});stop();
 });
 it('applies a joiner who arrives while a refresh is already in flight',async()=>{
  const ada={id:'ada',name:'Ada',origin:'Not set'};
  const plan={code:'ABC234',participants:[ada],syncedParticipants:[ada],revision:4,pendingSync:true,remote:{published:true,role:'guest',participantId:'ada'}};
  mocks.load.mockResolvedValue(plan);
  let resolve!:(value:unknown)=>void;mocks.remote.mockImplementation(()=>new Promise((done)=>{resolve=done;}));
  mocks.save.mockImplementation((next:unknown)=>mocks.listen?.(next as never));
  const {subscribeOuting,getOuting}=await import('./outingStore');
  const stop=subscribeOuting(()=>{});
  await vi.waitFor(()=>expect(mocks.remote).toHaveBeenCalledTimes(1));
  const lex={id:'lex',name:'Lex',origin:'Not set'};
  resolve({code:'ABC234',participants:[ada,lex],revision:5});
  await vi.waitFor(()=>expect(getOuting().plan?.participants.map(person=>person.id)).toEqual(['ada','lex']));
  stop();
 });
});

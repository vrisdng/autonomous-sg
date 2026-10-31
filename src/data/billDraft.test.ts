import { beforeEach, describe, expect, it, vi } from 'vitest';
const storage=vi.hoisted(()=>({getItem:vi.fn(),setItem:vi.fn()}));
vi.mock('@react-native-async-storage/async-storage',()=>({default:storage}));
import { loadBillDraft, saveBillDraft, starterBillDraft } from './billDraft';
describe('bill persistence',()=>{
 beforeEach(()=>{storage.getItem.mockReset();storage.setItem.mockReset();});
 it('does not turn corrupt saved data into an empty bill',async()=>{
  storage.getItem.mockResolvedValue('{broken');
  await expect(loadBillDraft()).rejects.toThrow('not been replaced');expect(storage.setItem).not.toHaveBeenCalled();
 });
 it('orders writes and makes reads wait for the latest save',async()=>{
  let stored=''; const releases: (()=>void)[]=[];
  storage.setItem.mockImplementation((_key:string,value:string)=>new Promise<void>((resolve)=>{releases.push(()=>{stored=value;resolve();});}));
  storage.getItem.mockImplementation(async()=>stored);
  const first=saveBillDraft({...starterBillDraft,servicePercent:'1'},'ABC234');
  const second=saveBillDraft({...starterBillDraft,servicePercent:'2'},'ABC234');
  const read=loadBillDraft('ABC234');
  await vi.waitFor(()=>expect(releases).toHaveLength(1));
  expect(storage.getItem).not.toHaveBeenCalled(); releases[0]!(); await first;
  await vi.waitFor(()=>expect(releases).toHaveLength(2)); releases[1]!(); await second;
  expect((await read).servicePercent).toBe('2');
 });
 it('keeps a saved bill claimable when it predates total confirmation',async()=>{
  storage.getItem.mockResolvedValue(JSON.stringify({ ...starterBillDraft, requiresTotalConfirmation: undefined, finalTotal: '32.00', items: [{ id: 'i', name: 'Rice', price: '32.00', claimantIds: [] }] }));
  expect((await loadBillDraft()).requiresTotalConfirmation).toBe(false);
  storage.getItem.mockResolvedValue(null);
  expect((await loadBillDraft()).requiresTotalConfirmation).toBe(true);
 });
 it('allows a later save to recover after a rejected write',async()=>{
  storage.setItem.mockRejectedValueOnce(new Error('storage full')).mockResolvedValue(undefined);
  await expect(saveBillDraft(starterBillDraft)).rejects.toThrow('storage full');
  await expect(saveBillDraft(starterBillDraft)).resolves.toBeUndefined();
 });
});

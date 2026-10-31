import {describe,it,expect,vi} from 'vitest';
const storage=vi.hoisted(()=>({getItem:vi.fn(),setItem:vi.fn()}));
vi.mock('@react-native-async-storage/async-storage',()=>({default:storage}));
vi.mock('expo-crypto',()=>({getRandomBytes:()=>new Uint8Array(6)}));
import {loadPlanDraft,savePlanDraft} from './planDraft';
describe('plan recovery safety',()=>{
 it('surfaces corrupt storage without creating an empty plan',async()=>{storage.getItem.mockResolvedValue('{broken');await expect(loadPlanDraft()).rejects.toThrow('not been replaced');expect(storage.setItem).not.toHaveBeenCalled();});
 it('does not read an older disk copy after a save failed',async()=>{storage.setItem.mockRejectedValueOnce(new Error('disk full'));await expect(savePlanDraft({code:'ABC234',participants:[]})).rejects.toThrow('disk full');await expect(loadPlanDraft()).rejects.toThrow('disk full');storage.setItem.mockResolvedValue(undefined);await savePlanDraft({code:'ABC234',participants:[]});});
});

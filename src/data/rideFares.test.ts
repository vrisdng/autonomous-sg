import {describe,it,expect,vi,beforeEach} from 'vitest';
const storage=vi.hoisted(()=>({getItem:vi.fn(),setItem:vi.fn()}));
vi.mock('@react-native-async-storage/async-storage',()=>({default:storage}));
import {loadRideFares,saveRideFares} from './rideFares';
describe('fare persistence',()=>{
 beforeEach(()=>{storage.getItem.mockReset();storage.setItem.mockReset();});
 it('does not overwrite malformed fare data',async()=>{storage.getItem.mockResolvedValue('{bad');await expect(loadRideFares('a')).rejects.toThrow();expect(storage.setItem).not.toHaveBeenCalled();});
 it('serializes edits and waits before reopening fares',async()=>{
  let stored='';let release!:()=>void;
  storage.setItem.mockImplementationOnce((_:string,value:string)=>new Promise<void>((resolve)=>{release=()=>{stored=value;resolve();};})).mockImplementation(async(_:string,value:string)=>{stored=value;});
  storage.getItem.mockImplementation(async()=>stored);
  const first=saveRideFares('key',{a:'10'}),second=saveRideFares('key',{a:'10.01'}),read=loadRideFares('key');
  await vi.waitFor(()=>expect(release).toBeTypeOf('function'));expect(storage.getItem).not.toHaveBeenCalled();release();await first;await second;expect(await read).toEqual({a:'10.01'});
 });
});

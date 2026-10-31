import {it,expect,vi} from 'vitest';
const values=vi.hoisted(()=>new Map<string,string>());
vi.mock('@react-native-async-storage/async-storage',()=>({default:{getItem:async(k:string)=>values.get(k)??null,setItem:async(k:string,v:string)=>{values.set(k,v);}}}));
import {rememberHome,loadSavedHome,forgetHome,rememberPartyHome,loadPartyHome} from './savedHome';
it('remembers the same name across parties without sharing another name’s home',async()=>{
 const location={label:'Home',latitude:1.3,longitude:103.8};
 await rememberHome(' Alice ',location);expect(await loadSavedHome('alice')).toEqual(location);expect(await loadSavedHome('Ben')).toBeUndefined();
 await forgetHome('ALICE');expect(await loadSavedHome('Alice')).toBeNull();
});
it('keeps one party home without copying it onto another party or person',async()=>{
 const location={label:'Blk 10 Ang Mo Kio Avenue 3 Singapore 560123',latitude:1.37,longitude:103.84};
 await rememberPartyHome('NVK8AQ','weining',location);
 expect(await loadPartyHome('NVK8AQ','weining')).toEqual(location);
 expect(await loadPartyHome('OTHER1','weining')).toBeUndefined();
 expect(await loadPartyHome('NVK8AQ','guest')).toBeUndefined();
 await forgetHome('weining');
 expect(await loadPartyHome('NVK8AQ','weining')).toEqual(location);
});
it('rejects invalid data rather than replacing it with an empty address',async()=>{
 await expect(rememberHome('Ben',{label:'Invalid',latitude:0,longitude:0})).rejects.toThrow();expect(await loadSavedHome('Ben')).toBeUndefined();
});

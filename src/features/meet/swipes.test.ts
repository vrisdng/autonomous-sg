import { expect,it } from 'vitest';
import { rankSwipes,SwipeState } from './swipes';
import { googleReference } from './googlePlace';
it.each([3,5,6,10])('ranks by likes then fewer passes for %i voters',count=>{
 const state:SwipeState={venues:['a','b','c'].map(id=>googleReference({source:'google_places',providerPlaceId:id})!),voters:Array.from({length:count},(_,i)=>String(i)),swipes:[{voterId:'0',venueId:'google-a',choice:'like'},{voterId:'0',venueId:'google-b',choice:'like'},{voterId:'1',venueId:'google-a',choice:'pass'},{voterId:'1',venueId:'google-b',choice:'neutral'}]};
 const results=rankSwipes(state);expect(results[0]!.place.id).toBe('google-b');expect(results[0]!.waiting).toBe(count-2);expect(results[0]!.neutral).toBe(1);expect(results[1]!.likes).toBe(1);
});
it('keeps deck order for exact ties and ignores departed voters',()=>{const state:SwipeState={venues:['b','a'].map(id=>googleReference({source:'google_places',providerPlaceId:id})!),voters:['host'],swipes:[{voterId:'gone',venueId:'google-a',choice:'like'}]};expect(rankSwipes(state).map(r=>r.place.id)).toEqual(['google-b','google-a']);expect(rankSwipes(state)[0]!.waiting).toBe(1);});

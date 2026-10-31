import { Place } from '../../types';
export type Choice='like'|'pass'|'neutral';
export type Swipe={voterId:string;venueId:string;choice:Choice;special?:boolean};
export type SwipeState={venues:Place[];voters:string[];swipes:Swipe[]};
export function rankSwipes(state:SwipeState){
 return state.venues.map((place,index)=>{const rows=state.swipes.filter(s=>s.venueId===place.id&&state.voters.includes(s.voterId));return {place,index,likes:rows.filter(s=>s.choice==='like').length,passes:rows.filter(s=>s.choice==='pass').length,neutral:rows.filter(s=>s.choice==='neutral').length,waiting:Math.max(0,state.voters.length-rows.length)};}).sort((a,b)=>b.likes-a.likes||a.passes-b.passes||a.index-b.index);
}

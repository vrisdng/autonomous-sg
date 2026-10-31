import { useEffect, useRef, useState } from 'react';
import { callRemoteRpc } from '../data/remotePlans';
import { Place, PlanDraft } from '../types';
import { validLocation } from '../features/travel/types';
import { googleReference, persistedVenue } from '../features/meet/googlePlace';

export type VenueVote = { voterId: string; venue: Place };
function parseVotes(value: unknown): VenueVote[] {
  if (!Array.isArray(value) || !value.every((row) => typeof row?.voterId === 'string' && (googleReference(row?.venue) || (typeof row?.venue?.id === 'string' && validLocation({label:row.venue.name,latitude:row.venue.latitude,longitude:row.venue.longitude}))))) throw new Error('Could not read venue votes. Retry.');
  // Votes may contain guest-supplied addresses: never import their claimed reviews,
  // operator links, opening hours, or verified-source labels into venue cards.
  return value.map((row)=>({voterId:row.voterId,venue:googleReference(row.venue) ?? {id:row.venue.id,name:row.venue.name,address:row.venue.name,latitude:row.venue.latitude,longitude:row.venue.longitude,source:'onemap',area:'Singapore',nearestStation:'',detail:'Group-suggested address. Check the venue before confirming.',openUntil:'Hours unknown',tags:[],point:{x:row.venue.longitude,y:row.venue.latitude}}}));
}
export function useVenueVotes(plan?: PlanDraft) {
  const [votes,setVotes] = useState<VenueVote[]>([]);
  const [error,setError] = useState('');
  const [saving,setSaving] = useState(false);
  const version = useRef(0);
  const writing = useRef(false);
  const token = plan?.remote?.role === 'host' ? plan.remote.hostToken : plan?.remote?.guestToken;
  const voterId = plan?.remote?.role === 'guest' ? `guest:${plan.remote.participantId ?? ''}` : 'host';
  const shared = Boolean(plan?.remote?.published);
  const refresh = async () => {
    if (!shared || !plan || writing.current) return;
    const current=++version.current;
    try { const value=parseVotes(await callRemoteRpc('get_venue_votes',{p_code:plan.code})); if(current===version.current){setVotes(value);setError('');} }
    catch(cause){if(current===version.current)setError(cause instanceof Error ? cause.message : 'Could not load votes. Retry.');}
  };
  useEffect(()=>{
    setVotes([]);setError('');setSaving(false);writing.current=false;
    void refresh();
    const timer=setInterval(()=>void refresh(),15000);
    const online=()=>void refresh();
    if(typeof window!=='undefined')window.addEventListener('online',online);
    return()=>{version.current++;clearInterval(timer);if(typeof window!=='undefined')window.removeEventListener('online',online);};
  },[plan?.code,shared,token]);
  const vote = async (venue: Place) => {
    if (!plan || writing.current) return;
    if (!shared) {setError('Save a shared plan first to start voting with friends.');return;}
    if (!token || (plan.remote?.role==='guest' && !plan.remote.participantId)) {setError('Save your entry above before voting.');return;}
    if (plan.status==='closed') {setError('This plan is closed. Voting is paused.');return;}
    writing.current=true;setSaving(true);setError('');
    const current=++version.current;
    const remove=votes.some((row)=>row.voterId===voterId && row.venue.id===venue.id);
    try {
      const value=parseVotes(await callRemoteRpc('set_venue_vote',{p_code:plan.code,p_token:token,p_venue:remove?null:persistedVenue(venue)}));
      if(current===version.current)setVotes(value);
    } catch(cause) {if(current===version.current)setError(`Vote not confirmed. ${cause instanceof Error ? cause.message : 'Please retry.'}`);}
    finally {if(current===version.current){writing.current=false;setSaving(false);}}
  };
  return {votes,voterId,saving,error,vote,refresh};
}

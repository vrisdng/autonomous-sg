import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { ensurePlace, placesRevision, resolvedPlace, subscribePlaces } from '../data/googlePlaces';
import { getOuting, subscribeOuting, refreshOuting } from '../data/outingStore';

export function useOuting() {
  const state=useSyncExternalStore(subscribeOuting,getOuting);
  const revision=useSyncExternalStore(subscribePlaces,placesRevision);
  const id=state.plan?.chosenVenue?.source==='google_places'?state.plan.chosenVenue.providerPlaceId:undefined;
  useEffect(()=>{if(id)void ensurePlace(id);},[id]);
  const plan=useMemo(()=>state.plan?{...state.plan,chosenVenue:resolvedPlace(state.plan.chosenVenue)}:null,[state.plan,revision]);
  return { ...state, plan, refresh:refreshOuting };
}

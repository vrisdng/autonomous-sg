import {GeoLocation, Participant, PlanDraft} from '../../types';
import {validLocation} from '../travel/types';

function sameLocation(left?: GeoLocation | null, right?: GeoLocation | null) {
  const leftReady=validLocation(left);
  const rightReady=validLocation(right);
  if(!leftReady||!rightReady) return leftReady===rightReady;
  return left.label===right.label&&left.latitude===right.latitude&&left.longitude===right.longitude;
}

// A remote payload that omits home must not erase an address this device already confirmed.
export function keepConfirmedHomes(local: PlanDraft, remote: PlanDraft): PlanDraft {
  if(local.code!==remote.code) return remote;
  let changed=false;
  const participants=remote.participants.map(person=>{
    if(validLocation(person.location)) return person;
    const previous=local.participants.find(p=>p.id===person.id);
    if(!validLocation(previous?.location)) return person;
    changed=true;
    return {...person,location:previous.location};
  });
  return changed?{...remote,participants}:remote;
}

// Keep local edits and their original revision: a later publish must still pass
// the server's conflict check. Participant changes on other devices remain visible.
export function mergeOuting(local: PlanDraft, remote: PlanDraft): PlanDraft {
  if(local.code!==remote.code) return local;
  if(!local.pendingSync) return keepConfirmedHomes(local, remote);
  const base=local.syncedParticipants;
  const participants=local.participants.flatMap(person=>{
    const previous=base?.find(p=>p.id===person.id);
    const incoming=remote.participants.find(p=>p.id===person.id);
    // The live party is the membership source. A field edit must not keep
    // someone the server has already dropped (the Last call ghost). Keep a
    // local person only when they were added on this device after the last
    // confirmed roster.
    if(!incoming) return previous ? [] : [person];
    if(!previous) return [person.id===local.remote?.participantId?person:{...person,...incoming}];
    const merged={...person};
    for(const field of ['name','origin','location','transportMode'] as const){
      // An empty home is stored as either null or omitted. Treat those as the
      // same synced value so a friend's newly shared home is not stuck locally.
      const unchanged=field==='location'
        ? sameLocation(person.location, previous.location)
        : JSON.stringify(person[field])===JSON.stringify(previous[field]);
      if(unchanged) Object.assign(merged,{[field]:incoming[field]});
    }
    return [merged];
  });
  for(const incoming of remote.participants){
    if(!local.participants.some(p=>p.id===incoming.id)&&!base?.some(p=>p.id===incoming.id))participants.push(incoming);
  }
  // Guests cannot edit the shared clock. A pending home edit must not keep the
  // create-time leave-by after the host has saved a new one.
  const schedule=local.remote?.role==='guest'
    ? {meetupAt:remote.meetupAt,commuteAt:remote.commuteAt}
    : {meetupAt:local.meetupAt,commuteAt:local.commuteAt};
  return keepConfirmedHomes(local,{...local,...schedule,participants:participants as Participant[],status:remote.status,expiresAt:remote.expiresAt,syncedParticipants:remote.participants});
}

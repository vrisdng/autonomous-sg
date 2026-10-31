import { Participant } from '../../types';
import { DriveLeg, validLocation } from '../travel/types';
import { shortlistRidePairs } from './shortlist';

/** Homes that can be dropped off now. Someone still missing a home does not block the others. */
export function rideMatchRoster(people: Participant[]) {
  const ready: Participant[] = [];
  const waiting: Participant[] = [];
  for (const person of people) (validLocation(person.location) ? ready : waiting).push(person);
  return { ready, waiting };
}

/** Groups are comparable only when every home leg and every shortlisted pair has a duration. */
export function rideMatrixReady(people: Participant[], legs: DriveLeg[]) {
  if (!people.length) return false;
  const have = new Set(legs.filter((leg) => Number.isFinite(leg.seconds) && leg.seconds >= 0).map((leg) => `${leg.from}:${leg.to}`));
  for (const person of people) if (!have.has(`venue:${person.id}`)) return false;
  for (const [from, to] of shortlistRidePairs(people)) if (!have.has(`${from}:${to}`) || !have.has(`${to}:${from}`)) return false;
  return true;
}

export type ActualRide = { id: string; riders: Participant[]; dropOrder: Participant[]; seconds: number | null; extraSeconds: number | null; detours: Record<string, number>; complete: boolean };
export function matchActualRides(people: Participant[], legs: DriveLeg[]): ActualRide[] {
  const ordered = [...people].sort((a,b) => a.id.localeCompare(b.id));
  const durations = new Map(legs.filter((leg) => Number.isFinite(leg.seconds) && leg.seconds >= 0).map((leg) => [`${leg.from}:${leg.to}`,leg.seconds]));
  const seconds = (from: string, to: string) => durations.get(`${from}:${to}`);
  const permutations = (items: Participant[]): Participant[][] => items.length ? items.flatMap((item,index) => permutations(items.filter((_,i) => i !== index)).map((tail) => [item,...tail])) : [[]];
  const candidates: { mask: number; ride: ActualRide }[] = [];
  const add = (riders: Participant[], mask: number) => {
    if (riders.some((person) => seconds('venue',person.id) === undefined || riders.some((other) => other.id !== person.id && seconds(person.id,other.id) === undefined))) return;
    const options = permutations(riders).map((dropOrder) => {
      let elapsed = 0; let from = 'venue'; const detours: Record<string,number> = {};
      for (const person of dropOrder) { elapsed += seconds(from,person.id)!; detours[person.id] = Math.max(0,elapsed-seconds('venue',person.id)!); from=person.id; }
      return { dropOrder,seconds:elapsed,detours,extraSeconds:Math.max(...Object.values(detours)) };
    }).filter((option) => option.extraSeconds <= 900).sort((a,b) => a.extraSeconds-b.extraSeconds || a.seconds-b.seconds || a.dropOrder.map((p)=>p.id).join(':').localeCompare(b.dropOrder.map((p)=>p.id).join(':')));
    for(const option of options)candidates.push({mask,ride:{id:riders.map((p)=>p.id).join(':'),riders,...option,complete:true}});
  };
  const combinations = (start: number, riders: Participant[], mask: number) => {
    if (riders.length >= 2) add(riders,mask);
    if (riders.length === 4) return;
    for (let index=start;index<ordered.length;index++) combinations(index+1,[...riders,ordered[index]!],mask|(1<<index));
  };
  combinations(0,[],0);
  type Solution = { groups: ActualRide[]; shared: number; worst: number; total: number; key: string };
  const memo = new Map<number,Solution>();
  let worstLimit=900;
  let minimizeTotal=false;
  const solve = (mask: number): Solution => {
    if (!mask) return {groups:[],shared:0,worst:0,total:0,key:''};
    const saved=memo.get(mask); if(saved)return saved;
    const index=ordered.findIndex((_,i)=>Boolean(mask&(1<<i))); const person=ordered[index]!;
    const choices=[{mask:1<<index,ride:{id:person.id,riders:[person],dropOrder:[person],seconds:seconds('venue',person.id)??null,extraSeconds:null,detours:{},complete:seconds('venue',person.id)!==undefined} as ActualRide},...candidates.filter((item)=>(item.mask&(1<<index)) && (item.mask&mask)===item.mask && item.ride.extraSeconds!<=worstLimit)];
    const options=choices.map((choice)=>{const rest=solve(mask^choice.mask);const groups=[choice.ride,...rest.groups];return {groups,shared:rest.shared+(choice.ride.riders.length>1?choice.ride.riders.length:0),worst:Math.max(rest.worst,choice.ride.extraSeconds??0),total:rest.total+(choice.ride.seconds??0),key:groups.map((g)=>g.id).join('|')};});
    const best=options.sort((a,b)=>b.shared-a.shared||(!minimizeTotal?a.worst-b.worst:0)||a.total-b.total||a.key.localeCompare(b.key))[0]!;
    memo.set(mask,best);return best;
  };
  const mask=(1<<ordered.length)-1;
  worstLimit=solve(mask).worst;minimizeTotal=true;memo.clear();
  return solve(mask).groups;
}
export function splitEnteredFare(value: string, ids: string[]) {
  if (!/^\d{1,5}(\.\d{1,2})?$/.test(value.trim()) || !ids.length) return null;
  const cents = Math.round(Number(value)*100);
  const sorted = [...new Set(ids)].sort();
  return Object.fromEntries(sorted.map((id,index) => [id, Math.floor(cents/sorted.length)+(index<cents%sorted.length ? 1 : 0)]));
}

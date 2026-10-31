import { describe,it,expect } from 'vitest';
import { matchActualRides,rideMatchRoster,rideMatrixReady,splitEnteredFare } from './actualRides';
import { shortlistRidePairs } from './shortlist';
import { directions } from '../travel/types';
const people=Array.from({length:4},(_,i)=>({id:String(i),name:`P${i}`,origin:'Test',location:{label:'Test',latitude:1.3+i*.001,longitude:103.8}}));
const legs=people.flatMap((a)=>[{from:'venue',to:a.id,seconds:600+Number(a.id)*100},...people.filter((b)=>a.id!==b.id).map((b)=>({from:a.id,to:b.id,seconds:Math.abs(Number(a.id)-Number(b.id))*100}))]);
describe('up to four passengers',()=>{
 it('checks four-rider orders and individual detours',()=>{
  const rides=matchActualRides(people,legs);expect(rides).toHaveLength(1);expect(rides[0]!.riders).toHaveLength(4);expect(Object.values(rides[0]!.detours)).toEqual([0,0,0,0]);
 });
 it('never confirms a group without every order being checkable',()=>{
  const rides=matchActualRides(people,legs.filter((leg)=>!(leg.from==='0' && leg.to==='1')));expect(rides.every((ride)=>ride.riders.length<4)).toBe(true);
 });
 it('splits five riders and rejects overlong individual detours',()=>{
  const five=[...people,{...people[0]!,id:'4'}];
  const matrix=five.flatMap((a)=>[{from:'venue',to:a.id,seconds:600},...five.filter((b)=>b.id!==a.id).map((b)=>({from:a.id,to:b.id,seconds:500}))]);
  const groups=matchActualRides(five,matrix);expect(groups.every((g)=>g.riders.length<=4)).toBe(true);expect(groups.every((g)=>Object.values(g.detours).every((seconds)=>seconds<=900))).toBe(true);expect(new Set(groups.flatMap((g)=>g.riders.map((p)=>p.id))).size).toBe(5);
 });
 it('bounds a 12-person shortlist and includes all pairs for four',()=>{
  expect(shortlistRidePairs(people)).toHaveLength(6);expect(shortlistRidePairs(Array.from({length:12},(_,i)=>({...people[0]!,id:String(i)})))).toHaveLength(12);
 });
 it('shows groups only when every home and shortlisted pair has been checked',()=>{
  const pair=people.slice(0,2);
  const full=pair.flatMap((person)=>[{from:'venue',to:person.id,seconds:600},...pair.filter((other)=>other.id!==person.id).map((other)=>({from:person.id,to:other.id,seconds:120}))]);
  expect(rideMatrixReady(pair,full)).toBe(true);
  expect(rideMatrixReady(pair,full.filter((leg)=>leg.from!=='venue'))).toBe(false);
  expect(rideMatrixReady(pair,full.filter((leg)=>!(leg.from==='0'&&leg.to==='1')))).toBe(false);
 });
 it('matches friends who already have homes while someone is still missing one',()=>{
  const waiting={id:'x',name:'xh',origin:'Location not set'};
  const roster=rideMatchRoster([...people.slice(0,2),waiting]);
  expect(roster.waiting.map((person)=>person.id)).toEqual(['x']);
  const matrix=roster.ready.flatMap((a)=>[{from:'venue',to:a.id,seconds:600},...roster.ready.filter((b)=>b.id!==a.id).map((b)=>({from:a.id,to:b.id,seconds:120}))]);
  const rides=matchActualRides(roster.ready,matrix);
  expect(rides.some((ride)=>ride.riders.length===2)).toBe(true);
  expect(rides.some((ride)=>ride.riders.some((person)=>person.id==='x'))).toBe(false);
 });
 it('supports three intermediate stops and exact four-way cents',()=>{
  const url=new URL(directions(people[0]!.location,people[3]!.location,'driving',people.slice(0,3).map((p)=>p.location)));
  expect(url.searchParams.get('waypoints')?.split('|')).toHaveLength(3);
  expect(splitEnteredFare('10.01',['3','2','1','0'])).toEqual({'0':251,'1':250,'2':250,'3':250});
 });
});

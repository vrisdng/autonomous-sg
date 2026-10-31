import { describe,it,expect } from 'vitest';
import { createCoordinator } from './coordinator';
const tick=()=>new Promise((resolve)=>setTimeout(resolve,10));
describe('shared route coordinator',()=>{
 it('shares identical requests without cancelling another consumer',async()=>{
  let finish!:(values:number[])=>void;let calls=0;let providerSignal:AbortSignal|undefined;
  const request=createCoordinator<string,number>((key)=>key,async(_,signal)=>{calls++;providerSignal=signal;return new Promise((resolve)=>{finish=resolve;});});
  const controller=new AbortController();const first=request('same',controller.signal);const rejected=expect(first).rejects.toThrow('cancelled');
  const second=request('same');await tick();controller.abort();await rejected;
  expect(providerSignal?.aborted).toBe(false);finish([42]);expect(await second).toBe(42);expect(calls).toBe(1);
 });
 it('cancels the underlying work when every subscriber leaves',async()=>{
  let aborted=false;
  const request=createCoordinator<string,number>((key)=>key,async(_,signal)=>new Promise((_,reject)=>signal.addEventListener('abort',()=>{aborted=true;reject(new Error('cancelled'));})));
  const controller=new AbortController();const result=request('a',controller.signal);const rejected=expect(result).rejects.toThrow('cancelled');await tick();controller.abort();await rejected;expect(aborted).toBe(true);
 });
 it('batches unique queued work and does not cache completed values',async()=>{
  const batches:string[][]=[];
  const request=createCoordinator<string,string>((key)=>key,async(items)=>{batches.push(items);return items;});
  expect(await Promise.all(['a','b','c','d','e'].map((key)=>request(key)))).toEqual(['a','b','c','d','e']);
  expect(batches.map((items)=>items.length)).toEqual([4,1]);await request('a');expect(batches).toHaveLength(3);
 });
});

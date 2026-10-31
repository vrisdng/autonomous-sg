import { isPlanStorageKey, loadPlanDraft, savePlanDraft, subscribePlanDraft } from './planDraft';
import { isRemotePlansConfigured, loadRemotePlan, subscribeToRemotePlan } from './remotePlans';
import { PlanDraft } from '../types';
import { mergeOuting } from '../features/plans/mergeOuting';
type State = { plan: PlanDraft | null; error: string; loaded: boolean };
let state: State={plan:null,error:'',loaded:false};
const listeners=new Set<()=>void>();
let revision=0;
let stop: (()=>void)|undefined;
let refreshing=false;
let followRemote=false;
let diskEpoch=0;
let stopRemote: (()=>void)|undefined;
let watched='';
export const getOuting=()=>state;
const watchRemote=(plan: PlanDraft | null)=>{
  const code=plan?.remote?.published && isRemotePlansConfigured() ? plan.code : '';
  if(code===watched)return;
  stopRemote?.();stopRemote=undefined;watched=code;
  if(code)stopRemote=subscribeToRemotePlan(code,()=>void refreshOuting(true),()=>undefined);
};
const emit=(next:State)=>{state=next;watchRemote(next.plan);for(const listener of listeners)listener();};
export async function refreshOuting(includeRemote=true) {
  if(refreshing){if(includeRemote)followRemote=true;return;}
  refreshing=true;
  const started=revision;
  const diskAtStart=diskEpoch;
  try {
    let draft=await loadPlanDraft();
    if(started!==revision && state.plan)draft=state.plan;
    else if(started===revision)emit({plan:draft,error:'',loaded:true});
    if(includeRemote && draft?.remote?.published && isRemotePlansConfigured()) {
      const remote=await loadRemotePlan(draft.code,draft.remote);
      // Another tab wrote the plan while this request was open. Don't save over
      // that copy; the follow-up reads the disk and then the live party.
      if(diskEpoch!==diskAtStart){followRemote=true;return;}
      const latest=revision!==started && state.plan?.code===remote.code ? state.plan : draft;
      const merged=mergeOuting(latest,remote);
      if(JSON.stringify(merged)!==JSON.stringify(state.plan))await savePlanDraft(merged);
    }
  }catch(error){if(started===revision)emit({...state,loaded:true,error:error instanceof Error?error.message:'Could not refresh the plan. Retry when connected.'});}
  finally{refreshing=false;if(followRemote){followRemote=false;void refreshOuting(true);}}
}
export function subscribeOuting(listener:()=>void){
  listeners.add(listener);
  if(!stop){
    const unsubscribe=subscribePlanDraft((plan)=>{revision++;emit({plan,error:'',loaded:true});});
    void refreshOuting();
    const timer=setInterval(()=>void refreshOuting(),15000);
    const storage=(event:StorageEvent)=>{if(isPlanStorageKey(event.key)){diskEpoch++;revision++;void refreshOuting(true);}};
    const online=()=>void refreshOuting();
    if(typeof window!=='undefined'){window.addEventListener('storage',storage);window.addEventListener('online',online);}
    stop=()=>{revision++;unsubscribe();clearInterval(timer);stopRemote?.();stopRemote=undefined;watched='';if(typeof window!=='undefined'){window.removeEventListener('storage',storage);window.removeEventListener('online',online);}};
  }
  return()=>{listeners.delete(listener);if(!listeners.size){stop?.();stop=undefined;}};
}

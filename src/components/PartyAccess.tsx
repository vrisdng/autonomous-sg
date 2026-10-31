import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, CloseButton } from './Ui';
import { parseJoinAttempt, tokenForTypedName } from '../data/partyJoin';
import { createPlanCode, loadHostAccess, loadPartyDraft, loadPlanDraft, loadRememberedParties, RememberedParty, savePlanDraft, setPartyListed } from '../data/planDraft';
import { SwipePartyRow } from './SwipePartyRow';
import { SupperKaki } from './SupperKaki';
import { joinParty, loadRemotePlan, prepareRemoteHost, publishRemotePlan } from '../data/remotePlans';
import { copyPlainText } from '../features/clipboard';
import { createPlanInviteMessage, createPlanShareUrl, getPlanCodeFromUrl, isPlanCode, normalizePlanCode } from '../features/plans/links';
import { serializePlan } from '../features/meet/googlePlace';
import { keepConfirmedHomes } from '../features/plans/mergeOuting';
import { PlanDraft } from '../types';
import { colors } from '../theme';

const newToken=()=>Crypto.randomUUID().replace(/-/g,'')+Crypto.randomUUID().replace(/-/g,'');
export function PartyAccess({code,onClose,onEntered}:{code?:string;onClose:()=>void;onEntered:()=>void}) {
 const [party,setParty]=useState<PlanDraft>();
 const [current,setCurrent]=useState<PlanDraft|null>();
 const [name,setName]=useState(''),[input,setInput]=useState(code??'');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [creating,setCreating]=useState(false);
 const [joining,setJoining]=useState(false);
 const [sharing,setSharing]=useState(false);
 const [justCreated,setJustCreated]=useState(false);
 const [copied,setCopied]=useState<'link'|'code'|'invite'|''>('');
 const [fallback,setFallback]=useState('');
 const [chooseAnother,setChooseAnother]=useState(false);
 const [hostBackup,setHostBackup]=useState<{hostToken:string;participantId?:string}>();
 const [history,setHistory]=useState<RememberedParty[]>([]);
 const [revealed,setRevealed]=useState<string>();
 const [removed,setRemoved]=useState<string>();
 const creation=useRef<PlanDraft | undefined>(undefined);
 const active=useRef(true),locked=useRef(false),attempt=useRef(newToken());
 const run=async(action:()=>Promise<void>)=>{
  if(locked.current)return;locked.current=true;setBusy(true);setError('');setNotice('');
  try{await action();}catch(cause){if(active.current)setError(cause instanceof Error?cause.message:'Please try again.');}
  finally{locked.current=false;if(active.current)setBusy(false);}
 };
 const enter=async(next:PlanDraft,replaceIdentity=false)=>{
  if(!active.current)return;
  const old=await loadPlanDraft();
  if(old && old.code!==next.code)await savePlanDraft(old);
  if(old?.pendingSync && (old.code!==next.code || JSON.stringify(old)!==JSON.stringify(next)))await AsyncStorage.setItem('bojio.plan-recovery',serializePlan(old));
  // Finish durable storage before dismissing the gate or mounting the outing.
  // Continuing the same person keeps their pending edits. Change name commits the joined roster.
  const retained=old?.code===next.code?old:await loadPartyDraft(next.code);
  const samePerson=!replaceIdentity && !!retained && retained.remote?.role===next.remote?.role && retained.remote?.participantId===next.remote?.participantId;
  const adopted=samePerson && retained?.pendingSync && next.status!=='closed'?{...retained,remote:next.remote??retained.remote}:next;
  await savePlanDraft(retained?keepConfirmedHomes(retained,adopted):adopted);
  await setPartyListed(next.code,true);
  if(active.current)onEntered();
 };
 const open=async(raw:string)=>{
  const target=getPlanCodeFromUrl(raw)||normalizePlanCode(raw);
  if(!isPlanCode(target))throw new Error('Enter the six-character party code or paste the invite link.');
  const remote=await loadRemotePlan(target);
  if(!active.current)return;
  setParty(remote);setCreating(false);setChooseAnother(false);setSharing(false);
 };
 useEffect(()=>{
  active.current=true;
  void run(async()=>{const saved=await loadPlanDraft();const remembered=await loadRememberedParties();if(!active.current)return;setCurrent(saved);setHistory(remembered);if(code)await open(code);else if(saved?.remote?.role==='host'&&!saved.remote.published){creation.current=saved;setCreating(true);setName(saved.participants.find(p=>p.id===saved.remote?.participantId)?.name??'');setNotice('Your last creation wasn’t confirmed. Retry to recover the same party.');}});
  return()=>{active.current=false;};
 },[]);
 useEffect(()=>{
  if(!party?.code){setHostBackup(undefined);return;}
  let live=true;
  void loadHostAccess(party.code).then(access=>{if(live)setHostBackup(access);});
  return()=>{live=false;};
 },[party?.code,party?.remote?.role]);
 const choose=(id?:string)=>void run(async()=>{
  if(!party)return;
  // Tapping the host's own name keeps host access. Change name is the only path that switches.
  if(id && id===party.remote?.participantId && party.remote.role==='host'){await enter(party);return;}
  // A newly typed name gets its own token. Remembered access is unchanged until this join succeeds.
  const key=`bojio.party-join:${party.code}`;
  const stored=parseJoinAttempt(await AsyncStorage.getItem(key));
  const currentId=party.remote?.participantId;
  const switching=!id || id!==currentId;
  const typed=!id?tokenForTypedName(stored,name,newToken()):undefined;
  if(!id && !typed?.name)throw new Error('What should your friends call you?');
  const token=typed?.token ?? (!switching && stored?.token ? stored.token : newToken());
  if(typed)await AsyncStorage.setItem(key,JSON.stringify(typed));
  const next=await joinParty(party.code,id?'':name,id,token);
  const person=next.participants.find(p=>p.id===next.remote?.participantId);
  if(!person || (id && person.id!==id) || (!id && person.name.trim().toLocaleLowerCase()!==name.trim().toLocaleLowerCase()))throw new Error(person?`Still using ${person.name}. Type that name only if it is you.`:'Your entry was not confirmed. Please retry.');
  await AsyncStorage.setItem(key,JSON.stringify({token:next.remote?.guestToken||token,name:person.name}));
  if(switching && party.remote?.role==='host' && party.remote.hostToken && party.remote.hostToken.length>=32)await AsyncStorage.setItem(`bojio.host-access:${party.code}`,JSON.stringify({hostToken:party.remote.hostToken,participantId:party.remote.participantId}));
  await enter(next,switching);
 });
 const create=()=>void run(async()=>{
  if(!name.trim())throw new Error('What should your friends call you?');
  const old=await loadPlanDraft();
  if(old){await savePlanDraft(old);await AsyncStorage.setItem('bojio.plan-recovery',serializePlan(old));}
  // New means fresh: never inherit old people, venue, swipes or bill. Keep only
  // this attempt for idempotent retry after an uncertain publish response.
  const base:PlanDraft=creation.current??{code:createPlanCode(),participants:[],meetupAt:new Date().toISOString(),commuteAt:new Date().toISOString()};
  const own=base.participants.find(p=>p.id===base.remote?.participantId)??base.participants.find(p=>p.name.trim().toLocaleLowerCase()===name.trim().toLocaleLowerCase());
  const id=own?.id??Crypto.randomUUID();
  const prepared=prepareRemoteHost({...base,participants:own?base.participants:[...base.participants,{id,name:name.trim(),origin:'Location not set',transportMode:'either'}]});
  prepared.remote!.participantId=id;
  creation.current=prepared;
  // Preserve the host capability before publishing; retry can recover the same party.
  await savePlanDraft(prepared);
  const saved={...await publishRemotePlan(prepared),pendingSync:false};
  await savePlanDraft(saved);
  const remembered=await loadRememberedParties();
  if(active.current){setCurrent(saved);setParty(undefined);setCreating(false);setSharing(true);setJustCreated(true);setCopied('');setFallback('');setHistory(remembered);creation.current=undefined;setNotice('');}
 });
 const shared=current?.remote?.published&&history.some(item=>item.code===current.code)?current:undefined;
 const inviting=sharing&&!!shared;
 const url=shared?createPlanShareUrl(shared.code):'';
 const invite=shared?createPlanInviteMessage(shared.code):'';
 const remembered=!!party&&(party.remote?.role==='host'&&!!party.remote.hostToken||!!party.remote?.participantId&&party.participants.some(p=>p.id===party.remote?.participantId));
 const known=remembered&&!chooseAnother;
 const startNew=()=>{setCreating(true);setParty(undefined);setName('');setError('');setJustCreated(false);creation.current=undefined;};
 const resume=async(target:PlanDraft)=>{
  const access=target.remote;
  await enter(access?.role==='guest'&&access.participantId&&target.status!=='closed'?await joinParty(target.code,'',access.participantId,access.guestToken??attempt.current):target);
 };
 const continueParty=()=>void run(async()=>{if(party)await resume(party);});
 const resumeHost=()=>void run(async()=>{if(!party||!hostBackup)return;await enter({...party,remote:{role:'host',hostToken:hostBackup.hostToken,participantId:hostBackup.participantId,published:true}});});
 const copy=(value:string,kind:'link'|'code'|'invite')=>{
  void (async()=>{
   if(!active.current)return;
   setError('');
   const ok=await copyPlainText(value);
   if(!active.current)return;
   if(!ok){if(kind!=='code')setFallback(value);setCopied('');setError(kind==='code'?'Hold the party code above to copy it.':kind==='link'?'Hold the link below to copy it.':'Hold the invite below to copy it.');return;}
   setCopied(kind);setFallback('');
  })();
 };
 return <Modal visible animationType="fade" onRequestClose={()=>{if(!busy)onClose();}}>
  <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.page}>
   {!party&&!creating&&!inviting?<View style={{flexDirection:'row',alignItems:'center',backgroundColor:colors.lime,borderRadius:28,padding:18,overflow:'hidden',gap:4}}><View style={{flex:1,minWidth:0,gap:10}}><Text style={{fontSize:10,letterSpacing:1.5,fontWeight:'800',color:colors.green}}>BOJIO? JIO LAH.</Text><Text style={{fontSize:28,lineHeight:32,letterSpacing:-1,fontWeight:'900',color:colors.ink}}>You eating{`\n`}or just watching?</Text><Text style={s.note}>One link. The whole table.</Text></View><SupperKaki/></View>:null}
   <View style={s.heading}><Text style={s.title}>{creating?'Create a new party':known?'Continue or start fresh?':party?'Who’s joining?':inviting?'Invite your kakis':'Choose your party'}</Text>{!busy?<CloseButton label="Close party options" onPress={onClose}/>:null}</View>
   {busy?<Text accessibilityLiveRegion="polite">{party?'Joining your party…':'One moment…'}</Text>:null}
   {error?<Text accessibilityRole="alert" style={s.error}>{error}</Text>:null}
   {notice&&!inviting?<Text accessibilityLiveRegion="polite" style={s.note}>{notice}</Text>:null}
   {removed?<Button secondary label="Undo removal" onPress={!busy?()=>void run(async()=>{await setPartyListed(removed,true);setHistory(await loadRememberedParties());setRemoved(undefined);}):undefined}/>:null}
   {!creating&&!inviting?<View style={{flexDirection:'row',gap:10}}><View style={{flex:1}}><Button label="Create a new party →" onPress={!busy?startNew:undefined}/></View>{!party?<View style={{flex:1}}><Button secondary label={joining?'Hide invite code':'Join with code ↗'} onPress={!busy?()=>setJoining(!joining):undefined}/></View>:null}</View>:null}
   {party?<>
    <Text style={s.note}>Party {party.code} · {party.participants.length} people</Text>
    {known?<>
     <Text style={s.note}>{party.participants.map(p=>p.name).join(' · ')}</Text>
     <Text style={s.note}>{party.remote?.role==='host'?'You’re the host.':'Welcome back'+(party.participants.find(p=>p.id===party.remote?.participantId)?.name?`, ${party.participants.find(p=>p.id===party.remote?.participantId)!.name}`:'')+'.'} {party.status==='closed'?'This party is closed.':'Continue this outing, or start a completely new one.'}</Text>
     <Button label={party.status==='closed'?'View closed party →':'Continue this party →'} onPress={!busy?continueParty:undefined}/>
     {party.status!=='closed'?<Pressable accessibilityRole="button" accessibilityLabel="Change name" onPress={!busy?()=>{setChooseAnother(true);setName('');setError('');setNotice('Type the name you want remembered in this browser.');}:undefined} style={{minHeight:44,justifyContent:'center'}}><Text style={s.change}>Change name</Text></Pressable>:null}
     {party.remote?.role!=='host'&&hostBackup?<Pressable accessibilityRole="button" accessibilityLabel="Continue as host" onPress={!busy?resumeHost:undefined} style={{minHeight:44,justifyContent:'center'}}><Text style={s.change}>Continue as host</Text></Pressable>:null}
    </>:<>
    {party.status==='closed'?<Text style={s.error}>This party is closed. Ask the host to reopen it.</Text>:null}
    <Text style={s.label}>Already on the list? Tap your name.</Text>
    <View style={s.names}>{party.participants.map(p=><View key={p.id} style={s.name}><Button secondary label={p.name} onPress={!busy&&party.status!=='closed'?()=>choose(p.id):undefined}/></View>)}</View>
    <Button secondary label="Refresh names" onPress={!busy?()=>void run(()=>open(party.code)):undefined}/>
    <Text style={s.label}>{chooseAnother?'Name for this party':'New here?'}</Text>
    <TextInput accessibilityLabel="Your party name" placeholder="Your name" maxLength={80} value={name} onChangeText={setName} editable={!busy} style={s.input}/>
    <Button label={chooseAnother?'Use this name →':'Join party →'} onPress={!busy&&name.trim()&&party.status!=='closed'?()=>choose():undefined}/>
    {chooseAnother?<Pressable accessibilityRole="button" accessibilityLabel="Keep current name" onPress={!busy?()=>{setChooseAnother(false);setName('');setError('');setNotice('');}:undefined} style={{minHeight:44,justifyContent:'center'}}><Text style={s.change}>Keep current name</Text></Pressable>:null}
    <Text style={s.note}>We’ll remember you in this browser. Only choose your own name.</Text>
    {error?<Button secondary label="Retry opening party" onPress={!busy?()=>void run(()=>open(party.code)):undefined}/>:null}
    </>}
   </>:creating?<>
    <Text style={s.note}>A fresh outing with an empty bill. Your previous parties stay in your list.</Text>
    <TextInput accessibilityLabel="Host name" placeholder="Your name" maxLength={80} value={name} onChangeText={setName} editable={!busy} style={s.input}/>
    <Text style={s.note}>Anyone with the invite can choose an existing guest name. Only this browser keeps host controls.</Text>
    <Button label={error&&creation.current?'Retry creating this party →':'Create party & invite →'} onPress={!busy&&name.trim()?create:undefined}/>
    <Button secondary label="Back" onPress={!busy?()=>setCreating(false):undefined}/>
   </>:<>
    {shared?<View style={s.box}>
     <Text style={s.kicker}>{inviting?(shared.remote?.role==='host'?'YOU’RE HOSTING':'YOU JOINED'):`LAST OPENED · ${shared.remote?.role==='host'?'Hosting':'Joined'}`}</Text>
     <Text accessibilityLiveRegion="polite" style={s.lead}>{shared.status==='closed'?'This party is closed.':inviting?justCreated?'Party created. Send the link to your supper kakis!':'Send the link to your supper kakis.':'Pick up where you left off.'}</Text>
     <View style={s.codeChip}><Text selectable accessibilityLabel={`Party code ${shared.code.split('').join(' ')}`} style={s.code}>{shared.code}</Text></View>
     {shared.participants.length?<Text style={s.note}>{shared.participants.map(p=>p.name).join(' · ')}</Text>:null}
     {shared.status==='closed'?<Text style={s.error}>This party is closed. Reopen it in Meet settings before inviting people.</Text>:null}
     {inviting&&shared.status!=='closed'?<>
      <Button label={copied==='invite'?'Invite copied':'Share invite ↗'} onPress={!busy?()=>copy(invite,'invite'):undefined}/>
      <Pressable accessibilityRole="button" accessibilityLabel="Continue this party →" disabled={busy} onPress={!busy?()=>void run(async()=>resume(await loadRemotePlan(shared.code))):undefined} style={({pressed})=>[s.continueBtn,busy&&{opacity:0.5},pressed&&{opacity:0.78}]}><Text style={s.continueText}>Continue this party →</Text></Pressable>
      <View style={s.copyRow}>
       <Pressable accessibilityRole="button" accessibilityLabel="Copy party link" disabled={busy} onPress={!busy?()=>copy(url,'link'):undefined} style={s.copyBtn}><Text style={s.copyText}>{copied==='link'?'Link copied':'Copy link'}</Text></Pressable>
       <Text style={s.copyDot}>·</Text>
       <Pressable accessibilityRole="button" accessibilityLabel="Copy code" disabled={busy} onPress={!busy?()=>copy(shared.code,'code'):undefined} style={s.copyBtn}><Text style={s.copyText}>{copied==='code'?'Code copied':'Copy code'}</Text></Pressable>
      </View>
      {copied?<Text accessibilityLiveRegion="polite" style={s.note}>{copied==='invite'?'Invite copied. Paste it into your group chat.':copied==='link'?'Invite link copied.':'Party code copied.'}</Text>:null}
      {fallback?<Text selectable style={s.link}>{fallback}</Text>:null}
     </>:<>
      <Button label="Continue this party →" onPress={!busy?()=>void run(async()=>resume(await loadRemotePlan(shared.code))):undefined}/>
      {shared.status!=='closed'?<Pressable accessibilityRole="button" accessibilityLabel="Invite friends" disabled={busy} onPress={!busy?()=>{setSharing(true);setCopied('');setFallback('');}:undefined} style={s.copyBtn}><Text style={s.copyText}>Invite friends</Text></Pressable>:null}
     </>}
    </View>:null}
    {inviting?<View style={s.copyRow}>
     <Pressable accessibilityRole="button" accessibilityLabel="Create a new party" disabled={busy} onPress={!busy?startNew:undefined} style={s.copyBtn}><Text style={s.quiet}>Create a new party</Text></Pressable>
     <Text style={s.copyDot}>·</Text>
     <Pressable accessibilityRole="button" accessibilityLabel={joining?'Hide invite code':'Join with code'} disabled={busy} onPress={!busy?()=>setJoining(!joining):undefined} style={s.copyBtn}><Text style={s.quiet}>{joining?'Hide invite code':'Join with code'}</Text></Pressable>
    </View>:null}
    {joining?<><Text style={s.label}>Got an invite?</Text>
    <TextInput accessibilityLabel="Party code or link" placeholder="Party code or invite link" value={input} onChangeText={setInput} autoCapitalize="none" autoCorrect={false} editable={!busy} style={s.input}/>
    <Button secondary label="Find party →" onPress={!busy&&input.trim()?()=>void run(()=>open(input)):undefined}/></>:null}
   </>}
   {!creating?<>
    {party?<Button secondary label="Other parties / join by code" onPress={!busy?()=>{setParty(undefined);setError('');}:undefined}/>:null}
    {history.length?<>
     <Text style={s.label}>YOUR PARTIES</Text>
     <Text style={s.note}>Parties you open on this phone show here. Swipe left to hide one — the shared party stays.</Text>
     {history.map(item=><SwipePartyRow key={item.code} code={item.code} open={revealed===item.code} disabled={busy} onReveal={open=>setRevealed(open?item.code:undefined)} onDelete={()=>void run(async()=>{await setPartyListed(item.code,false);setHistory(await loadRememberedParties());setRevealed(undefined);setRemoved(item.code);if(party?.code===item.code)setParty(undefined);setNotice('Removed from this browser’s list. Shared party unchanged.');})}><View style={s.box}>
      <Text style={[s.label,{paddingRight:30}]}>{item.code} · {item.role==='host'?'Hosting':item.role==='guest'?'Joined':'On this device'}{item.status==='closed'?' · Closed':''}</Text>
      {item.names?<Text style={s.note}>{item.names}</Text>:null}
      {item.meetupAt&&Number.isFinite(Date.parse(item.meetupAt))?<Text style={s.note}>{new Date(item.meetupAt).toLocaleString('en-SG',{timeZone:'Asia/Singapore',day:'numeric',month:'short',hour:'numeric',minute:'2-digit'})}</Text>:null}
      <Button secondary label={`Open party ${item.code}`} onPress={!busy?()=>void run(async()=>{if(item.role==='local'){const draft=await loadPartyDraft(item.code)??(current?.code===item.code?current:null);if(!draft)throw new Error('This local party is no longer available.');await enter(draft);}else await open(item.code);}):undefined}/>
     </View></SwipePartyRow>)}
    </>:null}
   </>:null}
  </ScrollView>
 </Modal>;
}
const s=StyleSheet.create({page:{padding:24,paddingTop:40,gap:16,width:'100%',maxWidth:560,alignSelf:'center',backgroundColor:colors.paper},heading:{flexDirection:'row',alignItems:'center',gap:12},title:{flex:1,fontSize:27,fontWeight:'900',color:colors.ink},label:{fontWeight:'800',fontSize:15,color:colors.ink},kicker:{fontSize:11,letterSpacing:1.2,fontWeight:'800',color:colors.green},lead:{fontSize:15,lineHeight:22,fontWeight:'700',color:colors.ink},note:{fontSize:13,lineHeight:20,color:colors.muted},error:{color:colors.reject,fontSize:14,lineHeight:21},input:{padding:16,borderWidth:1,borderColor:colors.line,borderRadius:14,fontSize:17,backgroundColor:colors.paper},names:{gap:8,flexDirection:'row',flexWrap:'wrap'},name:{maxWidth:'100%'},box:{gap:12,padding:18,borderRadius:20,backgroundColor:colors.bambooSoft},codeChip:{alignSelf:'stretch',backgroundColor:colors.lime,borderRadius:18,paddingVertical:14,paddingHorizontal:12,alignItems:'center'},code:{fontSize:34,fontWeight:'900',letterSpacing:3,color:colors.ink},link:{fontSize:12,lineHeight:18,color:colors.muted},change:{fontSize:13,fontWeight:'700',color:colors.muted},continueBtn:{minHeight:50,borderRadius:18,paddingVertical:14,paddingHorizontal:18,alignItems:'center',justifyContent:'center',backgroundColor:colors.card,borderWidth:1.5,borderColor:colors.line},continueText:{color:colors.green,fontWeight:'800',fontSize:15},copyRow:{flexDirection:'row',alignItems:'center',justifyContent:'center'},copyBtn:{minHeight:44,justifyContent:'center',alignItems:'center',paddingHorizontal:10},copyText:{fontSize:14,fontWeight:'800',color:colors.green},copyDot:{color:colors.muted,fontWeight:'800',fontSize:16},quiet:{fontSize:13,fontWeight:'700',color:colors.muted}});

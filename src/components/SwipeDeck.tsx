import { useEffect,useRef,useState,useSyncExternalStore } from 'react';
import { Modal,Pressable,ScrollView,Text,View } from 'react-native';
import { Place,PlanDraft } from '../types';
import { useSwipes } from '../hooks/useSwipes';
import { Choice,rankSwipes } from '../features/meet/swipes';
import { ensurePlace,placesRevision,resolvedPlace,subscribePlaces } from '../data/googlePlaces';
import { hoursAt } from '../features/meet/googlePlace';
import { colors } from '../theme';
import { publishLiveTop3, rankMetal } from './liveTop3Store';
import { RestaurantFeed } from './RestaurantFeed';
import { Button,Card,CloseButton,Disclosure } from './Ui';
import { RestaurantDetails,RestaurantPhoto } from './RestaurantMedia';
import { GoogleVenueStatus } from './GoogleVenueStatus';
import { RankedRestaurantName } from './RankedRestaurantName';
const appliedBatches=new Map<string,number>();
export function SwipeDeck({plan,candidates,onChoose,onActive,batch,mode,onMore,searchBusy,rankingOpen,onCloseRanking,onOpenRanking}:{rankingOpen:boolean;onCloseRanking:()=>void;onOpenRanking:()=>void;batch?:number;mode?:'replace'|'append';onMore?:()=>void;searchBusy?:boolean;plan:PlanDraft;candidates:Place[];onChoose:(p:Place)=>void;onActive:(p:Place|undefined)=>void}){
 const voting=useSwipes(plan);useSyncExternalStore(subscribePlaces,placesRevision);
 const [details,setDetails]=useState<Place>(),[reviewId,setReviewId]=useState<string>(),[feedOpen,setFeedOpen]=useState(false),[moving,setMoving]=useState(false);
 const autoStarted=useRef(new Set<string>());
 const startKey=`${plan.code}:${!!plan.remote?.published}`;
 useEffect(()=>{if(!mode&&voting.loaded&&!voting.state.venues.length&&!voting.busy&&candidates.length&&plan.remote?.role!=='guest'&&plan.status!=='closed'&&!autoStarted.current.has(startKey)){autoStarted.current.add(startKey);void voting.start(candidates);}},[voting.loaded,voting.state.venues.length,voting.busy,candidates.length,startKey]);
 const [moreNotice,setMoreNotice]=useState('');
 const applied=useRef<number|undefined>(appliedBatches.get(plan.code));
 useEffect(()=>{if(mode&&batch&&batch!==applied.current&&voting.loaded&&!voting.busy&&candidates.length&&plan.remote?.role!=='guest'){applied.current=batch;appliedBatches.set(plan.code,batch);setReviewId(undefined);setMoreNotice(mode==='append'&&candidates.every(p=>voting.state.venues.some(v=>v.id===p.id))?'No new restaurants returned within this radius. You can review your favourites or change the area in ···.':'');void voting.update(candidates,mode==='append');}},[batch,mode,voting.loaded,voting.busy,candidates]);
 const mine=voting.state.swipes.filter(s=>s.voterId===voting.voterId&&voting.state.venues.some(p=>p.id===s.venueId));
 const ref=voting.state.venues.find(p=>p.id===reviewId)??voting.state.venues.find(p=>!mine.some(s=>s.venueId===p.id));
 const current=resolvedPlace(ref);
 const ranked=rankSwipes(voting.state),top=ranked.filter(r=>r.likes>0).slice(0,3);
 const openRanking=useRef(onOpenRanking);openRanking.current=onOpenRanking;
 const rankingKey=[voting.loaded,voting.state.voters.length,voting.state.venues.length,top.map(r=>`${r.place.id}:${r.likes}:${resolvedPlace(r.place)?.name??''}`).join('|')].join(';');
 useEffect(()=>{if(!voting.loaded||!voting.state.venues.length){publishLiveTop3(null);return;}publishLiveTop3({voters:voting.state.voters.length,open:()=>openRanking.current(),rows:top.map(r=>({id:r.place.id,name:resolvedPlace(r.place)?.name??'Restaurant',likes:r.likes}))});},[rankingKey]);
 useEffect(()=>()=>publishLiveTop3(null),[]);
 const special=ranked.map(r=>({...r,pickers:voting.state.swipes.filter(s=>s.venueId===r.place.id&&s.special&&s.choice==='like'&&voting.state.voters.includes(s.voterId))})).filter(r=>r.pickers.length);
 const pickerName=(id:string)=>id==='host'?(plan.participants.find(p=>!voting.state.voters.includes('guest:'+p.id))?.name||'Host'):plan.participants.find(p=>'guest:'+p.id===id)?.name||'Group member';
 const others=ranked.filter(r=>r.likes+r.neutral+r.passes>0&&!top.some(t=>t.place.id===r.place.id));
 useEffect(()=>{if(current?.source==='google_places'&&!current.latitude)void ensurePlace(current.providerPlaceId!);onActive(current);},[current?.id,current?.latitude]);
 useEffect(()=>{for(const r of [...top,...special]){const p=resolvedPlace(r.place)!;if(p.source==='google_places'&&!p.latitude)void ensurePlace(p.providerPlaceId!);}},[[...top,...special].map(r=>r.place.id).join('|')]);
 const blocked=voting.busy||moving||!voting.loaded||plan.status==='closed'||(plan.remote?.role==='guest'&&!plan.remote.participantId);
 const choose=async(place:Place,choice:Choice)=>{if(blocked)return false;setMoving(true);try{return await voting.swipe(place,choice);}finally{setMoving(false);}};
 const start=()=>void voting.start(candidates);
 return <View style={{gap:12,paddingBottom:voting.loaded&&voting.state.venues.length?124:0}}>
 <Text style={{fontSize:12,color:colors.muted}}>{plan.remote?.published?'Shared deck · your own choices':'Your own choices · saved on this device'}</Text>
 {!voting.loaded&&candidates.length>0?<Text>Preparing restaurants…</Text>:null}{voting.error?<><Text accessibilityRole="alert" style={{color:colors.reject}}>{voting.error}</Text><Button secondary label="Retry loading swipe progress" onPress={()=>void voting.refresh()}/></>:null}
 {!voting.state.venues.length&&voting.loaded&&!(searchBusy&&!candidates.length)?<Card><Text>{plan.remote?.role==='guest'?'Waiting for the host to choose a search area and share the restaurant shortlist. Your cards will appear here automatically.':!candidates.length?'Open ··· to pick a neighbourhood and find restaurants.':'Start with these restaurants. Everyone in the shared plan sees the same cards.'}</Text>{plan.remote?.role!=='guest'&&candidates.length?<Button label={voting.busy?'Sharing shortlist…':'Start swiping these restaurants'} onPress={!blocked?start:undefined}/>:null}</Card>:null}
 {voting.state.venues.length?<View style={{gap:12}}>
  <Pressable accessibilityRole="button" accessibilityLabel="Open restaurant discovery feed" onPress={()=>{setReviewId(undefined);setFeedOpen(true);}} style={{borderRadius:24,backgroundColor:colors.card,borderWidth:1,borderColor:colors.line,padding:12,gap:10}}>
   {current?<RestaurantPhoto place={current} height={260}/>:<View style={{height:180,borderRadius:18,backgroundColor:colors.bambooSoft,alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:40}}>🍽️</Text></View>}
   <Text style={{fontSize:22,fontWeight:'900',color:colors.ink}}>{current?.name??'Browse your restaurant shortlist'}</Text>
   <Text style={{fontSize:13,color:colors.muted}}>{mine.length} of {voting.state.venues.length} rated · swipe up for more places, tap for photos and reviews</Text>
   <Text style={{fontSize:16,fontWeight:'800',color:colors.ink}}>Explore restaurants ↗</Text>
  </Pressable>
  {!current?<Card><Text style={{fontSize:20,fontWeight:'800'}}>All swiped! 🎉</Text><Text>Open the feed to review or change your choices. The host confirms where to meet.</Text>{moreNotice?<Text>{moreNotice}</Text>:null}{onMore&&!moreNotice?<Button label={searchBusy?'Finding more nearby…':'Find more nearby · same radius'} onPress={!searchBusy?onMore:undefined}/>:null}</Card>:null}
  <RestaurantFeed visible={feedOpen} places={voting.state.venues.map(p=>resolvedPlace(p)!)} choices={Object.fromEntries(mine.map(s=>[s.venueId,s.choice]))} startId={reviewId??current?.id} meetupAt={plan.meetupAt} busy={voting.busy||moving} disabled={plan.status==='closed'||(plan.remote?.role==='guest'&&!plan.remote.participantId)} onClose={()=>setFeedOpen(false)} onVote={choose} onTopThree={onOpenRanking}/>
 </View>:null}

 <Modal visible={rankingOpen} animationType="slide" onRequestClose={onCloseRanking}>
 <View style={{flex:1,backgroundColor:colors.paper,paddingTop:18}}>
 <View style={{paddingHorizontal:20,flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}><Text style={{fontSize:22,fontWeight:'900'}}>🏆 Top 3</Text><CloseButton label="Close Top 3" onPress={onCloseRanking}/></View>
 <ScrollView contentContainerStyle={{padding:20,width:'100%',maxWidth:720,alignSelf:'center'}}>
  {voting.state.venues.length?<Disclosure title="Review or change my swipes">{voting.state.venues.map(p=><Button key={p.id} secondary label={`${resolvedPlace(p)!.name} · ${mine.find(s=>s.venueId===p.id)?.choice??'not swiped'}`} onPress={!blocked?()=>{setReviewId(p.id);onCloseRanking();setFeedOpen(true);}:undefined}/>)}</Disclosure>:null}
 <View style={{backgroundColor:colors.bambooSoft,borderRadius:24,padding:16,gap:12,marginTop:10}}>
 <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}><Text style={{fontSize:22,fontWeight:'900'}}>🏆 Group favourites</Text><Text style={{fontSize:12,color:colors.muted}}>Top 3{ranked.some(r=>r.waiting>0)?' · so far':''}</Text></View>
 <Text style={{fontSize:12,color:colors.muted}}>Most hearts wins · fewer passes breaks a tie</Text>
 {!top.length?<Text style={{paddingVertical:14,color:colors.muted}}>Give a restaurant a ♥ to start the leaderboard.</Text>:null}
 {top.map((r,index)=>{const p=resolvedPlace(r.place)!;const metal=rankMetal(index);return <View key={p.id} style={{borderRadius:18,padding:14,gap:10,backgroundColor:metal.fill,borderWidth:1,borderColor:metal.ring}}>
 <Pressable accessibilityRole="button" accessibilityLabel={`View ranked restaurant ${index+1}`} onPress={()=>setDetails(p)} style={{gap:8}}>
 <View style={{flexDirection:'row',gap:10,alignItems:'center'}}><Text style={{fontSize:30}}>{['🥇','🥈','🥉'][index]}</Text><Text style={{flex:1,fontSize:17,fontWeight:'800'}}>{p.name}</Text><Text style={{fontSize:22,fontWeight:'900',color:metal.ink}}>♥ {r.likes}</Text></View>
 <Text style={{fontSize:12,color:colors.muted}}>{r.likes} like · {r.neutral} neutral · {r.passes} pass · {r.waiting} haven’t swiped</Text>
 <View style={{height:6,borderRadius:3,backgroundColor:colors.paper}}><View style={{height:6,borderRadius:3,backgroundColor:metal.bar,width:`${r.likes/Math.max(1,voting.state.voters.length)*100}%`}}/></View>
 </Pressable><GoogleVenueStatus place={p}/>{plan.remote?.role!=='guest'?<Button label={plan.chosenVenueId===p.id?'Confirmed meetup ✓':'Confirm meetup here'} onPress={plan.status!=='closed'?()=>{onChoose(p);onCloseRanking();}:undefined}/>:null}
 </View>;})}
 <Text style={{fontSize:11,color:colors.muted}}>Hearts out of {voting.state.voters.length} voter{voting.state.voters.length===1?'':'s'}. Not swiped ≠ neutral. Exact ties keep shortlist order.</Text>
 </View>
 <View accessibilityLabel="Other restaurants in ranking" style={{marginTop:32,paddingTop:20,borderTopWidth:1,borderColor:colors.line}}><Text style={{fontSize:16,fontWeight:'800'}}>Other places your group rated</Text><Text style={{fontSize:12,color:colors.muted,marginTop:5,marginBottom:10}}>Outside the Top 3 · tap a name to open</Text>{others.length?others.map(r=>{const p=resolvedPlace(r.place)!;return <View key={p.id}><RankedRestaurantName place={p} onOpen={()=>setDetails(p)}/></View>;}):<Text style={{fontSize:13,color:colors.muted}}>No other rated places yet. Keep swiping to add more.</Text>}</View>

 </ScrollView></View></Modal>

 {special.length?<View accessibilityLabel="Special restaurant mentions" style={{gap:10,marginTop:20}}><Text style={{fontSize:13,fontWeight:'700',color:colors.muted}}>❤️ Someone really wants these</Text>{special.map(r=>{const p=resolvedPlace(r.place)!;return <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={`Open special mention ${p.name}`} onPress={()=>setDetails(p)} style={{borderWidth:1,borderColor:colors.limeLine,backgroundColor:colors.card,borderRadius:16,padding:14,flexDirection:'row',alignItems:'center',gap:12}}><Text style={{flex:1,fontWeight:'800'}}>{p.name} ›</Text><Text style={{maxWidth:'45%',fontSize:12,color:colors.muted,textAlign:'right'}}>{r.pickers.map(s=>pickerName(s.voterId)).join(', ')}</Text></Pressable>;})}<Text style={{fontSize:11,color:colors.muted}}>Special mentions · not the confirmed meetup</Text></View>:null}
 <RestaurantDetails place={resolvedPlace(details)} onClose={()=>setDetails(undefined)} mention={details&&voting.state.venues.some(p=>p.id===details.id)?{active:!!mine.find(s=>s.venueId===details.id)?.special,disabled:blocked,busy:voting.busy,error:voting.error,onPress:()=>{const p=details;void voting.mention(p,!mine.find(s=>s.venueId===p.id)?.special).then(ok=>{if(ok){setDetails(undefined);onCloseRanking();}});}}:undefined}/>
 </View>;
}

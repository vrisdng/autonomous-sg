import { useEffect,useMemo,useRef,useState,useSyncExternalStore } from 'react';
import { Animated,Modal,PanResponder,Pressable,ScrollView,Text,View } from 'react-native';
import { Place,PlanDraft } from '../types';
import { useSwipes } from '../hooks/useSwipes';
import { Choice,rankSwipes } from '../features/meet/swipes';
import { ensurePlace,placesRevision,resolvedPlace,subscribePlaces } from '../data/googlePlaces';
import { straightLineKm } from '../features/meet/cardFacts';
import { hoursAt } from '../features/meet/googlePlace';
import { colors } from '../theme';
import { isBaoDragBlocking } from './baoPeek';
import { publishLiveTop3, rankMetal } from './liveTop3';
import { CardSnap } from './CardSnap';
import { meetSelf } from '../features/meet/meetReady';
import { Button,Card,CloseButton,Disclosure,SoftCross } from './Ui';
import { RestaurantDetails,RestaurantPhoto } from './RestaurantMedia';
import { GoogleVenueStatus } from './GoogleVenueStatus';
import { RankedRestaurantName } from './RankedRestaurantName';
const appliedBatches=new Map<string,number>();
/** Same 1px edge as the close cross and the floating Top 3 card. */
const swipeTone: Record<Choice, { fill: string; line: string; ink: string }> = {
  pass: { fill: colors.rejectSoft, line: colors.rejectLine, ink: colors.reject },
  neutral: { fill: colors.paper, line: colors.limeLine, ink: colors.muted },
  like: { fill: colors.blush, line: colors.limeLine, ink: colors.ink },
};
export function SwipeDeck({plan,candidates,onChoose,onActive,batch,mode,onMore,searchBusy,rankingOpen,onCloseRanking,onOpenRanking}:{rankingOpen:boolean;onCloseRanking:()=>void;onOpenRanking:()=>void;batch?:number;mode?:'replace'|'append';onMore?:()=>void;searchBusy?:boolean;plan:PlanDraft;candidates:Place[];onChoose:(p:Place)=>void;onActive:(p:Place|undefined)=>void}){
 const voting=useSwipes(plan);useSyncExternalStore(subscribePlaces,placesRevision);
 const [details,setDetails]=useState<Place>(),[reviewId,setReviewId]=useState<string>(),[moving,setMoving]=useState(false);
 const position=useRef(new Animated.ValueXY()).current;
 const autoStarted=useRef(new Set<string>());
 const startKey=`${plan.code}:${!!plan.remote?.published}`;
 useEffect(()=>{if(!mode&&voting.loaded&&!voting.state.venues.length&&!voting.busy&&candidates.length&&plan.remote?.role!=='guest'&&plan.status!=='closed'&&!autoStarted.current.has(startKey)){autoStarted.current.add(startKey);void voting.start(candidates);}},[voting.loaded,voting.state.venues.length,voting.busy,candidates.length,startKey]);
 const [moreNotice,setMoreNotice]=useState('');
 const applied=useRef<number|undefined>(appliedBatches.get(plan.code));
 useEffect(()=>{if(mode&&batch&&batch!==applied.current&&voting.loaded&&!voting.busy&&candidates.length&&plan.remote?.role!=='guest'){applied.current=batch;appliedBatches.set(plan.code,batch);setReviewId(undefined);setMoreNotice(mode==='append'&&candidates.every(p=>voting.state.venues.some(v=>v.id===p.id))?'No new restaurants returned within this radius. You can review your favourites or change the area in ···.':'');void voting.update(candidates,mode==='append');}},[batch,mode,voting.loaded,voting.busy,candidates]);
 const mine=voting.state.swipes.filter(s=>s.voterId===voting.voterId&&voting.state.venues.some(p=>p.id===s.venueId));
 const ref=voting.state.venues.find(p=>p.id===reviewId)??voting.state.venues.find(p=>!mine.some(s=>s.venueId===p.id));
 const current=resolvedPlace(ref);
 const viewer=meetSelf(plan);
 const km=current?straightLineKm(viewer?.location,current):undefined;
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
 const choose=async(choice:Choice)=>{if(!current||blocked)return;setMoving(true);const destination=choice==='like'?{x:450,y:20}:choice==='pass'?{x:-450,y:20}:{x:0,y:-450};
  await new Promise<void>(resolve=>{
   const animation=choice==='neutral'?Animated.sequence([
    Animated.timing(position,{toValue:{x:0,y:-24},duration:150,useNativeDriver:false}),
    Animated.delay(350),
    Animated.timing(position,{toValue:destination,duration:180,useNativeDriver:false}),
   ]):Animated.timing(position,{toValue:destination,duration:210,useNativeDriver:false});
   animation.start(()=>resolve());
  });
  const ok=await voting.swipe(current,choice);position.setValue({x:0,y:0});if(ok)setReviewId(undefined);setMoving(false);
 };
 const axis=useRef<'horizontal'|'vertical'|undefined>(undefined);
 const gesture=useMemo(()=>PanResponder.create({
  onStartShouldSetPanResponderCapture:()=>{axis.current=undefined;return false;},
  onMoveShouldSetPanResponder:(_,g)=>{
   if(blocked||isBaoDragBlocking())return false;
   if(!axis.current){if(Math.abs(g.dy)>10&&Math.abs(g.dy)>=Math.abs(g.dx))axis.current='vertical';
    else if(Math.abs(g.dx)>16&&Math.abs(g.dx)>Math.abs(g.dy)*1.5)axis.current='horizontal';}
   return axis.current==='horizontal';
  },
  onPanResponderMove:(_,g)=>{if(!isBaoDragBlocking())position.setValue({x:g.dx,y:0});},
  onPanResponderRelease:(_,g)=>{if(!isBaoDragBlocking()&&axis.current==='horizontal'&&Math.abs(g.dx)>90&&Math.abs(g.dx)>Math.abs(g.dy)*1.5)void choose(g.dx>0?'like':'pass');else Animated.spring(position,{toValue:{x:0,y:0},useNativeDriver:false}).start();},
  onPanResponderTerminationRequest:()=>true,
  onPanResponderTerminate:()=>Animated.spring(position,{toValue:{x:0,y:0},useNativeDriver:false}).start()
 }),[current?.id,blocked,voting.state]);
 const start=()=>void voting.start(candidates);
 return <View style={{gap:12,paddingBottom:voting.loaded&&voting.state.venues.length?124:0}}>
 <Text style={{fontSize:12,color:colors.muted}}>{plan.remote?.published?'Shared deck · your own choices':'Your own choices · saved on this device'}</Text>
 {!voting.loaded&&candidates.length>0?<Text>Preparing restaurants…</Text>:null}{voting.error?<><Text accessibilityRole="alert" style={{color:colors.reject}}>{voting.error}</Text><Button secondary label="Retry loading swipe progress" onPress={()=>void voting.refresh()}/></>:null}
 {!voting.state.venues.length&&voting.loaded&&!(searchBusy&&!candidates.length)?<Card><Text>{plan.remote?.role==='guest'?'Waiting for the host to choose a search area and share the restaurant shortlist. Your cards will appear here automatically.':!candidates.length?'Open ··· to pick a neighbourhood and find restaurants.':'Start with these restaurants. Everyone in the shared plan sees the same cards.'}</Text>{plan.remote?.role!=='guest'&&candidates.length?<Button label={voting.busy?'Sharing shortlist…':'Start swiping these restaurants'} onPress={!blocked?start:undefined}/>:null}</Card>:null}
 {current?<CardSnap><Text accessibilityLiveRegion="polite">{mine.length} / {voting.state.venues.length} rated{reviewId?' · changing your choice':''}</Text><View style={{overflow:'hidden',padding:3}}><Animated.View {...gesture.panHandlers} style={{...({touchAction:'pan-y'} as any),transform:[...position.getTranslateTransform(),{rotate:position.x.interpolate({inputRange:[-300,0,300],outputRange:['-12deg','0deg','12deg']})}],opacity:moving?0.7:1}}><Card><Pressable accessibilityRole="button" accessibilityLabel={`Open photos and reviews for ${current.name}`} onPress={()=>{if(!moving&&!axis.current)setDetails(current);}} style={{gap:6,...({touchAction:'pan-y'} as any)}}><RestaurantPhoto key={current.id} place={current} height={180}/>
 {([{symbol:'♥',label:'WANT TO EAT',color:swipeTone.like.ink,opacity:position.x.interpolate({inputRange:[0,75],outputRange:[0,1],extrapolate:'clamp'})},{symbol:'✕',label:'PASS',color:swipeTone.pass.ink,opacity:position.x.interpolate({inputRange:[-75,0],outputRange:[1,0],extrapolate:'clamp'})},{symbol:'↑',label:'ANYTHING LAH',color:swipeTone.neutral.ink,opacity:position.y.interpolate({inputRange:[-20,0],outputRange:[1,0],extrapolate:'clamp'})}]).map(stamp=><Animated.View key={stamp.label} pointerEvents="none" accessibilityLabel={`Swipe feedback ${stamp.label}`} style={{position:'absolute',top:24,left:18,right:18,zIndex:5,opacity:stamp.opacity,alignItems:'center',backgroundColor:swipeTone.neutral.fill,borderWidth:2,borderColor:stamp.color,borderRadius:20,padding:12,transform:[{rotate:'-8deg'}]}}>{stamp.label==='PASS'?<SoftCross size={52} stroke={2.25}/>:<Text style={{fontSize:54,color:stamp.color,fontWeight:'800'}}>{stamp.symbol}</Text>}<Text style={{fontSize:22,color:stamp.color,fontWeight:'800'}}>{stamp.label}</Text></Animated.View>)}<Text style={{fontSize:22,fontWeight:'900'}}>{current.name}</Text><View style={{gap:4}}><Text style={{fontSize:15,fontWeight:'800'}}>★ {current.rating??'Unrated'} · {current.reviewCount??0} ratings</Text><Text style={{fontSize:13,fontWeight:'700',color:colors.muted}}>{current.priceLabel??'Price unavailable'}</Text><Text style={{fontSize:12,color:colors.muted}}>{km===undefined?'Add your starting point in ··· for distance':`${km.toFixed(1)} km · straight-line from ${viewer?.name||'saved starting point'}`}</Text></View><Text numberOfLines={1} style={{fontSize:12}}>{current.address}</Text><Text numberOfLines={2} style={{fontSize:11,color:colors.muted}}>{hoursAt(current,plan.meetupAt).label}</Text><Text style={{fontWeight:'700',fontSize:12}}>Tap for photos & reviews ↗</Text></Pressable><GoogleVenueStatus place={current}/></Card></Animated.View></View><View style={{flexDirection:'row',justifyContent:'space-evenly',gap:12,paddingVertical:8}}>{(['pass','neutral','like'] as Choice[]).map(choice=>{
 const tone=swipeTone[choice];
 const label=choice==='like'?'♥ Like':choice==='pass'?'✕ Pass':'↑ Neutral';
 return <Pressable key={choice} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled:blocked}} disabled={blocked} onPress={()=>void choose(choice)} style={({pressed})=>({alignItems:'center',gap:6,opacity:blocked?0.45:pressed?0.7:1})}>
 <View style={{height:66,width:66,borderRadius:33,backgroundColor:tone.fill,borderWidth:1,borderColor:tone.line,alignItems:'center',justifyContent:'center'}}>{choice==='pass'?<SoftCross size={26} stroke={2.25}/>:<Text style={{fontSize:28,color:tone.ink,fontWeight:'800'}}>{choice==='like'?'♥':'↑'}</Text>}</View>
 <Text style={{fontSize:13,fontWeight:'800',color:tone.ink}}>{choice==='like'?'Like':choice==='pass'?'Pass':'Neutral'}</Text><Text style={{fontSize:10,color:colors.muted}}>{choice==='like'?'swipe right':choice==='pass'?'swipe left':'tap for neutral'}</Text>
 </Pressable>;
 })}</View>{voting.busy||moving?<Text accessibilityLiveRegion="polite">Saving your swipe…</Text>:null}</CardSnap>:voting.state.venues.length?<Card><Text style={{fontSize:20,fontWeight:'800'}}>All swiped! 🎉</Text><Text>Open Top 3 to review or change your ratings. The host confirms where to meet.</Text>{moreNotice?<Text>{moreNotice}</Text>:null}{onMore&&!moreNotice?<Button label={searchBusy?'Finding more nearby…':'Find more nearby · same radius'} onPress={!searchBusy?onMore:undefined}/>:null}</Card>:null}

 <Modal visible={rankingOpen} animationType="slide" onRequestClose={onCloseRanking}>
 <View style={{flex:1,backgroundColor:colors.paper,paddingTop:18}}>
 <View style={{paddingHorizontal:20,flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}><Text style={{fontSize:22,fontWeight:'900'}}>🏆 Top 3</Text><CloseButton label="Close Top 3" onPress={onCloseRanking}/></View>
 <ScrollView contentContainerStyle={{padding:20,width:'100%',maxWidth:720,alignSelf:'center'}}>
  {voting.state.venues.length?<Disclosure title="Review or change my swipes">{voting.state.venues.map(p=><Button key={p.id} secondary label={`${resolvedPlace(p)!.name} · ${mine.find(s=>s.venueId===p.id)?.choice??'not swiped'}`} onPress={!blocked?()=>{setReviewId(p.id);onCloseRanking();}:undefined}/>)}</Disclosure>:null}
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

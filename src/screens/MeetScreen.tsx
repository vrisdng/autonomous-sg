import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { centerKey, discover, discovery, ensurePlace, placesRevision, resolvedPlace, searchPlaces, subscribePlaces } from '../data/googlePlaces';
import { googleReference, hoursAt, midpoint, serializePlan } from '../features/meet/googlePlace';
import { GoogleVenueStatus } from '../components/GoogleVenueStatus';
import { SwipeDeck } from '../components/SwipeDeck';
import { Linking, Modal, Pressable, ScrollView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Card, CloseButton, Pill, Disclosure, Toggle } from '../components/Ui';
import { SheetBar } from '../components/SheetBar';
import { LocationPicker } from '../components/LocationPicker';
import { MeetLocationPanel } from '../components/MeetLocationPanel';
import { HomeLocationEditor } from '../components/HomeLocationEditor';
import { useOuting } from '../hooks/useOuting';
import { useVenueVotes } from '../hooks/useVenueVotes';
import { readMeetArea, writeMeetArea } from '../data/meetArea';
import { rememberHome, rememberPartyHome } from '../data/savedHome';
import { createPlanCode, loadPlanDraft, savePlanDraft } from '../data/planDraft';
import { meetReady, meetSelf } from '../features/meet/meetReady';
import { isRemotePlansConfigured, loadRemotePlan, prepareRemoteHost, publishRemotePlan, saveOutingGuest, setRemotePlanStatus, extendRemotePlanExpiry } from '../data/remotePlans';
import { verifiedVenues } from '../data/venues';
import { placeLocation, scheduledTrips, tripKey } from '../data/travelProvider';
import { rankScheduledPlaces } from '../features/meet/scheduledRanking';
import { cuisine, matchesVenue, variedVenues, venueMapsUrl } from '../features/meet/discovery';
import { createPlanInviteMessage, normalizePlanCode, isPlanCode } from '../features/plans/links';
import { copyPlainText } from '../features/clipboard';
import { keepConfirmedHomes, mergeOuting } from '../features/plans/mergeOuting';
import { directions, parseSingaporeInput, RouteResult, singaporeInput, validLocation } from '../features/travel/types';
import { GeoLocation, Participant, Place, PlanDraft, Tab, TransportMode } from '../types';
import { colors } from '../theme';

export function MeetScreen({ go, onOpenParty, fromPost }: { go: (tab: Tab) => void; onOpenParty: (code?:string) => void; fromPost?: string }) {
  const outing=useOuting();
  const [plan, setPlan] = useState<PlanDraft>();
  const latest = useRef<PlanDraft | undefined>(undefined);
  const [message, setMessage] = useState('');
  const [inviteCopied, setInviteCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [joinCode, setJoinCode] = useState('');
  const [guestName, setGuestName] = useState('');
  const [draftName, setDraftName] = useState('');
  const [guestLocation, setGuestLocation] = useState<GeoLocation>();
  const [guestMode, setGuestMode] = useState<TransportMode>('either');
  const [meetupText, setMeetupText] = useState(singaporeInput());
  const [commuteText, setCommuteText] = useState(singaporeInput());
  const [candidates, setCandidates] = useState(() => variedVenues(verifiedVenues));
  const [results, setResults] = useState<Record<string, RouteResult[]>>({});
  const routeVersion = useRef(0);
  const routeRequest = useRef<AbortController | undefined>(undefined);
  const [routeBusy, setRouteBusy] = useState(false);
  const [routeMessage, setRouteMessage] = useState('');
  const [routeSlow,setRouteSlow]=useState(false);
  const completed=useRef(new Map<string,RouteResult>());
  const [backup, setBackup] = useState<PlanDraft>();
  const [showAllPlaces, setShowAllPlaces] = useState(false);
  const [venueQuery, setVenueQuery] = useState('');
  const [foodFilter, setFoodFilter] = useState('');
  const [areaFilter, setAreaFilter] = useState('');
  const [venueNotice, setVenueNotice] = useState('');
  const voting = useVenueVotes(plan);
  const googleRevision=useSyncExternalStore(subscribePlaces,placesRevision);
  const [pickedArea,setPickedArea]=useState<{code:string;center?:GeoLocation}>({code:''});
  const [shortlist,setShortlist]=useState(true);
  const [otherHours,setOtherHours]=useState(false);
  const [optionsOpen,setOptionsOpen]=useState(()=>Platform.OS==='web'&&typeof window!=='undefined'&&window.history.state?.bojioSheet==='outing');
  const openSheet=()=>{
    if(Platform.OS==='web'&&typeof window!=='undefined'&&window.history.state?.bojioSheet!=='outing')window.history.pushState({...window.history.state,bojioSheet:'outing'},'',window.location.href);
    setOptionsOpen(true);
  };
  const dismissSheet=()=>{
    if(Platform.OS==='web'&&typeof window!=='undefined'&&window.history.state?.bojioSheet==='outing'){window.history.back();return;}
    setOptionsOpen(false);
  };
  useEffect(()=>{
    if(Platform.OS!=='web'||typeof window==='undefined')return;
    const sync=()=>setOptionsOpen(window.history.state?.bojioSheet==='outing');
    window.addEventListener('popstate',sync);
    return()=>window.removeEventListener('popstate',sync);
  },[]);
  useEffect(()=>{
    if(!plan||meetReady(plan)||!optionsOpen)return;
    if(Platform.OS==='web'&&typeof window!=='undefined'&&window.history.state?.bojioSheet==='outing'){
      const {bojioSheet:_sheet,...rest}=window.history.state;
      window.history.replaceState(rest,'',window.location.href);
    }
    setOptionsOpen(false);
  },[plan,optionsOpen]);
  const [rankingOpen,setRankingOpen]=useState(false);
  const [deckActive,setDeckActive]=useState<Place>();
  if(plan && pickedArea.code!==plan.code)setPickedArea({code:plan.code,center:readMeetArea(plan.code)});
  const manualCenter=plan && pickedArea.code===plan.code?pickedArea.center:undefined;
  const rememberArea=(center?:GeoLocation)=>{if(!plan)return;setPickedArea({code:plan.code,center});writeMeetArea(plan.code,center);};
  const groupCenter=midpoint(plan?.participants??[]);
  const searchCenter=manualCenter??groupCenter.center;
  const found=discovery(plan?.code??'');
  const areaReady=!plan||pickedArea.code===plan.code;
  useEffect(()=>{if(!shortlist && areaReady && plan && plan.remote?.role!=='guest' && searchCenter && !found.attempted){const timer=setTimeout(()=>void discover(plan.code,searchCenter),600);return()=>clearTimeout(timer);}},[shortlist,areaReady,plan?.code,plan?.remote?.role,centerKey(searchCenter),found.attempted]);
  const liveCandidates=searchPlaces(plan?.code??'');
  useEffect(()=>{
    setCandidates((current)=>{
      const additions=voting.votes.map((vote)=>vote.venue).filter((place,index,all)=>!current.some((item)=>item.id===place.id) && all.findIndex((item)=>item.id===place.id)===index);
      return additions.length ? [...current,...additions] : current;
    });
  },[voting.votes]);
  const routeInputs=JSON.stringify([plan?.meetupAt,plan?.participants.map((person)=>[person.id,person.location])]);
  useEffect(()=>{routeVersion.current++;routeRequest.current?.abort();setResults({});setRouteBusy(false);setRouteMessage('');},[routeInputs]);

  const adopt = (next: PlanDraft) => {
    latest.current = next; setPlan(next);
    if(next.chosenVenue && ['verified','onemap','google_places'].includes(next.chosenVenue.source)) {
      const venue=next.chosenVenue;
      setCandidates((current)=>current.some((place)=>place.id===venue.id)?current:[venue,...current]);
    }
    setMeetupText(singaporeInput(new Date(next.meetupAt ?? Date.now())));
    setCommuteText(singaporeInput(new Date(next.commuteAt ?? Date.now())));
  };
  useEffect(() => {
    let active = true;
    loadPlanDraft().then((saved) => { if (active) {
      adopt(saved ?? { code: createPlanCode(), participants: [], meetupAt: new Date().toISOString(), commuteAt: new Date().toISOString() });
      const own=saved?.participants.find((person)=>person.id===saved.remote?.participantId);
      if(saved?.remote?.role==='guest' && own) {setGuestName(own.name);setGuestLocation(own.location);setGuestMode(own.transportMode ?? 'either');}
    } }).catch(() => setMessage('Could not load the saved plan. Please reload.'));
    AsyncStorage.getItem('bojio.plan-recovery').then(async(value) => { if (active && value) {const saved=JSON.parse(value);if(saved.chosenVenue?.source==='google_places')saved.chosenVenue=googleReference(saved.chosenVenue);await AsyncStorage.setItem('bojio.plan-recovery',serializePlan(saved));setBackup(saved);} }).catch(() => undefined);
    return () => { active = false; routeVersion.current++; routeRequest.current?.abort(); };
  }, []);
  useEffect(() => {
    if (plan) savePlanDraft(plan).catch(() => setMessage('Could not save on this device. Keep this tab open and retry.'));
  }, [plan]);

  useEffect(()=>{
    if(outing.plan && !busyRef.current && JSON.stringify(outing.plan)!==JSON.stringify(latest.current))adopt(outing.plan);
  },[outing.plan]);
  const edit = (changes: Partial<PlanDraft>) => {
    if (!latest.current) return;
    const next = { ...latest.current, ...changes, pendingSync: true };
    latest.current = next; setPlan(next);
  };
  const run = async (action: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setMessage('');
    try { await action(); } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Could not complete that action. Please retry.'); }
    finally { busyRef.current = false; setBusy(false); }
  };
  const retain = async (current: PlanDraft) => { await AsyncStorage.setItem('bojio.plan-recovery', serializePlan(current)); setBackup(current); };
  const join = async (code: string) => {
    if(Platform.OS==='web'&&typeof window!=='undefined'&&window.history.state?.bojioSheet==='outing'){const {bojioSheet:_sheet,...rest}=window.history.state;window.history.replaceState(rest,'',window.location.href);}
    setOptionsOpen(false); onOpenParty(code);
  };
  const publish = async () => run(async () => {
    if (!isRemotePlansConfigured()) throw new Error('Shared plans are not connected yet. The group is saved on this device.');
    const prepared = prepareRemoteHost(latest.current!);
    await savePlanDraft(prepared); latest.current = prepared; setPlan(prepared);
    try {
      const synced = { ...await publishRemotePlan(prepared), pendingSync: false };
      await savePlanDraft(synced); adopt(synced); setMessage('Shared plan saved. Copy the invite link for friends.');
    } catch (cause) {
      const detail=cause instanceof Error?cause.message:'';
      if(!/Plan changed on another device/i.test(detail))throw cause;
      await retain(prepared);
      const remote=await loadRemotePlan(prepared.code,prepared.remote);
      const merged=mergeOuting(prepared,remote);
      const rebased:PlanDraft={...merged,revision:remote.revision,syncedParticipants:remote.participants,remote:prepared.remote,pendingSync:true};
      await savePlanDraft(rebased);adopt(rebased);
      setMessage('The party changed while saving. Latest changes were merged—review them, then tap Save again. Your previous copy is in recovery.');
    }
  });
  const refresh = async () => run(async () => {
    const current = latest.current!;
    if (current.pendingSync) await retain(current);
    const remote = await loadRemotePlan(current.code, current.remote);
    const kept=keepConfirmedHomes(current,remote);
    await savePlanDraft(kept); adopt(kept); setMessage('Latest plan loaded. Previous local edits are kept in recovery.');
    routeVersion.current++; setResults({}); setRouteBusy(false);
  });
  const saveGuest = async (name = guestName, location = guestLocation) => run(async () => {
    if (!location || !name.trim()) throw new Error('Enter your name and choose your location.');
    const current = latest.current!;
    const access = { ...current.remote, role: 'guest' as const, guestToken: current.remote?.guestToken ?? Crypto.randomUUID().replace(/-/g, '') + Crypto.randomUUID().replace(/-/g, '') };
    await savePlanDraft({ ...current, remote: access }); latest.current = { ...current, remote: access };
    adopt(await saveOutingGuest(current.code, name.trim(), location, guestMode, access)); setMessage('Your entry is shared.');
  });
  const share = () => {
    const current = latest.current ?? plan;
    if (!current?.remote?.published) return;
    const text = createPlanInviteMessage(current.code, fromPost);
    void copyPlainText(text).then((copied) => {
      setInviteCopied(copied);
      setMessage(copied ? 'Invite copied. Paste it into your group chat.' : `Couldn’t copy automatically. Select and copy this invite: ${text}`);
    });
  };
  const open = (url: string) => run(async () => { await Linking.openURL(url); });
  // Keep cards stable as times arrive; only request the currently displayed shortlist.
  const votedIds=new Set(voting.votes.map(v=>v.venue.id));
  const pinned=candidates.filter(p=>p.id===plan?.chosenVenueId||votedIds.has(p.id)||p.source==='onemap');
  const available=(shortlist?candidates.filter(p=>p.source!=='google_places'):[...pinned,...liveCandidates]).map(p=>resolvedPlace(p)!).filter((p,i,all)=>all.findIndex(q=>q.id===p.id)===i);
  const matchingPlaces = available.filter((place) => matchesVenue(place, venueQuery, shortlist?foodFilter:'', shortlist?areaFilter:'') && (shortlist||otherHours||place.source!=='google_places'||pinned.some(p=>p.id===place.id)||hoursAt(place,plan?.meetupAt).matches));
  const visiblePlaces = deckActive ? [deckActive] : showAllPlaces ? matchingPlaces : matchingPlaces.slice(0, 3);
  const visibleIdentity = JSON.stringify(visiblePlaces.map((place) => [place.id,place.latitude,place.longitude]));
  useEffect(()=>{for(const place of visiblePlaces)if(place.source==='google_places' && !place.latitude)void ensurePlace(place.providerPlaceId!);},[visibleIdentity,googleRevision]);
  const compare = async () => {
    if (!plan) return;
    const selectedTime = parseSingaporeInput(meetupText);
    if (!selectedTime) { setRouteMessage('Enter a valid meetup departure time to see travel times.'); return; }
    const useNow = Date.parse(selectedTime) <= Date.now();
    const departure = useNow ? new Date().toISOString() : selectedTime;
    const version = ++routeVersion.current;
    routeRequest.current?.abort(); routeRequest.current=new AbortController();
    setRouteBusy(true); setResults({}); setRouteMessage('Checking scheduled trips…');
    try {
      for (const place of visiblePlaces) {
        if(!validLocation({label:place.name,latitude:place.latitude,longitude:place.longitude}))continue;
        setRouteMessage(`Checking ${place.name}…`);
        const trips=plan.participants.filter((person)=>validLocation(person.location)).map((person)=>({id:person.id,from:person.location!,to:placeLocation(place)}));
        const key = (trip: typeof trips[number]) => tripKey(trip, useNow ? 'now' : departure);
        const retained:RouteResult[]=[];
        const missing=trips.filter((trip)=>{const saved=completed.current.get(key(trip));if(saved?.route && Date.parse(saved.route.startAt)>Date.now()){retained.push({...saved,id:trip.id});return false;}return true;});
        setResults((current)=>({...current,[place.id]:retained}));
        const routes = await scheduledTrips(missing, departure, (partial) => {
          if (version === routeVersion.current) {setResults((current) => ({ ...current, [place.id]: [...retained,...partial] }));for(const result of partial){const trip=trips.find((trip)=>trip.id===result.id);if(trip && result.route)completed.current.set(key(trip),result);}}
        }, routeRequest.current.signal);
        if (version !== routeVersion.current) return;
        setResults((current) => ({ ...current, [place.id]: [...retained,...routes] }));
        if(routes.some((route)=>route.failure==='quota'||route.failure==='authentication')){setRouteMessage('Travel service paused. Keep your selection, retry later or open Google Maps.');return;}
      }
      if (version === routeVersion.current) setRouteMessage('');
    } catch (cause) { if (version === routeVersion.current) setRouteMessage(cause instanceof Error ? cause.message : 'Route check failed. Retry.'); }
    finally { if (version === routeVersion.current) setRouteBusy(false); }
  };
  useEffect(() => {
    setRouteBusy(false);
    if (!plan?.participants.some((person) => validLocation(person.location)) || !visiblePlaces.length) return;
    const timer = setTimeout(() => void compare(), 600);
    return () => { clearTimeout(timer); routeVersion.current++; routeRequest.current?.abort(); };
  }, [routeInputs, visibleIdentity]);
  useEffect(()=>{setRouteSlow(false);if(!routeBusy)return;const timer=setTimeout(()=>setRouteSlow(true),8000);return()=>clearTimeout(timer);},[routeBusy]);
  const ranked = rankScheduledPlaces(plan?.participants ?? [], available, results);
  const filtered = matchingPlaces.map((place) => ranked.find((item) => item.place.id === place.id)!);
  if (!plan) return <View><Text accessibilityRole="alert">{message || outing.error || 'Loading your plan…'}</Text>{message || outing.error ? <Button label="Retry loading plan" onPress={()=>void loadPlanDraft().then((saved)=>{if(saved){adopt(saved);setMessage('');}}).catch(()=>setMessage('Saved plan remains unreadable. It has not been overwritten.'))}/> : null}</View>;
  const guest = plan.remote?.role === 'guest';
  const editable = !guest && plan.status !== 'closed' && !busy;
  const ready = plan.participants.length > 0 && plan.participants.every((person) => person.name.trim());
  const locationsReady = ready && plan.participants.every(person=>validLocation(person.location));
  const selected = plan.chosenVenue && ['verified','onemap','google_places'].includes(plan.chosenVenue.source) ? resolvedPlace(plan.chosenVenue) : undefined;
  const selectionReason = plan.status === 'closed' ? 'This plan is closed. Voting is paused; the host can reopen it.' : guest ? 'Vote for your favourite below. The host confirms the final meetup venue.' : busy ? 'Another action is finishing. Please try again in a moment.' : '';
  const chooseVenue = (place: Place) => {
    if (!editable) { setVenueNotice(selectionReason); return; }
    edit({ chosenVenue: place, chosenVenueId: place.id });
    setVenueNotice(`Selected ${place.name}. ${plan.remote?.published ? 'Open ··· and save the shared plan to update your friends.' : 'Your draft saves automatically. You can open Last Call now.'}`);
  };
  const setPerson = (id: string, changes: Partial<Participant>) => edit({ participants: plan.participants.map((person) => person.id === id ? { ...person, ...changes } : person) });
  const readyToSwipe=meetReady(plan);
  const self=meetSelf(plan);
  const nameValue=self?self.name:guest?guestName:draftName;
  const onName=(value:string)=>{
    const current=latest.current;
    if(!current)return;
    if(current.remote?.role==='guest')setGuestName(value);
    const existing=meetSelf(current);
    if(existing){edit({participants:current.participants.map((person)=>person.id===existing.id?{...person,name:value}:person)});return;}
    if(current.remote?.role==='guest')return;
    const trimmed=value.trim();
    if(!trimmed){setDraftName(value);return;}
    const id=Crypto.randomUUID();
    const remote=current.remote?.role==='host'?{...current.remote,participantId:current.remote.participantId??id}:current.remote;
    edit({participants:[...current.participants,{id,name:value,origin:'Location not set',transportMode:'either'}],remote});
  };
  const onFirstHome=(location:GeoLocation)=>{
    const current=latest.current;
    if(!current)return;
    const existing=meetSelf(current);
    const name=(existing?.name??(current.remote?.role==='guest'?guestName:draftName)).trim();
    if(!name){setMessage('Add your name, then choose your home again.');return;}
    if(current.remote?.role==='guest'){void saveGuest(name,location);return;}
    void run(async()=>{
      const chosen={label:location.label.slice(0,300),latitude:location.latitude,longitude:location.longitude};
      if(!validLocation(chosen))throw new Error('Choose a valid home address.');
      const id=existing?.id??Crypto.randomUUID();
      const participants=existing?current.participants.map((person)=>person.id===id?{...person,name,location:chosen,origin:chosen.label.slice(0,120)}:person):[...current.participants,{id,name,origin:chosen.label.slice(0,120),location:chosen,transportMode:'either' as const}];
      const remote=current.remote?.role==='host'?{...current.remote,participantId:current.remote.participantId??id}:current.remote;
      const next={...current,participants,remote,pendingSync:true};
      latest.current=next;setPlan(next);
      try{await rememberHome(name,chosen);await rememberPartyHome(current.code,id,chosen);}catch{setMessage('Home pin saved for this outing. It could not be remembered for next time.');}
    });
  };
  const saveStartingPoint=async(location:GeoLocation)=>{
    rememberArea(location);
  };
  const searchAround=(area:GeoLocation)=>{rememberArea(area);setShortlist(false);void discover(plan.code,area,2000,'replace');};
  if(!readyToSwipe)return <View style={styles.wrap}>
    <MeetSetup plan={plan} name={nameValue} onName={onName} onHome={onFirstHome} showEditor={!!self?.name.trim()}/>
    {message||outing.error?<Text accessibilityRole="alert" style={styles.message}>{message||outing.error}</Text>:null}
  </View>;
  return <View style={styles.wrap}>
    <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
      <View style={{flex:1}}><Text style={{fontSize:11,letterSpacing:1.5,fontWeight:'800',color:colors.muted,marginBottom:6}}>PICK LAH</Text><Text style={[styles.title,{fontSize:32,letterSpacing:-1}]}>Where we makan?</Text><Text style={{fontSize:14,color:colors.muted,marginTop:5}}>Left is no. Right is yes.</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel="Edit search criteria and outing" onPress={openSheet} style={{width:48,height:48,borderRadius:24,backgroundColor:colors.card,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:colors.line}}><Text style={{fontSize:28,fontWeight:'900'}}>···</Text></Pressable>
    </View>
    <HomeLocationEditor key={'home:'+plan.code+plan.remote?.participantId} plan={plan}/>
    {!shortlist&&found.busy?<Text accessibilityLiveRegion="polite" style={styles.copy}>Finding restaurants… Your cards will appear here.</Text>:null}
    {!shortlist&&found.attempted&&!found.busy&&!found.error&&!liveCandidates.length?<Text accessibilityRole="alert">No restaurants returned for this search. Previous cards are kept; choose another area in ···.</Text>:null}
    {!shortlist&&found.error?<Card><Text accessibilityRole="alert">{found.error}</Text><Button label="Search options & retry" onPress={openSheet}/></Card>:null}
    {message||outing.error?<Text accessibilityRole="alert" style={styles.message}>{message||outing.error}</Text>:null}
    {venueNotice?<Text accessibilityLiveRegion="polite" style={styles.message}>{venueNotice}</Text>:null}
    <SwipeDeck key={plan.code} plan={plan} rankingOpen={rankingOpen} onOpenRanking={()=>setRankingOpen(true)} onCloseRanking={()=>setRankingOpen(false)} batch={found.batch} mode={found.mode} searchBusy={found.busy} onMore={!guest&&searchCenter?()=>void discover(plan.code,searchCenter,found.radius,'append'):undefined} candidates={shortlist?candidates.filter(p=>p.source!=='google_places'):liveCandidates} onChoose={chooseVenue} onActive={setDeckActive}/>
    {selected?<Card><Text style={styles.heading}>✓ {selected.name}</Text></Card>:null}
    <Modal visible={optionsOpen} animationType="slide" onRequestClose={dismissSheet}>
      <View style={[styles.sheet,Platform.OS==='web'?styles.sheetWeb:null]}>
        <SheetBar style={styles.sheetBar}><Text style={styles.heading}>Search & outing</Text><CloseButton label="Close search and outing" onPress={dismissSheet}/></SheetBar>
        <ScrollView style={styles.sheetScroll} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.sheetBody}>
    {!guest?<>
    <Text style={styles.copy}>Popular nearby restaurants with listed hours covering your meetup time. Opening is not guaranteed.</Text>
    <Text style={styles.note}>{manualCenter?`Near ${manualCenter.label}`:`Geographic midpoint of ${groupCenter.count} people with starting locations · not a travel-time fairness result`}</Text>
    <Disclosure title={searchCenter?'Change search area':'Choose a search area'} summary={manualCenter?'Search near here':`${groupCenter.count} home locations · geographic midpoint`} defaultOpen={!searchCenter}><MeetLocationPanel value={manualCenter??searchCenter} disabled={busy||plan.status==='closed'} canSearch count={groupCenter.count} total={plan.participants.length} onLocation={saveStartingPoint} onNearby={area=>{searchAround(area);dismissSheet();}} onMidpoint={()=>{if(groupCenter.center){rememberArea(undefined);setShortlist(false);void discover(plan.code,groupCenter.center,2000,'replace');dismissSheet();}}}/></Disclosure>
    {searchCenter?<Button label={found.busy?'Finding restaurants…':found.attempted && found.centerKey!==centerKey(searchCenter)?'Search updated area':'Refresh nearby restaurants'} onPress={!found.busy?()=>{setShortlist(false);void discover(plan.code,searchCenter,2000,'replace');dismissSheet();}:undefined}/>:<Text style={styles.copy}>Add a starting location or choose an area above.</Text>}
    {found.error?<Text accessibilityRole="alert" style={styles.message}>{found.error}</Text>:null}
    {found.attempted?<Text style={styles.note}>Results within {found.radius/1000} km of the last searched area{found.centerKey!==centerKey(searchCenter)?' · area changed; search again to update':''}.</Text>:null}
    {found.attempted&&!found.busy&&searchCenter&&liveCandidates.filter(p=>hoursAt(p,plan.meetupAt).matches).length<3&&found.radius===2000?<Button secondary label="Search wider · 5 km" onPress={()=>void discover(plan.code,searchCenter,5000,'replace')}/>:null}
    <Toggle label="Include other opening hours" description="Show restaurants with unknown hours or hours outside your meetup time." value={otherHours} onChange={setOtherHours}/>
    <Toggle label="Browse checked shortlist" description="On: checked venue list. Off: Google restaurant results." value={shortlist} onChange={value=>{setShortlist(value);setVenueQuery('');setFoodFilter('');setAreaFilter('');}}/>
    {!shortlist?<Text style={{fontSize:13,color:colors.muted}}>Google Maps</Text>:<Text style={styles.note}>Operator-checked shortlist · not live popularity or opening status.</Text>}

    </>:<Text>Everyone uses the host’s restaurant list. Ask the host to change the search area.</Text>}
          <Text style={styles.note}>Changing the area replaces the active cards for everyone. Existing ratings are retained; only the active restaurants appear in the ranking. Only the host changes a shared deck.</Text>
    <Disclosure title="Outing setup · people, time & invites">
    <Card><Text style={styles.label}>YOUR OUTING AT A GLANCE</Text>
      <Text style={styles.copy}>{selected ? `✓ Eating at ${selected.name}` : plan.remote?.published ? 'Vote for a place below. The host will confirm where to meet.' : '1. Pick a place below and tap “Meet here”.'}</Text>
      <Text style={styles.copy}>{!plan.participants.length ? '2. Add yourself under “Who’s coming?”.' : !locationsReady ? `Still to finish: ${plan.participants.filter((person) => !person.name.trim() || !validLocation(person.location)).map((person) => person.name || 'Unnamed person').join(', ')}. Add a name, search a starting point, and tap a result.` : `✓ ${plan.participants.length} people have confirmed starting points.`}</Text>
      <Text style={styles.note}>You can choose food without checking travel times. Starting points are also used as home destinations.</Text>
    </Card>
    <Button label="See journeys so far →" secondary onPress={() => go('train')} />
    {message ? <Text accessibilityRole="alert" style={styles.message}>{message}</Text> : null}
    {outing.error ? <Text accessibilityRole="alert" style={styles.message}>{outing.error}</Text> : null}
    <Disclosure title="Got an invite code?"><TextInput accessibilityLabel="Plan code" maxLength={6} value={joinCode} onChangeText={setJoinCode} autoCapitalize="characters" placeholder="Six-character code" style={styles.input} /><Button label="Open shared plan" onPress={!busy && isPlanCode(normalizePlanCode(joinCode)) ? () => void join(joinCode) : undefined} /></Disclosure>
    <Card><Text style={styles.label}>WHO’S COMING?</Text>
      {!plan.participants.length ? <Text style={styles.copy}>Add yourself first. Share the plan when you’re ready for friends to join.</Text> : null}
      {plan.participants.map((person, index) => <View key={person.id} style={styles.person}>
        <Disclosure title={person.name || `Person ${index + 1}`} summary={person.location ? `${person.transportMode === 'train' ? 'Train / bus' : person.transportMode === 'ride' ? 'Shared ride' : 'Either way home'} · ${person.location.label}` : 'Add a name and starting point'} defaultOpen={!person.location}>
        <Text style={styles.label}>PERSON {index + 1}</Text><TextInput accessibilityLabel={`Person ${index + 1} name`} editable={editable} maxLength={80} value={person.name} onChangeText={(name) => setPerson(person.id, { name })} placeholder="Name" style={styles.input} />
        {editable ? <LocationPicker label="Starting point · also your return destination" initialQuery={person.origin} value={person.location} onChange={(location) => setPerson(person.id, { location, origin: location.label.slice(0,120) })} /> : <Text style={styles.copy}>{person.location?.label ?? `${person.origin} · location needs confirmation`}</Text>}
        <TransportPicker value={person.transportMode ?? 'either'} disabled={!editable} onChange={(transportMode) => setPerson(person.id, { transportMode })} />
        {editable ? <Button label="Remove person" secondary onPress={() => edit({ participants: plan.participants.filter((candidate) => candidate.id !== person.id) })} /> : null}
        </Disclosure>
      </View>)}
      {editable && plan.participants.length < 12 ? <Button label="+ Add person" secondary={plan.participants.length > 0} onPress={() => edit({ participants: [...plan.participants, { id: Crypto.randomUUID(), name: '', origin: '', transportMode: 'either' }] })} /> : null}
      {guest && plan.status !== 'closed' ? <View style={styles.person}><Text style={styles.label}>YOUR ENTRY</Text><TextInput accessibilityLabel="Your name" value={guestName} onChangeText={setGuestName} placeholder="Your name" style={styles.input} maxLength={80} editable={!busy} /><LocationPicker label="Your starting and return location" value={guestLocation} onChange={setGuestLocation} /><TransportPicker value={guestMode} onChange={setGuestMode} disabled={busy} /><Button label="Save my entry" onPress={!busy && guestLocation && guestName.trim() ? () => void saveGuest() : undefined} /></View> : null}
    </Card>
    <Card><Disclosure title="When are we going?" summary={`Out: ${meetupText} · Home: ${commuteText} · SGT`}><Text style={styles.label}>MEETUP DEPARTURE TIME</Text><Text style={styles.copy}>Singapore time · YYYY-MM-DD HH:mm. Used for journeys to the venue.</Text><TextInput accessibilityLabel="Meetup departure time" editable={editable} style={styles.input} value={meetupText} onChangeText={(text) => { setMeetupText(text); edit({ meetupAt: parseSingaporeInput(text) ?? undefined }); }} />
      <Text style={styles.label}>RETURN DEPARTURE TIME</Text><TextInput accessibilityLabel="Return departure time" editable={editable} style={styles.input} value={commuteText} onChangeText={(text) => { setCommuteText(text); edit({ commuteAt: parseSingaporeInput(text) ?? undefined }); }} />
      {editable ? <Button label="Use current time" secondary onPress={() => { const now = new Date(); edit({ meetupAt: now.toISOString(), commuteAt: now.toISOString() }); setMeetupText(singaporeInput(now)); setCommuteText(singaporeInput(now)); }} /> : null}
      </Disclosure>
    </Card>
    {selected ? <Card><Text style={styles.label}>CHOSEN VENUE</Text><Text style={styles.heading}>{selected.name}</Text><Text style={styles.copy}>{selected.address}</Text><Button label="Check Last Call →" onPress={() => go('train')} /><Disclosure title="Rides & bill"><Button label="Compare shared rides →" secondary onPress={() => go('ride')} /><Button label="Split the bill →" secondary onPress={() => go('split')} /></Disclosure></Card> : null}
    <GoogleVenueStatus place={selected}/>
    </Disclosure>

    <Disclosure title="Browse results & journey details">
    <TextInput accessibilityLabel="Filter places" placeholder="Search name, area or food…" value={venueQuery} onChangeText={(text) => { setVenueQuery(text); setShowAllPlaces(true); }} style={styles.input} />
    {shortlist?<Disclosure title="Food & area filters" summary={`${foodFilter || 'All food'} · ${areaFilter || 'All areas'}`}>
      <Text style={styles.label}>WHAT TO EAT</Text>
      {['', ...Array.from(new Set(candidates.map(cuisine)))].map((food) => <Button key={food} label={`${foodFilter === food ? '✓ ' : ''}${food || 'All food'}`} secondary onPress={() => { setFoodFilter(food); setShowAllPlaces(true); }} />)}
      <Text style={styles.label}>WHERE</Text>
      {['', ...Array.from(new Set(candidates.map((place) => place.area))).sort()].map((area) => <Button key={area} label={`${areaFilter === area ? '✓ ' : ''}${area || 'All areas'}`} secondary onPress={() => { setAreaFilter(area); setShowAllPlaces(true); }} />)}
    </Disclosure>:null}
    {venueQuery || foodFilter || areaFilter ? <Button label="Clear filters" secondary onPress={() => { setVenueQuery(''); setFoodFilter(''); setAreaFilter(''); }} /> : null}
    <Disclosure title="Find a different place"><LocationPicker label="Or find a venue by address" onChange={(location) => {
      const place: Place = { id: `onemap-${location.latitude}-${location.longitude}`, name: location.label, address: location.label, area: 'Singapore', nearestStation: '', detail: 'OneMap address. Restaurant identity and hours are not verified.', tags: [], openUntil: 'Hours unknown', point: { x: location.longitude, y: location.latitude }, latitude: location.latitude, longitude: location.longitude, source: 'onemap', sourceTimestamp: new Date().toISOString() };
      setCandidates((current) => [place, ...current.filter((item) => item.id !== place.id)]);
      setVenueQuery(''); setFoodFilter(''); setAreaFilter(''); setShowAllPlaces(true);
      if (plan.remote?.published) void voting.vote(place); else chooseVenue(place);
    }} /></Disclosure>
    <Text style={styles.note}>Train / bus times appear automatically for confirmed starting points · {Date.parse(parseSingaporeInput(meetupText) ?? '') <= Date.now() ? 'departing now (saved meetup time has passed)' : `departing ${meetupText} SGT`}.</Text>
    {routeMessage ? <Text accessibilityLiveRegion="polite" style={styles.note}>{routeMessage}</Text> : null}
    {!routeBusy && plan.participants.some((person)=>validLocation(person.location)) ? <Button label="Refresh travel times" secondary onPress={() => void compare()} /> : null}
    {routeSlow?<Text accessibilityRole="alert" style={styles.message}>Journeys are taking longer. Keep choosing your venue, or use Google Maps directions below.</Text>:null}
    <Text style={styles.note}>{filtered.length} places · only complete group journeys can earn a travel ranking.</Text>
    {!filtered.length ? <Text style={styles.copy}>{found.busy?'Finding nearby restaurants…':'No matches for this time and filter. Show other restaurants, change area, or use the checked shortlist.'}</Text> : null}
    {(showAllPlaces ? filtered : filtered.slice(0,3)).map(({ place, routes, complete, max, gap }) => <Card key={place.id}>
      <Disclosure title={place.name} summary={place.source==='google_places'?`${place.rating??'Unrated'}${place.rating?' ★':''} · ${place.reviewCount??0} reviews · tap for hours`:`${place.area} · ${cuisine(place)} · tap for details`}>
      <Text style={styles.copy}>{place.address}</Text><Text style={styles.copy}>{place.detail}</Text>
      {place.source==='google_places'?<>{(place.currentHours?.weekdayDescriptions??place.regularHours?.weekdayDescriptions??['Listed hours unavailable']).map((line,i)=><Text key={i} style={styles.copy}>{line}</Text>)}</>:<Text style={styles.note}>{place.source === 'verified' ? `Operator details checked ${place.sourceTimestamp?.slice(0,10)}. Opening hours are not live.` : 'Address result only. Check restaurant identity and hours before selecting.'}</Text>}
      <Button label="Reviews & photos on Google Maps ↗" secondary onPress={() => void open(venueMapsUrl(place))} />
      <Text style={styles.note}>Opens Google Maps for reviews and photos. Confirm the branch and opening hours before travelling.</Text>
      {place.sourceUrl ? <Button label="Check operator’s website ↗" secondary onPress={() => void open(place.sourceUrl!)} /> : null}
      </Disclosure>
      {place.source==='google_places'?<><Text style={styles.copy}>{place.address}</Text><Text style={styles.note}>{hoursAt(place,plan.meetupAt).label}</Text><GoogleVenueStatus place={place}/></>:null}
      {routes.length ? <Pill>{complete ? `Longest ${Math.ceil(max! / 60)} min · gap ${Math.ceil(gap! / 60)} min` : 'No complete group transit result'}</Pill> : null}
      {plan.participants.map((person, index) => { const result = routes.find((item) => item.id === person.id); return <Text key={person.id} style={[styles.note, { fontSize: 12, marginVertical: 3 }]}>{person.name || `Person ${index + 1}`}: {!validLocation(person.location) ? 'add starting point' : result?.route ? `${Math.ceil(result.route.durationSeconds / 60)} min · ${result.route.source==='google'?'Google Maps':'OneMap'}` : result?.message ?? (routeBusy ? 'checking travel time…' : 'travel time not available')}</Text>; })}
      {(routeSlow || routes.some((route)=>route.status==='unavailable')) && place.latitude!==undefined ? plan.participants.filter((person)=>validLocation(person.location)).map((person)=><Button key={person.id} secondary label={`Google Maps from ${person.name} ↗`} onPress={()=>void open(directions(person.location!,placeLocation(place)))}/>):null}
      <View style={styles.wrap}>
      {!guest?<Button label={selected?.id===place.id?'Confirmed meetup ✓':'Meet here'} secondary onPress={editable?()=>chooseVenue(place):undefined}/>:<Text style={styles.note}>Rate restaurants in the shared swipe deck above.</Text>}
      {selected?.id === place.id ? <Button label="See journeys home →" secondary onPress={() => go('train')} /> : null}
      {selected?.id === place.id ? <Text style={styles.note}>✓ Your selected venue{plan.remote?.published && plan.pendingSync ? ' · save shared plan to update friends' : ''}</Text> : null}</View>
    </Card>)}
    {filtered.length > 3 ? <Toggle label="Show all matching places" description={`On: all ${filtered.length} results. Off: the first three.`} value={showAllPlaces} onChange={setShowAllPlaces} /> : null}
    </Disclosure>
    <Text style={styles.note} onPress={()=>void open('https://bojio.pages.dev/privacy.html')}>Privacy</Text><Text style={styles.note} onPress={()=>void open('https://bojio.pages.dev/terms.html')}>Terms</Text>
    <Card><Text style={styles.label}>INVITE FRIENDS · OPTIONAL</Text>
      <Text style={styles.copy}>{plan.remote?.published ? plan.pendingSync ? 'Changes saved locally. Save shared plan to update friends.' : 'Shared plan is up to date.' : 'Your draft already works on this device. Save a shared plan only when you want friends to join.'}</Text>
      {!guest ? <Button label={busy ? 'Saving…' : 'Save shared plan'} onPress={ready && editable && !!parseSingaporeInput(meetupText) && !!parseSingaporeInput(commuteText) ? () => void publish() : undefined} /> : null}
      {!ready && !guest ? <Text style={styles.note}>Add a name for each person before sharing. Locations can be added later.</Text> : null}
      {plan.remote ? <View style={styles.wrap}><Button label={inviteCopied ? 'Invite copied' : 'Copy invite link'} secondary onPress={plan.remote.published ? share : undefined} /><Button label="Refresh shared plan" secondary onPress={!busy ? () => void refresh() : undefined} /></View> : null}
      {backup ? <Button label="Restore previous local edits" secondary onPress={() => { adopt({ ...backup, pendingSync: true }); setBackup(undefined); }} /> : null}
      {!guest && plan.remote?.published ? <Disclosure title="Manage plan"><Button label={plan.status === 'closed' ? 'Reopen plan' : 'Close plan'} secondary onPress={!busy ? () => void run(async () => adopt(await setRemotePlanStatus(plan, plan.status === 'closed' ? 'planning' : 'closed'))) : undefined} /><Button label="Extend plan access" secondary onPress={!busy ? () => void run(async () => adopt(await extendRemotePlanExpiry(plan))) : undefined} /></Disclosure> : null}
    </Card>

        </ScrollView>
      </View>
    </Modal>
  </View>;
}
function MeetSetup({ plan, name, onName, onHome, showEditor }: { plan: PlanDraft; name: string; onName: (value: string) => void; onHome: (location: GeoLocation) => void; showEditor: boolean }) {
  return <View style={styles.wrap}>
    <Text style={styles.kicker}>ONE STEP</Text>
    <Text style={styles.title}>Your name and home</Text>
    <Text style={styles.copy}>Add both. Supper cards show up here after they’re saved.</Text>
    <Text style={styles.label}>YOUR NAME</Text>
    <TextInput accessibilityLabel="Your name" maxLength={80} value={name} onChangeText={onName} placeholder="What should your friends call you?" placeholderTextColor={colors.muted} editable={plan.status!=='closed'} style={styles.input} />
    {showEditor ? <HomeLocationEditor key={'home:'+plan.code+plan.remote?.participantId} plan={plan} /> : <View style={styles.homeStep}>
      <View style={styles.homeRow}><View style={styles.homeMark}><Text style={styles.homeIcon}>⌂</Text></View><View style={styles.homeCopy}><Text style={styles.homeKicker}>YOUR HOME</Text><Text style={styles.homeTitle}>Where are we sending you home?</Text></View></View>
      {plan.status!=='closed' ? <LocationPicker label="Home address" onChange={onHome} /> : <Text style={styles.copy}>This plan is closed.</Text>}
    </View>}
  </View>;
}
function TransportPicker({ value, onChange, disabled = false }: { value: TransportMode; onChange: (mode: TransportMode) => void; disabled?: boolean }) {
  return <View style={styles.wrap}><Text style={styles.label}>How are you getting home?</Text><View style={styles.options}>{(['train','ride','either'] as const).map((mode) => <Button key={mode} secondary={value !== mode} label={`${value === mode ? '✓ ' : ''}${mode === 'train' ? 'Train / bus' : mode === 'ride' ? 'Shared ride' : 'Either'}`} onPress={!disabled ? () => onChange(mode) : undefined} />)}</View></View>;
}
const styles = StyleSheet.create({
  wrap: { gap: 12, marginTop: 8 }, kicker: { fontSize: 11, letterSpacing: 1.5, fontWeight: '800', color: colors.muted, marginBottom: 6 }, title: { fontSize: 32, fontWeight: '900', color: colors.ink }, heading: { fontSize: 20, fontWeight: '800', color: colors.ink }, copy: { fontSize: 13, lineHeight: 20, color: colors.muted, marginVertical: 8 }, label: { color: colors.green, fontSize: 12, fontWeight: '800', marginTop: 8 }, input: { borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 12, color: colors.ink, marginVertical: 10 }, person: { borderTopWidth: 1, borderColor: colors.line, paddingVertical: 14, gap: 8 }, message: { padding: 12, backgroundColor: colors.coralSoft, borderRadius: 12, color: colors.ink, lineHeight: 19 }, options: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' }, note: { fontSize: 10, color: colors.muted, marginVertical: 10 },
  homeStep: { borderBottomWidth: 1, borderColor: colors.line, paddingVertical: 14, gap: 10 },
  homeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  homeMark: { width: 38, height: 38, borderRadius: 13, backgroundColor: colors.coralSoft, alignItems: 'center', justifyContent: 'center' },
  homeIcon: { fontSize: 21, color: colors.ink },
  homeCopy: { flex: 1, minWidth: 0 },
  homeKicker: { fontSize: 11, fontWeight: '800', letterSpacing: 1, color: colors.muted },
  homeTitle: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: colors.ink, marginTop: 3 },
  sheet: { flex: 1, minHeight: 0, backgroundColor: colors.paper },
  sheetWeb: { height: '100%', maxHeight: '100%', overflow: 'hidden' },
  sheetBar: { flexShrink: 0, paddingTop: 16, paddingHorizontal: 20, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.paper, zIndex: 2 },
  sheetScroll: { flex: 1, minHeight: 0 },
  sheetBody: { padding: 20, gap: 14, width: '100%', maxWidth: 720, alignSelf: 'center' },
});

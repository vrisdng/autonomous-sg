import { useEffect, useRef, useState } from 'react';
import { Linking, Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Disclosure } from '../components/Ui';
import { LastCallStartPicker } from '../components/LastCallStartPicker';
import { useOuting } from '../hooks/useOuting';
import { HomeLocationEditor } from '../components/HomeLocationEditor';
import { placeLocation, scheduledTrips, tripKey } from '../data/travelProvider';
import { loadRidePickup, saveRidePickup } from '../data/ridePickup';
import { meetSelf } from '../features/meet/meetReady';
import { commuteSetup, lastCallGroup } from '../features/train/commuteSetup';
import { lastCallGroupNotice, lastCallHomeGate, readGroupOrigin, writeGroupOrigin } from '../features/train/lastCallSession';
import { lastCallRouteOrigin, showLastCallStart } from '../features/train/lastCallStart';
import { persistOwnStartingPoint } from '../features/train/persistLastCallStart';
import { clock, directions, groupLeaveBy, RouteResult, validLocation } from '../features/travel/types';
import { GeoLocation, Tab } from '../types';
import { colors } from '../theme';
import { LatestJourneys } from '../components/LatestJourneys';
import { NextBoarding } from '../components/NextBoarding';
import { GoogleVenueStatus } from '../components/GoogleVenueStatus';

export function TrainScreen({ go }: { go: (tab: Tab) => void }) {
  const { plan, error, loaded, refresh } = useOuting();
  const [buffer, setBuffer] = useState(15);
  const [storedResults, setResults] = useState<RouteResult[]>([]);
  const [resultIdentity, setResultIdentity] = useState('');
  const [expanded, setExpanded] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [slow,setSlow]=useState(false);
  const completed=useRef(new Map<string,RouteResult>());
  const [message, setMessage] = useState('Routes update automatically.');
  const [now, setNow] = useState(Date.now());
  const requestVersion = useRef(0);
  const activeRequest = useRef<AbortController | undefined>(undefined);
  const lastCheckedIdentity = useRef('');
  const [groupPin, setGroupPin] = useState<{code:string;location?:GeoLocation;ready:boolean}>({code:'',ready:false});
  const groupEdit = useRef(0);
  const [editor, setEditor] = useState<'location' | 'people'>();
  const [startMessage, setStartMessage] = useState('');
  const [startFailed, setStartFailed] = useState(false);
  const venue = commuteSetup(plan).venue;
  const venueOrigin = venue ? placeLocation(venue) : undefined;
  const cachedOrigin=plan?.code?readGroupOrigin(plan.code):undefined;
  const pinCode=plan?.code??'';
  const pinMatches=groupPin.code===pinCode;
  const groupOrigin=pinMatches&&groupPin.ready?groupPin.location:cachedOrigin?.location;
  const groupOriginReady=(pinMatches&&groupPin.ready)||!plan?.code||cachedOrigin!==undefined;
  // Wait for the saved pin. Falling back to the venue first searches twice and misses the cache.
  const origin = lastCallRouteOrigin(groupOrigin, groupOriginReady, venueOrigin);
  const self = plan ? meetSelf(plan) : undefined;
  const mustSetStart = !!plan && groupOriginReady && showLastCallStart(validLocation(groupOrigin) ? groupOrigin : undefined, self);
  const people = lastCallGroup(plan);
  const { ready: readyPeople, canSearch } = lastCallHomeGate(people);
  const homeNotice = lastCallGroupNotice(people);
  const identity = JSON.stringify([plan?.code,plan?.remote?.participantId,origin,people.map((person) => [person.id,person.name,person.location])]);
  const results = resultIdentity === identity ? storedResults : [];
  useEffect(() => {
    const request = ++groupEdit.current;
    let active = true;
    if (!plan?.code) return;
    const code=plan.code;
    const cached=readGroupOrigin(code);
    if(cached)setGroupPin({code,location:cached.location,ready:true});
    loadRidePickup(code).then((value) => { if (active && groupEdit.current === request) { writeGroupOrigin(code,value); setGroupPin({code,location:value,ready:true}); } }).catch(() => { if (active && groupEdit.current === request) { setMessage('Couldn’t load your saved starting point. Choose it again.'); setGroupPin({code,location:undefined,ready:true}); } });
    return () => { active = false; };
  }, [plan?.code]);
  const chooseGroupFrom = (location: GeoLocation) => {
    groupEdit.current++;
    const code=plan?.code??'';
    setGroupPin({code,location,ready:true});
    setStartFailed(false);
    setStartMessage('');
    if (!plan?.code) return;
    writeGroupOrigin(plan.code, location);
    const current = plan;
    void (async () => {
      try { await saveRidePickup(current.code, location); }
      catch { setStartFailed(true); setStartMessage('Couldn’t save this starting point on this device. Try again.'); return; }
      try {
        await persistOwnStartingPoint(current, location);
        setStartFailed(false);
        setStartMessage('Starting point saved.');
      } catch (cause) {
        setStartFailed(true);
        setStartMessage(cause instanceof Error ? cause.message : 'Couldn’t save your starting point. Try again.');
      }
    })();
  };
  useEffect(() => { if(loaded && plan?.remote?.published) void refresh(); }, [loaded, plan?.code, plan?.remote?.published, plan?.remote?.participantId, refresh]);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 15000); return () => { clearInterval(timer); requestVersion.current++; }; }, []);
  const deadline = groupLeaveBy(results, readyPeople.map((person) => person.id), buffer, now);
  useEffect(()=>{setSlow(false);if(!busy)return;const timer=setTimeout(()=>setSlow(true),8000);return()=>clearTimeout(timer);},[busy]);
  const check = async (reuse = false) => {
    if (!validLocation(origin) || !canSearch) return;
    const departure = new Date().toISOString();
    const version = ++requestVersion.current;
    activeRequest.current?.abort();
    activeRequest.current = new AbortController();
    lastCheckedIdentity.current = identity;
    setResultIdentity(identity);
    const trips=readyPeople.map((person)=>({id:person.id,from:origin,to:person.location!}));
    const key=(trip:typeof trips[number])=>tripKey(trip,'now');
    const retained:RouteResult[]=[];
    const missing=trips.filter((trip)=>{const saved=completed.current.get(key(trip));if(reuse && saved?.route && Date.parse(saved.route.startAt)>Date.now()){retained.push({...saved,id:trip.id});return false;}return true;});
    setBusy(true); setResults(retained); setMessage('Checking scheduled journeys…');
    try {
      const routes = await scheduledTrips(missing, departure, (partial) => {
        if(version===requestVersion.current){setResults([...retained,...partial]);for(const result of partial){const trip=trips.find((trip)=>trip.id===result.id);if(trip && result.route)completed.current.set(key(trip),result);}}
      }, activeRequest.current.signal);
      if (version !== requestVersion.current) return;
      setResults([...retained,...routes]); setMessage(routes.some((route)=>route.status==='unavailable')?'Some routes unavailable. Retry or open Maps.':'');
    } catch (cause) { if (version === requestVersion.current) setMessage(cause instanceof Error ? cause.message : 'Could not check routes. Please retry.'); }
    finally { if (version === requestVersion.current) setBusy(false); }
  };
  // Check once after the roster or origin settles. Keep the last routes on screen
  // until that patch returns; tab visits do not wipe them.
  useEffect(() => {
    if (!loaded || !validLocation(origin) || !canSearch) return;
    const timer = setTimeout(() => { if(lastCheckedIdentity.current !== identity) void check(true); }, 900);
    return () => { clearTimeout(timer); requestVersion.current++; activeRequest.current?.abort(); setBusy(false); };
  }, [identity, loaded]);
  const open = async (id: string) => {
    const person = people.find((person) => person.id === id);
    if (!validLocation(origin) || !validLocation(person?.location)) return;
    try { await Linking.openURL(directions(origin, person.location)); }
    catch { setMessage('Couldn’t open Maps. Please retry.'); }
  };
  const share = async () => {
    if (!origin) return;
    const text = [`Apple67 leaving-now journeys from ${origin.label}`, deadline ? `Leave-by: ${clock(deadline)}` : 'No complete future leave-by is available.',
      ...people.map((person) => { const route = results.find((result) => result.id === person.id)?.route; return `${person.name}: ${route ? `${clock(route.startAt)} – ${clock(route.endAt)} · ${Math.ceil(route.durationSeconds / 60)} min` : 'No scheduled journey returned'}`; }),
      'Scheduled journeys, not confirmed last services.'].join('\n');
    try { if (Platform.OS === 'web' && navigator.clipboard) { await navigator.clipboard.writeText(text); setMessage('Journey summary copied.'); } else await Share.share({ message: text }); }
    catch { setMessage('Sharing failed. Please retry.'); }
  };
  if(!loaded)return <Text style={styles.copy}>Loading your journey…</Text>;
  return <View style={styles.wrap}>
    <GoogleVenueStatus place={plan?.chosenVenue}/>
    <Text style={{fontSize:11,letterSpacing:1.5,color:colors.muted,fontWeight:'800'}}>STILL HERE?</Text><Text style={[styles.title,{letterSpacing:-1}]}>Zao already?</Text><Text style={styles.copy}>Last train does not do five more minutes.</Text>
    {error ? <Text style={styles.message}>{error}</Text> : null}
    <Card><View style={{gap:8}}><Text style={{fontSize:11,fontWeight:'700',color:colors.muted}}>FROM</Text><Text style={{fontSize:17,fontWeight:'800'}}>{validLocation(groupOrigin)?groupOrigin.label:!groupOriginReady?'Loading starting point…':venue?.name||'Choose starting point'}</Text><Text style={{fontSize:12,color:colors.muted}}>{people.length} in this group{plan?.participants.length?` · ${plan.participants.length} in the party`:''}. Train or either; ride-only friends stay on Share a ride.</Text><View style={{flexDirection:'row',gap:16}}>{mustSetStart?null:<Pressable accessibilityRole="button" onPress={()=>setEditor(editor==='location'?undefined:'location')} style={{paddingVertical:8}}><Text style={{color:colors.green,fontWeight:'700'}}>{editor==='location'?'Hide location':'Change location'}</Text></Pressable>}<Pressable accessibilityRole="button" onPress={()=>setEditor(editor==='people'?undefined:'people')} style={{paddingVertical:8}}><Text style={{color:colors.green,fontWeight:'700'}}>{editor==='people'?'Hide people':'Change people'}</Text></Pressable></View>{editor==='location'||mustSetStart?<LastCallStartPicker value={validLocation(groupOrigin)?groupOrigin:undefined} onChange={chooseGroupFrom}/>:null}{startMessage?<Text accessibilityLiveRegion="polite" style={startFailed?styles.message:{fontSize:12,color:colors.muted}}>{startMessage}</Text>:null}{validLocation(groupOrigin)?<Text style={{fontSize:11,color:colors.muted}}>Saved as your starting point. Share ride uses it when there’s no meetup pin.</Text>:null}{editor==='people'?<View style={{gap:6}}>{(plan?.participants??people).map(person=>{const included=people.some(traveller=>traveller.id===person.id);return <Text key={person.id} style={{fontSize:14,color:colors.ink}}>{person.name||'Unnamed'} · {included?person.location?.label||'Add home location':'Shared ride · not in this group'}</Text>;})}</View>:null}</View></Card>
    {homeNotice?<Text accessibilityRole="alert" style={styles.message}>{homeNotice}</Text>:null}
    <LatestJourneys scope={`${plan?.code??'local'}:${plan?.remote?.participantId??'local'}:group`} origin={origin} people={people} buffer={buffer} now={now} leaveAt={plan?.commuteAt}/>
    {plan?<HomeLocationEditor key={plan.code+plan.remote?.participantId} plan={plan}/>:null}
    <Disclosure title="Leaving now? See next bus / train">
    {message&&message!=='Routes update automatically.'?<Text style={styles.message}>{message}</Text>:null}
    <Button secondary label={busy?'Checking…':'Refresh next journey'} onPress={!busy&&validLocation(origin)&&canSearch?()=>void check():undefined}/>
    {people.map((person, personIndex) => {
      const result = results.find((route) => route.id === person.id);
      const route = result?.route;
      const isExpanded = expanded === person.id;
      const leave = route ? Date.parse(route.startAt) - buffer * 60000 : null;
      return <Card key={person.id}><Text style={styles.heading}>{person.name || `Person ${personIndex + 1}`}</Text><Text style={styles.copy}>{person.location?.label ?? 'Location needs confirmation'}</Text>
        {route ? <><NextBoarding steps={route.steps} now={now}/><Text style={styles.copy}>Depart {clock(route.startAt)} → arrive {clock(route.endAt)} · {Math.ceil(route.durationSeconds / 60)} min</Text><Text style={styles.label}>{leave! < now ? 'Leave-by has passed — check a new journey' : `Leave by ${clock(new Date(leave!).toISOString())}`}</Text>{leave! >= now ? <Text style={styles.copy}>{Math.ceil((leave! - now) / 60000)} minutes to leave · includes {buffer}-minute safety buffer</Text> : null}<Button label={isExpanded ? 'Hide route' : 'Route details'} secondary onPress={() => setExpanded(isExpanded ? undefined : person.id)} />
          {isExpanded ? route.steps.map((step, index) => <View key={index} style={styles.step}><Text style={styles.label}>{index + 1}. {step.instruction}</Text><Text style={styles.copy}>{step.from} → {step.to}{step.startAt ? `\n${clock(step.startAt)}` : ''} · {Math.ceil(step.durationSeconds / 60)} min</Text></View>) : null}
          <Text style={styles.note}>{route.source==='google'?'Google Maps':'OneMap / SLA'} · checked {clock(route.checkedAt)}</Text></> : <Text style={styles.copy}>{!validLocation(person.location) ? 'Waiting for a return destination.' : !origin ? 'Destination ready. Waiting for a departure venue.' : result?.message ?? (busy ? 'Checking this journey…' : 'Ready to check a scheduled journey.')}</Text>}
        <Button label="Directions in Google Maps ↗" secondary onPress={validLocation(origin) && validLocation(person.location) ? () => void open(person.id) : undefined} />
      </Card>;
    })}
    </Disclosure>
    <Disclosure title="Get-ready buffer" summary={`${buffer} min`}><View style={styles.options}>{[10,15,20].map(minutes=><Button key={minutes} secondary={buffer!==minutes} label={`${minutes} min`} onPress={()=>setBuffer(minutes)}/>)}</View></Disclosure>
    {results.length ? <Button label="Share journey summary" onPress={() => void share()} /> : <Text style={styles.note}>Scheduled journeys, not guaranteed last services. {people.length} {people.length === 1 ? 'person' : 'people'} heading home.</Text>}<Button label="Share a ride instead" secondary onPress={() => go('ride')} />
  </View>;
}
const styles = StyleSheet.create({ wrap: { gap: 14 }, title: { fontSize: 32, color: colors.ink, fontWeight: '900' }, heading: { fontSize: 21, color: colors.ink, fontWeight: '800' }, copy: { color: colors.muted, lineHeight: 20, marginVertical: 10 }, label: { color: colors.green, fontWeight: '800', marginVertical: 8 }, input: { padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.line, marginVertical: 10, color: colors.ink }, message: { padding: 12, backgroundColor: colors.coralSoft, borderRadius: 12, color: colors.ink }, options: { flexDirection: 'row', gap: 8, marginBottom: 14 }, step: { borderTopWidth: 1, borderColor: colors.line, marginTop: 12 }, note: { fontSize: 10, color: colors.muted, marginVertical: 8 } });

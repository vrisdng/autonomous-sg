import { RideHandoff } from '../components/RideHandoff';
import { PickupLocationEditor } from '../components/PickupLocationEditor';
import { loadRideFares, saveRideFares } from '../data/rideFares';
import { loadRidePickup, saveRidePickup } from '../data/ridePickup';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Card } from '../components/Ui';
import { useOuting } from '../hooks/useOuting';
import { HomeLocationEditor } from '../components/HomeLocationEditor';
import { GoogleVenueStatus } from '../components/GoogleVenueStatus';
import { drivingMatrix } from '../data/travelProvider';
import { directions, DriveLeg, validLocation } from '../features/travel/types';
import { ActualRide, matchActualRides, rideMatchRoster, rideMatrixReady, splitEnteredFare } from '../features/rides/actualRides';
import { isMeetupChoice, ridePickup } from '../features/rides/rideOrigin';
import { formatCents } from '../features/split/calculateBill';
import { GeoLocation, Tab } from '../types';
import { colors } from '../theme';

export function RideScreen({ go }: { go: (tab: Tab) => void }) {
  const { plan, error, refresh } = useOuting();
  const [legs,setLegs] = useState<DriveLeg[]>([]);
  const [fares,setFares] = useState<Record<string,string>>({});
  const [busy,setBusy] = useState(false);
  const [loaded,setLoaded] = useState(false);
  const [fareKey,setFareKey] = useState('');
  const [fareAttempt,setFareAttempt] = useState(0);
  const [fareError,setFareError] = useState('');
  const [fareSaveError,setFareSaveError] = useState(false);
  const [slow,setSlow] = useState(false);
  const [checked,setChecked] = useState(false);
  const [message,setMessage] = useState('');
  const [checkingFriends,setCheckingFriends] = useState(false);
  const [customPickup,setCustomPickup] = useState<GeoLocation>();
  const [pickupReady,setPickupReady] = useState(false);
  const [pickupError,setPickupError] = useState('');
  const version = useRef(0);
  const activeRequest = useRef<AbortController | undefined>(undefined);
  const meetupChosen = isMeetupChoice(plan?.chosenVenue);
  const pickup = ridePickup(plan?.chosenVenue, customPickup);
  const people = plan?.participants.filter((person) => person.transportMode !== 'train') ?? [];
  const identity = JSON.stringify([plan?.code,meetupChosen?plan?.chosenVenue?.id:'pickup',pickup?.latitude,pickup?.longitude,people.map((person) => [person.id,person.location])]);
  const storageKey = `bojio.ride-fares.v1:${JSON.stringify([plan?.code,meetupChosen?plan?.chosenVenue?.id:undefined,people.map((person) => [person.id,person.location])])}`;
  useEffect(() => {
    let active = true;
    setPickupReady(false); setCustomPickup(undefined); setPickupError('');
    if (!plan?.code) { setPickupReady(true); return; }
    loadRidePickup(plan.code).then((value) => { if (active) { setCustomPickup(value); setPickupReady(true); } }).catch(() => { if (active) { setPickupError('Couldn’t load your saved pickup. Choose it again.'); setPickupReady(true); } });
    return () => { active = false; };
  }, [plan?.code]);
  useEffect(() => {
    version.current++; setLegs([]); setChecked(false); setBusy(false); setFares({}); setLoaded(false); setMessage(''); setFareError(''); setFareSaveError(false);
    let active = true;
    loadRideFares(storageKey).then((value) => { if (active) { setFares(value);setFareKey(storageKey); setLoaded(true); } }).catch(() => { if (active) setFareError('Couldn’t load your saved fare. Tap retry.'); });
    return () => { active=false; version.current++; activeRequest.current?.abort(); };
  }, [identity,fareAttempt]);
  useEffect(() => {setSlow(false);if(!busy)return;const timer=setTimeout(()=>setSlow(true),8000);return()=>clearTimeout(timer);},[busy]);
  const roster = rideMatchRoster(people);
  const groups = useMemo(() => matchActualRides(roster.ready,legs),[identity,legs]);
  const choosePickup = (location: GeoLocation) => {
    setCustomPickup(location);
    if (!plan?.code) return;
    void saveRidePickup(plan.code, location).then(() => setPickupError('')).catch(() => setPickupError('Couldn’t save this pickup on this device. Try again.'));
  };
  const check = async () => {
    const ready=rideMatchRoster(people).ready;
    if (!pickup || !ready.length) return;
    const current = ++version.current; setBusy(true); setMessage(''); setChecked(false); setLegs([]);
    activeRequest.current?.abort();activeRequest.current=new AbortController();
    try {
      const matrix=await drivingMatrix(pickup,ready,undefined,activeRequest.current.signal);
      if(current!==version.current)return;
      if(!rideMatrixReady(ready,matrix)){setLegs([]);setChecked(false);setMessage('Some journeys couldn’t be checked. Try again or use Maps below.');return;}
      setLegs(matrix);setChecked(true);setMessage('');
    }
    catch(cause){
      if(current!==version.current)return;
      setLegs([]);setChecked(false);
      const text=cause instanceof Error?cause.message:'';
      setMessage(/limit|quota/i.test(text)?text:'Some journeys couldn’t be checked. Try again or use Maps below.');
    }
    finally{if(current===version.current)setBusy(false);}
  };
  const checkFriends = async () => {
    setCheckingFriends(true);
    try { await refresh(); }
    finally { setCheckingFriends(false); }
  };
  const open=async(group:ActualRide)=>{if(!pickup)return;try{await Linking.openURL(directions(pickup,group.dropOrder.at(-1)!.location!,'driving',group.dropOrder.slice(0,-1).map((person)=>person.location!)));}catch{setMessage('Could not open Maps. Please retry.');}};
  const kicker=<Text style={{fontSize:11,letterSpacing:1.5,color:colors.muted,fontWeight:'800'}}>GOT SPACE?</Text>;
  const title=<Text style={[styles.title,{letterSpacing:-1}]}>Share the Grab.</Text>;
  if(!people.length)return <View style={styles.wrap}><GoogleVenueStatus place={plan?.chosenVenue}/>{kicker}{title}{plan?<HomeLocationEditor key={plan.code+plan.remote?.participantId} plan={plan}/>:null}<Card><Text style={styles.copy}>Friends sharing a car show up here. Add them in Meet, or switch train-only friends over. You don’t need a meetup pin.</Text><Button secondary label="Open Meet" onPress={()=>go('meet')}/></Card></View>;
  const missingHomes=roster.waiting;
  const ownId=plan?.remote?.participantId??(!plan?.remote&&people.length===1?people[0]?.id:undefined);
  return <View style={styles.wrap}>
    <GoogleVenueStatus place={plan?.chosenVenue}/>
    {kicker}{title}
    {meetupChosen&&pickup?<Text style={styles.copy}>Pickup · {plan?.chosenVenue?.name}</Text>:meetupChosen?<Text style={styles.copy}>Pickup follows {plan?.chosenVenue?.name} once its pin is ready.</Text>:<Text style={styles.copy}>Already together. Set pickup here — drop-offs are still home. No Meet pin needed.</Text>}
    {!meetupChosen&&plan&&pickupReady?<PickupLocationEditor key={plan.code} value={customPickup} onChange={choosePickup}/>:null}
    {pickupError?<Text accessibilityRole="alert" style={styles.message}>{pickupError}</Text>:null}
    {plan?<HomeLocationEditor key={plan.code+plan.remote?.participantId} plan={plan}/>:null}
    {error?<Text style={styles.message}>{error}</Text>:null}
    {error||missingHomes.length?<Button secondary label={checkingFriends?'Checking friends…':'Check friends’ updates'} onPress={!checkingFriends?()=>void checkFriends():undefined}/>:null}
    <Button label={busy?'Finding your groups…':'Find ride partners'} onPress={!busy&&Boolean(pickup)&&roster.ready.length?()=>void check():undefined}/>
    {missingHomes.length?<View style={{gap:8}}><Text style={styles.message}>Add a home location for {missingHomes.map(p=>p.name).join(', ')}. Matching still includes everyone who already has one.</Text>{missingHomes.some((person)=>person.id!==ownId)?<Button secondary label="Set homes in Meet" onPress={()=>go('meet')}/>:null}</View>:null}
    {message?<Text accessibilityRole="alert" style={styles.message}>{message}</Text>:null}
    {!pickupReady&&!meetupChosen?<Text style={styles.copy}>Loading your pickup…</Text>:!pickup?<Text style={styles.copy}>{meetupChosen?'Waiting for the meetup pin before ride groups can be checked.':'Set a pickup above to find ride partners.'}</Text>:!checked?<Text style={styles.copy}>Find friends going your way, then split one fare. One person still gets a solo ride.</Text>:null}
    {fareError?<><Text accessibilityRole="alert" style={styles.message}>{fareError}</Text><Button label="Retry loading fare" secondary onPress={()=>setFareAttempt((value)=>value+1)}/></>:null}
    {fareSaveError?<><Text accessibilityRole="alert" style={styles.message}>Your fare hasn’t saved. Keep this page open and retry.</Text><Button label="Retry saving fare" secondary onPress={()=>void saveRideFares(storageKey,fares).then(()=>setFareSaveError(false)).catch(()=>setFareSaveError(true))}/></>:null}
    {slow?<Text accessibilityRole="alert" style={styles.message}>Taking a little longer. You can use Maps while we check.</Text>:null}
    {slow ? people.filter((person)=>validLocation(person.location)).map((person)=><Button key={person.id} secondary label={`Google Maps: ${person.name} ↗`} onPress={()=>void open({id:person.id,riders:[person],dropOrder:[person],seconds:null,extraSeconds:null,detours:{},complete:false})}/>):null}
    {checked&&pickup?groups.map((group,index)=>{
      const shares=splitEnteredFare(fares[group.id]??'',group.riders.map((person)=>person.id));
      return <Card key={group.id}><Text style={styles.label}>{group.riders.length>1?`CAR ${index+1} · ${group.riders.length} PEOPLE`:'RIDING SOLO'}</Text><Text style={styles.heading}>{group.riders.map((person)=>person.name).join(' + ')}</Text><Text style={styles.copy}>{group.seconds===null?'Journey unavailable · check Maps':`About ${Math.ceil(group.seconds/60)} min${group.riders.length>1&&group.extraSeconds!==null?` · up to ${Math.ceil(group.extraSeconds/60)} min extra each`:''}`}</Text>
        <View style={{gap:6,padding:12,borderRadius:12,backgroundColor:colors.paper}}><Text style={{fontSize:12,fontWeight:'800',color:colors.muted}}>DROP-OFF ORDER</Text>{group.dropOrder.map((person,index)=><Text key={person.id} style={styles.copy}>{index+1}. {person.name} · {person.location?.label}{group.detours[person.id]!==undefined?` · ${Math.ceil(group.detours[person.id]!/60)} min extra`:''}</Text>)}
        
        </View>
        <RideHandoff from={pickup} stops={group.dropOrder.map(p=>p.location!)}/>
        <Text style={styles.label}>TOTAL RIDE FARE · S$</Text><TextInput editable={!busy && loaded && fareKey===storageKey} accessibilityLabel={`Fare for ${group.riders.map((person)=>person.name).join(' and ')}`} style={styles.input} keyboardType="decimal-pad" placeholder="e.g. 24.00" value={fares[group.id]??''} onChangeText={(value)=>{const next={...fares,[group.id]:value};setFares(next);void saveRideFares(storageKey,next).then(()=>setFareSaveError(false)).catch(()=>setFareSaveError(true));}}/>
        {shares?group.riders.map((person)=><View key={person.id} style={{flexDirection:'row',justifyContent:'space-between',gap:12,paddingVertical:8}}><Text style={{flex:1,color:colors.ink}}>{person.name}</Text><Text style={{fontSize:20,fontWeight:'900',color:colors.green}}>S${formatCents(shares[person.id]!)}</Text></View>):<Text style={styles.copy}>Enter the fare from your ride app to see everyone’s share.</Text>}
        <Text style={styles.note}>Saved on this device only · separate from food</Text>
      </Card>;
    }):null}
    {checked?<Text style={styles.note}>Suggested groups · up to 4 per car · maximum 15 min extra each. OneMap driving estimates, not live traffic.</Text>:null}
  </View>;
}
const styles=StyleSheet.create({wrap:{gap:14},title:{fontSize:30,fontWeight:'900',color:colors.ink},heading:{fontSize:20,fontWeight:'800',color:colors.ink},copy:{color:colors.muted,lineHeight:20,marginVertical:8},label:{fontSize:11,color:colors.green,fontWeight:'800',marginTop:16},input:{padding:12,borderWidth:1,borderColor:colors.line,borderRadius:12,marginVertical:10,color:colors.ink},message:{padding:12,borderRadius:12,backgroundColor:colors.coralSoft,color:colors.ink},note:{color:colors.muted,fontSize:11,marginTop:12}});

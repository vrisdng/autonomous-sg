import { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { retainLastCall } from './src/features/train/lastCallSession';
import { PartyAccess } from './src/components/PartyAccess';
import { BaoPeek } from './src/components/BaoPeek';
import { LiveTop3Dock } from './src/components/LiveTop3';
import { peekSideFromSearch, tabHasInlineBao } from './src/components/baoPeek';
import { BottomNav } from './src/components/BottomNav';
import { ScreenTransition } from './src/components/ScreenTransition';
import { HomeScreen } from './src/screens/HomeScreen';
import { MeetScreen } from './src/screens/MeetScreen';
import { RideScreen } from './src/screens/RideScreen';
import { SplitScreen } from './src/screens/SplitScreen';
import { TrainScreen } from './src/screens/TrainScreen';
import { colors } from './src/theme';
import { getPlanCodeFromUrl } from './src/features/plans/links';
import { Tab } from './src/types';

const tabFromUrl=():Tab=>{
  const value=typeof window!=='undefined'?window.location.hash.slice(1):'';
  return ['home','meet','split','ride','train'].includes(value)?value as Tab:'home';
};

export default function App() {
  const [tab, setTab] = useState<Tab>(tabFromUrl);
  const scope=useRef(typeof window!=='undefined'&&typeof window.history.state?.bojioScope==='string'?window.history.state.bojioScope:Math.random().toString(36).slice(2));
  const scroll=useRef<ScrollView>(null);
  const writeRoute=(next:Tab,replace=false)=>{
    if(typeof window!=='undefined'){
      const url=new URL(window.location.href);url.hash=next;
      // The outing sheet keeps its own history entry. Tab changes must not copy that flag forward.
      const {bojioSheet:_sheet,...rest}=window.history.state??{};
      const state={...rest,bojioScope:scope.current};
      if(replace)window.history.replaceState(state,'',url);else if(url.href!==window.location.href)window.history.pushState(state,'',url);
    }
    setTab(next);scroll.current?.scrollTo({y:0,animated:false});
  };
  const [incomingPlanCode, setIncomingPlanCode] = useState<string | undefined>(()=>typeof window!=='undefined'?getPlanCodeFromUrl(window.location.href)??undefined:undefined);
  const [partyOpen,setPartyOpen]=useState(()=>Boolean(typeof window!=='undefined'&&getPlanCodeFromUrl(window.location.href)));
  const [entryVersion,setEntryVersion]=useState(0);
  const openParty=(code?:string)=>{setIncomingPlanCode(code);setPartyOpen(true);};
  const closeParty=()=>{setIncomingPlanCode(undefined);setPartyOpen(false);if(typeof window!=='undefined'&&getPlanCodeFromUrl(window.location.href))window.history.replaceState({...window.history.state,bojioScope:scope.current},'','/#'+tab);};

  useEffect(()=>{
    if(typeof window==='undefined')return;
    window.history.replaceState({...window.history.state,bojioScope:scope.current},'',window.location.href);
    const back=()=>{
      const code=getPlanCodeFromUrl(window.location.href);
      setIncomingPlanCode(code??undefined);
      // Only invite links open the identity gate. Ordinary tab history must keep
      // the current party mounted instead of unexpectedly dumping people here.
      setPartyOpen(!!code);
      setTab(tabFromUrl());scroll.current?.scrollTo({y:0,animated:false});
    };
    window.addEventListener('popstate',back);
    return()=>window.removeEventListener('popstate',back);
  },[]);

  useEffect(() => {
    const openPlanUrl = (url: string | null) => {
      if (!url) return;
      const code = getPlanCodeFromUrl(url);
      if (code) {
        openParty(code);
        setTab('meet');
      }
    };
    Linking.getInitialURL().then(openPlanUrl).catch(() => undefined);
    const subscription = Linking.addEventListener('url', ({ url }) => openPlanUrl(url));
    return () => subscription.remove();
  }, []);

  const [lastCallKeep, setLastCallKeep] = useState(() => ({ epoch: entryVersion, alive: tab === 'train' }));
  const keep = retainLastCall(lastCallKeep.alive, lastCallKeep.epoch, tab, entryVersion);
  if (keep.alive !== lastCallKeep.alive || keep.epoch !== lastCallKeep.epoch) setLastCallKeep(keep);
  const screen = tab === 'home' ? <HomeScreen go={writeRoute} onParty={() => openParty()} />
    : tab === 'meet' ? <MeetScreen go={writeRoute} onOpenParty={openParty} />
    : tab === 'split' ? <SplitScreen go={writeRoute} />
    : tab === 'ride' ? <RideScreen go={writeRoute} />
    : null;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.brand}><Text style={styles.wordmark}>Bojio<Text style={styles.q}>?</Text></Text><Pressable accessibilityRole="button" accessibilityLabel="Party · create, join or invite" onPress={()=>openParty()} style={{padding:12,borderRadius:24,backgroundColor:colors.lime}}><Text style={{fontWeight:'800',color:colors.ink}}>Party · Invite ↗</Text></Pressable></View>
      <View style={styles.stage}>
        <ScrollView ref={scroll} style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {!partyOpen && !incomingPlanCode ? <>
            {/* Last Call stays mounted after the first visit so the countdown is not wiped on every tap. */}
            <View key={keep.epoch} style={tab === 'train' ? styles.liveTab : styles.parkedTab} accessibilityElementsHidden={tab !== 'train'} importantForAccessibility={tab === 'train' ? 'auto' : 'no-hide-descendants'}>
              {keep.alive ? <TrainScreen go={writeRoute} /> : null}
            </View>
            {screen ? <ScreenTransition key={entryVersion + ':' + tab}>{screen}</ScreenTransition> : null}
          </> : null}
        </ScrollView>
        {!partyOpen && !incomingPlanCode && !tabHasInlineBao(tab) ? <BaoPeek key={entryVersion+':'+tab} side={peekSideFromSearch()} /> : null}
        <LiveTop3Dock />
      </View>
      <BottomNav active={tab} onChange={next=>writeRoute(next)} />
      {partyOpen||incomingPlanCode?<PartyAccess key={incomingPlanCode??'party'} code={incomingPlanCode} onClose={closeParty} onEntered={()=>{const destination=incomingPlanCode?'meet':tab;scope.current=Math.random().toString(36).slice(2);closeParty();setEntryVersion(v=>v+1);writeRoute(destination,true);}}/>:null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  brand: { paddingHorizontal: 24, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',width:'100%',maxWidth:720,alignSelf:'center' },
  wordmark: { color: colors.ink, fontWeight: '900', fontSize: 24, letterSpacing: -1 }, q: { color: colors.coral }, sg: { backgroundColor: colors.lime, color: colors.ink, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, fontWeight: '900', fontSize: 11 },
  stage: { flex: 1, position: 'relative', overflow: 'hidden' },
  liveTab: { display: 'flex', pointerEvents: 'auto' },
  parkedTab: { display: 'none', pointerEvents: 'none' },
  scroll: { flex: 1 }, content: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 32, width: '100%', maxWidth: 720, alignSelf: 'center' },
});

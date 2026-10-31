import { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { retainLastCall } from './src/features/train/lastCallSession';
import { PartyAccess } from './src/components/PartyAccess';
import { BaoPeek } from './src/components/BaoPeek';
import { LiveTop3Dock } from './src/components/LiveTop3';
import { peekSideFromSearch, tabHasInlineBao } from './src/components/baoPeekLogic';
import { BottomNav } from './src/components/BottomNav';
import { ScreenTransition } from './src/components/ScreenTransition';
import { HomeScreen } from './src/screens/HomeScreen';
import { DiscoveryScreen } from './src/screens/DiscoveryScreen';
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
type Section = 'discover' | 'bojio';
const sectionFromUrl=():Section=>{
  if(typeof window==='undefined')return 'bojio';
  return !window.location.hash || window.location.hash==='#discover' ? 'discover' : 'bojio';
};

export default function App() {
  const [tab, setTab] = useState<Tab>(tabFromUrl);
  const [section,setSection]=useState<Section>(()=>typeof window!=='undefined'&&getPlanCodeFromUrl(window.location.href)?'bojio':sectionFromUrl());
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
    setSection('bojio');
    setTab(next);scroll.current?.scrollTo({y:0,animated:false});
  };
  const openDiscover=()=>{
    if(typeof window!=='undefined'){
      const url=new URL(window.location.href);url.hash='discover';
      const {bojioSheet:_sheet,...rest}=window.history.state??{};
      if(url.href!==window.location.href)window.history.pushState({...rest,bojioScope:scope.current},'',url);
    }
    setSection('discover');scroll.current?.scrollTo({y:0,animated:false});
  };
  const [incomingPlanCode, setIncomingPlanCode] = useState<string | undefined>(()=>typeof window!=='undefined'?getPlanCodeFromUrl(window.location.href)??undefined:undefined);
  const [partyOpen,setPartyOpen]=useState(()=>Boolean(typeof window!=='undefined'&&getPlanCodeFromUrl(window.location.href)));
  const [entryVersion,setEntryVersion]=useState(0);
  const openParty=(code?:string)=>{setIncomingPlanCode(code);setPartyOpen(true);};
  const openPartyFromDiscover=()=>{writeRoute('meet');openParty();};
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
      setSection(code?'bojio':sectionFromUrl());
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
        setSection('bojio');
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
    <SafeAreaView style={[styles.safe,section==='discover'&&styles.discoverSafe]}>
      <StatusBar barStyle="dark-content" />
      {section==='discover'?<>
        <View style={styles.discoverHeader}><Text style={styles.discoverLogo}>Apple67</Text></View>
        <View style={styles.discoverSectionBar}>
          <View style={styles.discoverBarSpacer}/>
          <View style={styles.discoverTabs}>
            <Pressable accessibilityRole="button" accessibilityLabel="Discover homepage" accessibilityState={{selected:true}} onPress={openDiscover} style={[styles.discoverTab,styles.discoverTabActive]}><Text style={styles.discoverTabActiveText}>For You</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Apple67 app" onPress={()=>writeRoute(tab)} style={styles.discoverTab}><Text style={styles.discoverTabText}>Apple67</Text></Pressable>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Search restaurants in Apple67" onPress={()=>writeRoute('meet')} style={styles.discoverSearch}><Text style={styles.searchGlyph}>⌕</Text></Pressable>
        </View>
      </>:<>
        <View style={styles.brand}><Text style={styles.wordmark}>Apple<Text style={styles.q}>67</Text></Text><Pressable accessibilityRole="button" accessibilityLabel="Party · create, join or invite" onPress={()=>openParty()} style={{padding:12,borderRadius:24,backgroundColor:colors.lime}}><Text style={{fontWeight:'800',color:colors.ink}}>Party · Invite ↗</Text></Pressable></View>
        <View style={styles.sectionBar}>
          <Pressable accessibilityRole="button" accessibilityLabel="Discover homepage" onPress={openDiscover} style={styles.sectionTab}><Text style={styles.sectionTabText}>✦ Discover</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Apple67 app" accessibilityState={{selected:true}} onPress={()=>writeRoute(tab)} style={[styles.sectionTab,styles.sectionTabActive]}><Text style={[styles.sectionTabText,styles.sectionTabTextActive]}>Apple67</Text></Pressable>
        </View>
      </>}
      <View style={[styles.stage,section==='discover'&&styles.discoverStage]}>
        <ScrollView ref={scroll} style={styles.scroll} contentContainerStyle={[styles.content,section==='discover'&&styles.discoverContent]} keyboardShouldPersistTaps="handled">
          {section==='discover'&&!partyOpen&&!incomingPlanCode?<DiscoveryScreen go={writeRoute} onParty={openPartyFromDiscover}/>:null}
          {section==='bojio'&&!partyOpen && !incomingPlanCode ? <>
            {/* Last Call stays mounted after the first visit so the countdown is not wiped on every tap. */}
            <View key={keep.epoch} style={tab === 'train' ? styles.liveTab : styles.parkedTab} accessibilityElementsHidden={tab !== 'train'} importantForAccessibility={tab === 'train' ? 'auto' : 'no-hide-descendants'}>
              {keep.alive ? <TrainScreen go={writeRoute} /> : null}
            </View>
            {screen ? <ScreenTransition key={entryVersion + ':' + tab}>{screen}</ScreenTransition> : null}
          </> : null}
        </ScrollView>
        {section==='bojio'&&!partyOpen && !incomingPlanCode && !tabHasInlineBao(tab) ? <BaoPeek key={entryVersion+':'+tab} side={peekSideFromSearch()} /> : null}
        {section==='bojio'?<LiveTop3Dock />:null}
      </View>
      {section==='bojio'?<BottomNav active={tab} onChange={next=>writeRoute(next)} />:null}
      {partyOpen||incomingPlanCode?<PartyAccess key={incomingPlanCode??'party'} code={incomingPlanCode} onClose={closeParty} onEntered={()=>{const destination=incomingPlanCode?'meet':tab;scope.current=Math.random().toString(36).slice(2);closeParty();setEntryVersion(v=>v+1);writeRoute(destination,true);}}/>:null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  discoverSafe:{backgroundColor:'#FFFFFF'},
  brand: { paddingHorizontal: 24, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',width:'100%',maxWidth:720,alignSelf:'center' },
  wordmark: { color: colors.ink, fontWeight: '900', fontSize: 24, letterSpacing: -1 }, q: { color: colors.coral }, sg: { backgroundColor: colors.lime, color: colors.ink, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, fontWeight: '900', fontSize: 11 },
  discoverHeader:{width:'100%',maxWidth:720,alignSelf:'center',height:52,alignItems:'center',justifyContent:'center'},
  discoverLogo:{backgroundColor:'#FFE900',color:'#111111',fontSize:16,fontWeight:'900',fontStyle:'italic',paddingHorizontal:12,paddingVertical:4,borderRadius:99,overflow:'hidden',letterSpacing:-0.9},
  discoverSectionBar:{width:'100%',maxWidth:720,alignSelf:'center',height:54,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:1,borderBottomColor:'#E8E8E8',paddingHorizontal:12},
  discoverBarSpacer:{width:42},discoverTabs:{flexDirection:'row',height:'100%',gap:24},
  discoverTab:{height:'100%',paddingHorizontal:4,alignItems:'center',justifyContent:'center'},
  discoverTabActive:{borderBottomWidth:3,borderBottomColor:'#111111'},
  discoverTabText:{color:'#777777',fontSize:17,fontWeight:'600'},discoverTabActiveText:{color:'#111111',fontSize:17,fontWeight:'900'},
  discoverSearch:{width:42,alignItems:'center',justifyContent:'center'},searchGlyph:{color:'#111111',fontSize:33,lineHeight:36},
  sectionBar:{width:'100%',maxWidth:720,alignSelf:'center',paddingHorizontal:24,flexDirection:'row',gap:8,paddingBottom:10},
  sectionTab:{paddingHorizontal:18,paddingVertical:10,borderRadius:99,backgroundColor:colors.card,borderWidth:1,borderColor:colors.line},
  sectionTabActive:{backgroundColor:colors.ink,borderColor:colors.ink},
  sectionTabText:{color:colors.muted,fontSize:13,fontWeight:'800'},sectionTabTextActive:{color:'#FFFFFF'},
  stage: { flex: 1, position: 'relative', overflow: 'hidden' },
  discoverStage:{backgroundColor:'#FFFFFF'},
  liveTab: { display: 'flex', pointerEvents: 'auto' },
  parkedTab: { display: 'none', pointerEvents: 'none' },
  scroll: { flex: 1 }, content: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 32, width: '100%', maxWidth: 720, alignSelf: 'center' },
  discoverContent:{paddingHorizontal:10,paddingTop:5},
});

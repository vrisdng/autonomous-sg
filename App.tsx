import { useEffect, useRef, useState } from 'react';
import { Image, Linking, Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { retainLastCall } from './src/features/train/lastCallSession';
import { PartyAccess } from './src/components/PartyAccess';
import { DropNotice, DropNoticeState, PostDragGhost, usePostDrag } from './src/components/PostDrag';
import { BaoFeatureMenu, FeedPartyStrip } from './src/components/BaoFeatureMenu';
import { BaoPeek } from './src/components/BaoPeek';
import { peekSideFromSearch, tabHasInlineBao } from './src/components/baoPeekLogic';
import { BottomNav } from './src/components/BottomNav';
import { LiveTop3Dock } from './src/components/LiveTop3';
import { DiscoveryNav, FeedView } from './src/components/DiscoveryNav';
import { ScreenTransition } from './src/components/ScreenTransition';
import { HomeScreen } from './src/screens/HomeScreen';
import { DiscoveryScreen, Post } from './src/screens/DiscoveryScreen';
import { CreatePostScreen } from './src/screens/CreatePostScreen';
import { MeetScreen } from './src/screens/MeetScreen';
import { RideScreen } from './src/screens/RideScreen';
import { SplitScreen } from './src/screens/SplitScreen';
import { TrainScreen } from './src/screens/TrainScreen';
import { colors } from './src/theme';
import { loadPlanDraft } from './src/data/planDraft';
import { verifiedVenues } from './src/data/venues';
import { variedVenues } from './src/features/meet/discovery';
import { activeParty } from './src/features/plans/friends';
import { getPlanCodeFromUrl } from './src/features/plans/links';
import { addToDeck } from './src/hooks/useSwipes';
import { PlanDraft, Tab } from './src/types';

const knownTabs: Tab[] = ['home', 'meet', 'split', 'ride', 'train'];
const tabFromUrl = (): Tab => {
  const value = typeof window === 'undefined' ? '' : window.location.hash.slice(1);
  return knownTabs.includes(value as Tab) ? value as Tab : 'home';
};
const legacyTabOpen = () => typeof window !== 'undefined' && knownTabs.includes(window.location.hash.slice(1) as Tab);

export default function App() {
  const [feedView, setFeedView] = useState<FeedView>('home');
  const [tab, setTab] = useState<Tab>(tabFromUrl);
  const [bojioOpen, setBojioOpen] = useState(legacyTabOpen);
  const [baoOpen, setBaoOpen] = useState(false);
  const [baoAnchor, setBaoAnchor] = useState<{ x: number; y: number }>();
  const [openPost, setOpenPost] = useState<Post>();
  // The post this outing started from. Session-only: it is feed context, not party data.
  const [jioPost, setJioPost] = useState<Post>();
  const [incomingPlanCode, setIncomingPlanCode] = useState<string | undefined>(() => typeof window !== 'undefined' ? getPlanCodeFromUrl(window.location.href) ?? undefined : undefined);
  const [partyOpen, setPartyOpen] = useState(() => typeof window !== 'undefined' && !!getPlanCodeFromUrl(window.location.href));
  const [partyStart, setPartyStart] = useState<'create' | 'invite'>();
  const [entryVersion, setEntryVersion] = useState(0);
  const [dropNotice, setDropNotice] = useState<DropNoticeState>();
  const baoCenter = useRef<{ x: number; y: number } | undefined>(undefined);
  const feedScroll = useRef<ScrollView>(null);
  const popupScroll = useRef<ScrollView>(null);

  const openFeed = (view: FeedView) => {
    setBojioOpen(false);
    setFeedView(view);
    feedScroll.current?.scrollTo({ y: 0, animated: false });
    if (typeof window !== 'undefined' && legacyTabOpen()) {
      const url = new URL(window.location.href);
      url.hash = 'discover';
      window.history.replaceState(window.history.state, '', url);
    }
  };
  const openDiscover = () => openFeed('home');
  const openBaoMenu = (center: { x: number; y: number }) => { setBaoAnchor(center); setBaoOpen(true); };
  // Feature navigation stays inside one popup. Only invite links use URLs.
  const openBojio = (next: Tab) => {
    setBaoOpen(false);
    setTab(next);
    setBojioOpen(true);
    popupScroll.current?.scrollTo({ y: 0, animated: false });
  };
  const closeBojio = () => {
    setBojioOpen(false);
    if (typeof window !== 'undefined' && legacyTabOpen()) {
      const url = new URL(window.location.href);
      url.hash = 'discover';
      window.history.replaceState(window.history.state, '', url);
    }
  };
  const openParty = (code?: string, start?: 'create' | 'invite') => { if (code) setJioPost(undefined); setIncomingPlanCode(code); setPartyStart(start); setPartyOpen(true); };
  const jioFromPost = (post: Post) => { setOpenPost(undefined); setJioPost(post); openParty(); };
  const tripHomeFromPost = (post: Post) => { setOpenPost(undefined); setJioPost(post); openBojio('train'); };
  const backToPost = () => { closeBojio(); setOpenPost(jioPost); };
  const addToParty = async (post: Post, party: PlanDraft) => {
    const name = post.place!.name;
    setDropNotice({ text: `Adding ${name}…` });
    try {
      const added = await addToDeck(party, post.place!, variedVenues(verifiedVenues));
      setDropNotice({ text: added ? `Added ${name} to the swipe` : `${name} is already in the swipe`, view: true });
    } catch (error) {
      setDropNotice({ text: error instanceof Error ? error.message : 'Could not add it. Retry when connected.' });
    }
  };
  const addToSwipe = async (post: Post) => {
    setOpenPost(undefined);
    if (!post.place) { setDropNotice({ text: 'This post has no restaurant to add.' }); return; }
    const party = activeParty(await loadPlanDraft());
    // No party yet: make one first. Entering it adds this post.
    if (party) await addToParty(post, party); else jioFromPost(post);
  };
  const drag = usePostDrag(baoCenter, post => void addToSwipe(post));
  const partyEntered = async () => {
    closeParty();
    const party = activeParty(await loadPlanDraft());
    // Before Meet opens, so the deck it loads already has this card.
    if (jioPost?.place && party) await addToParty(jioPost, party);
    setEntryVersion(version => version + 1);
    openBojio('meet');
  };
  const closeParty = () => {
    setIncomingPlanCode(undefined);
    setPartyOpen(false);
    if (typeof window !== 'undefined' && getPlanCodeFromUrl(window.location.href)) {
      const url = new URL(window.location.href);
      url.searchParams.delete('plan');
      if (url.pathname.toLowerCase().includes('/plan/')) url.pathname = '/';
      url.hash = 'discover';
      window.history.replaceState(window.history.state, '', url);
    }
  };
  // Backing out of a post's jio returns to that post, not the top of the feed.
  const cancelParty = () => {
    closeParty();
    if (jioPost && !bojioOpen) { setOpenPost(jioPost); setJioPost(undefined); }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onBack = () => {
      const code = getPlanCodeFromUrl(window.location.href);
      if (code) openParty(code);
      else if (legacyTabOpen()) { setTab(tabFromUrl()); setBojioOpen(true); }
      else { setBojioOpen(false); }
    };
    window.addEventListener('popstate', onBack);
    return () => window.removeEventListener('popstate', onBack);
  }, []);

  useEffect(() => {
    const openPlanUrl = (url: string | null) => {
      if (!url) return;
      const code = getPlanCodeFromUrl(url);
      if (code) openParty(code);
    };
    Linking.getInitialURL().then(openPlanUrl).catch(() => undefined);
    const subscription = Linking.addEventListener('url', ({ url }) => openPlanUrl(url));
    return () => subscription.remove();
  }, []);

  const [lastCallKeep, setLastCallKeep] = useState(() => ({ epoch: entryVersion, alive: tab === 'train' }));
  const keep = retainLastCall(lastCallKeep.alive, lastCallKeep.epoch, tab, entryVersion);
  if (keep.alive !== lastCallKeep.alive || keep.epoch !== lastCallKeep.epoch) setLastCallKeep(keep);
  const screen = tab === 'home' ? <HomeScreen go={openBojio} onParty={() => openParty()} />
    : tab === 'meet' ? <MeetScreen go={openBojio} onOpenParty={openParty} fromPost={jioPost?.title} />
    : tab === 'split' ? <SplitScreen go={openBojio} />
    : tab === 'ride' ? <RideScreen go={openBojio} />
    : null;
  const composing = feedView === 'compose' && !bojioOpen;

  return <SafeAreaView style={[styles.safe, composing && styles.composeSafe]}>
    <StatusBar barStyle={composing ? 'light-content' : 'dark-content'} />
    <>
      <View style={styles.brand}><Text style={styles.logo}>Apple67</Text></View>
      <View style={styles.feedHeader}><Text style={styles.feedTitle}>{feedView === 'home' ? 'For You' : feedView === 'search' ? 'Search' : feedView === 'activity' ? 'Activity' : 'Profile'}</Text></View>
      {feedView === 'home' ? <FeedPartyStrip onOpen={() => openBojio('meet')} /> : null}
      <View style={styles.feedStage}>
        <ScrollView ref={feedScroll} scrollEnabled={!drag.post} style={styles.feedScroll} contentContainerStyle={styles.feedContent} keyboardShouldPersistTaps="handled">
          <DiscoveryScreen view={feedView as Exclude<FeedView, 'compose'>} selected={openPost} drag={drag.controls} onSelect={setOpenPost} onJio={jioFromPost} onAddToSwipe={post => void addToSwipe(post)} onTripHome={tripHomeFromPost} />
        </ScrollView>
        {/* Edge-peek Bao on the feed. A tap opens the Bao menu; a dragged post dropped on Bao joins the swipe. */}
        {!composing && !bojioOpen && !partyOpen && !incomingPlanCode ? <BaoPeek side={peekSideFromSearch()} onTap={openBaoMenu} dropTargetRef={baoCenter} dropping={!!drag.post} over={drag.over} /> : null}
      </View>
      <DiscoveryNav active={feedView} onChange={openFeed} />
    </>
    {/* Compose covers the feed instead of replacing it, so likes and saves survive. */}
    {composing ? <View style={styles.compose}><CreatePostScreen onClose={openDiscover} /></View> : null}
    <PostDragGhost post={drag.post} point={drag.point} />

    {bojioOpen ? <View style={styles.popup} accessibilityViewIsModal>
      <Pressable accessibilityRole="button" accessibilityLabel="Close Bojio" onPress={closeBojio} style={styles.scrim} />
      <View style={styles.popupPanel}>
        <View style={styles.popupHeader}><Text style={styles.popupTitle}>Bojio · {tab === 'home' ? 'Your plan' : tab === 'meet' ? 'Meet' : tab === 'split' ? 'Split' : tab === 'ride' ? 'Share ride' : 'Last Call'}</Text><Pressable accessibilityRole="button" accessibilityLabel="Close Bojio and return to For You" onPress={closeBojio} style={styles.close}><Text style={styles.closeText}>×</Text></Pressable></View>
        {jioPost ? <Pressable accessibilityRole="button" accessibilityLabel={`Back to post: ${jioPost.title}`} onPress={backToPost} style={styles.origin}>{jioPost.image ? <Image source={jioPost.image} accessibilityLabel="Illustrative food photo" resizeMode="cover" style={styles.originPhoto} /> : <View style={[styles.originPhoto, { backgroundColor: jioPost.tint }]} />}<Text numberOfLines={1} style={styles.originTitle}>{jioPost.title}</Text><Text style={styles.originAction}>View post ›</Text></Pressable> : null}
        <View style={styles.popupStage}>
          <ScrollView ref={popupScroll} style={styles.popupScroll} contentContainerStyle={styles.popupContent} keyboardShouldPersistTaps="handled">
            <View key={keep.epoch} style={tab === 'train' ? styles.liveTab : styles.parkedTab} accessibilityElementsHidden={tab !== 'train'} importantForAccessibility={tab === 'train' ? 'auto' : 'no-hide-descendants'}>
              {keep.alive ? <TrainScreen go={openBojio} /> : null}
            </View>
            {screen ? <ScreenTransition key={entryVersion + ':' + tab}>{screen}</ScreenTransition> : null}
          </ScrollView>
          <LiveTop3Dock />
          {!partyOpen && !incomingPlanCode && !tabHasInlineBao(tab) ? <BaoPeek key={entryVersion + ':' + tab} side={peekSideFromSearch()} onTap={tab === 'meet' ? openBaoMenu : undefined} /> : null}
        </View>
        {tab !== 'meet' ? <BottomNav active={tab} onChange={openBojio} /> : null}
      </View>
    </View> : null}

    <BaoFeatureMenu visible={baoOpen} anchor={baoAnchor} onClose={() => setBaoOpen(false)} onNavigate={openBojio} onCreateParty={() => { setJioPost(undefined); openParty(undefined, 'create'); }} onInvite={() => { setJioPost(undefined); openParty(undefined, 'invite'); }} />
    {partyOpen || incomingPlanCode ? <PartyAccess key={incomingPlanCode ?? 'party'} code={incomingPlanCode} start={partyStart} fromPost={jioPost?.title} onClose={cancelParty} onEntered={() => void partyEntered()} /> : null}
    <DropNotice notice={dropNotice} onDone={() => setDropNotice(undefined)} onView={() => { setDropNotice(undefined); openBojio('meet'); }} />
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, position: 'relative', backgroundColor: '#FFFFFF' },
  composeSafe: { backgroundColor: '#050505' },
  compose: { ...StyleSheet.absoluteFillObject, zIndex: 75, backgroundColor: '#050505' },
  brand: { width: '100%', maxWidth: 720, alignSelf: 'center', height: 52, alignItems: 'center', justifyContent: 'center' },
  logo: { backgroundColor: '#FFE900', color: '#111111', fontSize: 16, fontWeight: '900', fontStyle: 'italic', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 99, overflow: 'hidden' },
  feedHeader: { width: '100%', maxWidth: 720, alignSelf: 'center', height: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: '#E8E8E8', paddingHorizontal: 12 },
  feedTitle: { color: '#111111', fontSize: 18, fontWeight: '900' },
  feedStage: { flex: 1, position: 'relative', overflow: 'hidden' },
  feedScroll: { flex: 1 }, feedContent: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: 10, paddingTop: 5, paddingBottom: 32 },
  popup: { ...StyleSheet.absoluteFillObject, zIndex: 80, alignItems: 'center', justifyContent: 'center', elevation: 10 },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: '#00000099' },
  popupPanel: { width: '96%', height: '94%', maxWidth: 720, borderRadius: 22, overflow: 'hidden', backgroundColor: colors.paper },
  popupHeader: { minHeight: 58, backgroundColor: colors.paper, borderBottomWidth: 1, borderBottomColor: colors.line, paddingLeft: 18, paddingRight: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  popupTitle: { color: colors.ink, fontSize: 19, fontWeight: '900' },
  close: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' }, closeText: { color: colors.ink, fontSize: 30 },
  origin: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFF9C2', paddingHorizontal: 14, paddingVertical: 6 },
  originPhoto: { width: 34, height: 34, borderRadius: 8, backgroundColor: '#EEEEEE' }, originTitle: { flex: 1, color: '#161616', fontSize: 13, fontWeight: '700' }, originAction: { color: '#111111', fontSize: 12, fontWeight: '800' },
  popupStage: { flex: 1, position: 'relative', overflow: 'hidden' },
  popupScroll: { flex: 1 }, popupContent: { width: '100%', paddingHorizontal: 18, paddingTop: 16, paddingBottom: 32 },
  liveTab: { display: 'flex', pointerEvents: 'auto' }, parkedTab: { display: 'none', pointerEvents: 'none' },
});

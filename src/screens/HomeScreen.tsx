import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BaoAskPanel } from '../components/BaoAsk';
import { baoAskPanel } from '../components/baoPeek';
import { Button, Card, Pill } from '../components/Ui';
import { loadPlanDraft } from '../data/planDraft';
import { colors } from '../theme';
import { PlanDraft, Tab } from '../types';
import { useOuting } from '../hooks/useOuting';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { GoogleVenueStatus } from '../components/GoogleVenueStatus';
import { SupperKaki } from '../components/SupperKaki';

const homeLines = [
  { title: 'Still outside?', subtitle: 'Home can wait. The stall cannot.' },
  { title: 'Boh liao?', subtitle: 'Then jio. We’re eating.' },
  { title: 'Where to, lah?', subtitle: 'Someone pick before we all starve.' },
] as const;

export function HomeScreen({ go, onParty }: { go: (tab: Tab) => void; onParty:()=>void }) {
  const {plan}=useOuting();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const venue = plan?.chosenVenue && ['verified', 'onemap', 'google_places'].includes(plan.chosenVenue.source) ? plan.chosenVenue : undefined;
  const singaporeTime = useMemo(() => new Intl.DateTimeFormat('en-SG', {
    timeZone: 'Asia/Singapore', weekday: 'long', hour: 'numeric', minute: '2-digit',
  }).format(now).toUpperCase(), [now]);
  const hasPlan = Boolean(plan?.participants.length);
  const reduced = useReducedMotion();
  const [lineIndex, setLineIndex] = useState(0);
  useEffect(() => {
    if (reduced) return;
    const timer = setInterval(() => setLineIndex((index) => (index + 1) % homeLines.length), 6000);
    return () => clearInterval(timer);
  }, [reduced]);
  const line = homeLines[reduced ? 0 : lineIndex] ?? homeLines[0];

  return (
    <View style={styles.wrap}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>{singaporeTime} · SGT</Text>
        <Text style={styles.title}>{line.title}</Text>
        <Text style={styles.subtitle}>{line.subtitle}</Text>
      </View>

      <HomeBao />

      {hasPlan ? <Card>
        <View style={styles.planTop}><View style={styles.flex}><Text style={styles.cardKicker}>YOUR SUPPER PLAN</Text><Text style={styles.cardTitle}>{venue?.name ?? 'Still choosing where to makan'}</Text></View><Pill>{plan?.status === 'closed' ? 'Closed' : plan?.remote?.published ? 'Shared' : 'On this device'}</Pill></View>
        <Text style={styles.body}>{plan!.participants.map((person) => person.name || 'Unnamed kaki').join(' · ')}</Text>
        <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}><Text style={styles.planMetaCopy}>{plan!.participants.length} kakis · {plan!.code}</Text><Pressable accessibilityRole="button" onPress={onParty} style={{padding:12}}><Text style={{color:colors.green,fontWeight:'700'}}>Parties ↗</Text></Pressable></View>
        <Button label={venue ? 'Open supper plan →' : 'Finish choosing a place →'} onPress={() => go('meet')} />
        <GoogleVenueStatus place={venue}/>
      </Card> : <Card>
        <Text style={styles.cardKicker}>START HERE</Text>
        <Text style={styles.cardTitle}>Where should the gang meet?</Text>
        <Text style={styles.body}>Create a party, send the link, and decide together.</Text>
        <Button label="Create or join a party →" onPress={onParty} />
        <Button secondary label="Just browse places" onPress={() => go('meet')} />
      </Card>}

      <View style={styles.row}>
        <QuickAction emoji="🍜" title="Meet & makan" copy="Pick your supper spot" onPress={() => go('meet')} />
        <QuickAction emoji="🧾" title="Split the bill" copy="Pay for what you ate" onPress={() => go('split')} />
        <QuickAction emoji="🚕" title="Share a ride" copy="See who’s going your way" onPress={() => go('ride')} />
        <QuickAction emoji="🚇" title="Last Call" copy="Check your journey home" onPress={() => go('train')} />
      </View>
    </View>
  );
}

function HomeBao() {
  const [ask, setAsk] = useState(false);
  const [width, setWidth] = useState(360);
  const panelWidth = Math.min(baoAskPanel.width, Math.max(120, width - 182));
  return (
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={[styles.baoCard, ask && styles.baoCardAsk]}>
      <View style={styles.baoCopy}><Text style={styles.cardTitle}>Bao jio!</Text><Text style={styles.body}>Your supper kaki is here. Tap Bao to ask anything.</Text></View>
      <View style={styles.baoMark}><SupperKaki ask={ask} onAsk={() => setAsk((open) => !open)} /></View>
      {ask ? <View pointerEvents="box-none" style={[styles.baoAsk, { width: panelWidth }]}><BaoAskPanel tail="right" width={panelWidth} onClose={() => setAsk(false)} /></View> : null}
    </View>
  );
}

function QuickAction({ emoji, title, copy, onPress }: { emoji: string; title: string; copy: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={({ pressed }) => [styles.mini, pressed && styles.miniPressed]}>
    <View style={{flexDirection:'row',justifyContent:'space-between',alignSelf:'stretch'}}><Text style={styles.emoji}>{emoji}</Text><Text style={styles.open}>↗</Text></View><View><Text style={styles.miniTitle}>{title}</Text><Text style={styles.miniCopy}>{copy}</Text></View>
  </Pressable>;
}

const styles = StyleSheet.create({
  wrap: { gap: 24 },
  baoCard: { width: '100%', alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', backgroundColor: colors.blush, borderRadius: 24, padding: 16, gap: 8, position: 'relative', overflow: 'hidden' },
  baoCardAsk: { overflow: 'visible', zIndex: 4 },
  baoCopy: { flex: 1, minWidth: 0 },
  baoMark: { width: 150, minWidth: 150, maxWidth: 150, flexGrow: 0, flexShrink: 0, zIndex: 3 },
  baoAsk: { position: 'absolute', right: 174, top: 16, zIndex: 2 },
  hero:{backgroundColor:colors.card,borderRadius:24,padding:20},
  eyebrow: { color: colors.muted, fontWeight: '700', letterSpacing: 1.2, fontSize: 10 },
  title: { color: colors.ink, fontWeight: '900', fontSize: 28, lineHeight: 34, letterSpacing:-1, marginTop: 8 },
  accent: { color: colors.coral },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 23, marginTop: 8, maxWidth: 520 },
  cardKicker: { color: colors.green, fontWeight: '900', fontSize: 11, letterSpacing: 1.2 },
  cardTitle: { color: colors.ink, fontWeight: '900', fontSize: 23, marginTop: 8 },
  body: { color: colors.muted, fontSize: 15, lineHeight: 22, marginVertical: 12 },
  flex: { flex: 1 }, planTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }, planMeta: { backgroundColor: colors.paper, borderRadius: 14, padding: 12, marginBottom: 13 }, planMetaLabel: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: 0.9 }, planCode: { color: colors.ink, fontSize: 20, fontWeight: '900', letterSpacing: 2, marginTop: 2 }, planMetaCopy: { color: colors.muted, fontSize: 12, marginTop: 4 },
  row: { gap: 12, flexDirection:'row', flexWrap:'wrap' },
  mini: { flexBasis:'46%',flexGrow:1, gap: 14, backgroundColor:colors.bambooSoft,borderRadius:22, padding:18, minHeight: 140 }, miniPressed: { opacity: 0.7 },
  emoji: { fontSize: 25 },
  miniTitle: { color: colors.ink, fontWeight: '700', fontSize: 16 },
  miniCopy: { color: colors.ink, opacity: 0.68, fontSize: 13, lineHeight: 18, marginTop: 5 },
  open: { color: colors.muted, fontSize: 20 },
});

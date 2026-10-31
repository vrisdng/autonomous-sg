import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Ellipse, Path } from 'react-native-svg';
import { BAO_BODY, BAO_CHEEK, BAO_CREAM, BAO_INK, BAO_PLEATS } from './baoArt';
import { feedParty } from '../features/plans/feedParty';
import { activeParty } from '../features/plans/friends';
import { useOuting } from '../hooks/useOuting';
import { Tab } from '../types';

export function BaoLauncher({ onPress }: { onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel="Open Bojio features with Bao" onPress={onPress} style={({ pressed }) => [styles.launcher, pressed && styles.pressed]}>
    <BaoFace size={33} />
    <Text style={styles.launcherText}>Jio with Bao</Text>
  </Pressable>;
}

export function FeedPartyStrip({ onOpen }: { onOpen: () => void }) {
  const party = feedParty(useOuting().plan);
  if (!party) return null;
  return <Pressable accessibilityRole="button" accessibilityLabel={`Continue your party: ${party.title}`} onPress={onOpen} style={({ pressed }) => [styles.strip, pressed && styles.pressed]}>
    <BaoFace size={30} />
    <View style={styles.itemCopy}><Text numberOfLines={1} style={styles.eyebrow}>{party.kicker}</Text><Text numberOfLines={1} style={styles.stripTitle}>{party.title}</Text></View>
    <Text style={styles.stripAction}>Continue ›</Text>
  </Pressable>;
}

export function BaoFeatureMenu({ visible, onClose, onNavigate, onCreateParty, onInvite }: {
  visible: boolean;
  onClose: () => void;
  onNavigate: (tab: Tab) => void;
  onCreateParty: () => void;
  onInvite: () => void;
}) {
  const party = activeParty(useOuting().plan);
  const go = (tab: Tab) => { onClose(); onNavigate(tab); };
  const open = (next: () => void) => { onClose(); next(); };
  if (!visible) return null;
  return <View style={styles.overlay} accessibilityViewIsModal>
      <Pressable accessibilityRole="button" accessibilityLabel="Close Bao menu" onPress={onClose} style={styles.scrim} />
      <View style={styles.column} pointerEvents="box-none">
        <View style={styles.panel}>
          <View style={styles.heading}>
            <BaoFace size={38} />
            <View style={styles.headingCopy}><Text style={styles.eyebrow}>BOJIO WITH BAO</Text><Text style={styles.title}>What are we doing?</Text></View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close Bao menu" onPress={onClose} style={styles.close}><Text style={styles.closeText}>×</Text></Pressable>
          </View>
          {party ? <>
            <Pressable accessibilityRole="button" accessibilityLabel={`Party ${party.code}, invite friends`} onPress={() => open(onInvite)} style={({ pressed }) => [styles.party, pressed && styles.pressed]}>
              <Text style={styles.partyText}>Party {party.code} · {party.participants.length} in</Text><Text style={styles.partyLink}>Invite ›</Text>
            </Pressable>
            <MenuItem icon="♡" title="Makan Swipe" detail="Swipe restaurants together, see the Top 3" onPress={() => go('meet')} />
            <MenuItem icon="◇" title="Same Way, Can Share?" detail="Pool the ride home, then open it in Grab" onPress={() => go('ride')} />
            <MenuItem icon="＄" title="SplitLink" detail="Claim items and settle the bill" onPress={() => go('split')} />
          </> : <MenuItem icon="+" title="Create party" detail="Group your friends, share one invite" onPress={() => open(onCreateParty)} />}
        </View>
      </View>
  </View>;
}

function MenuItem({ icon, title, detail, onPress }: { icon: string; title: string; detail: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
    <Text style={styles.itemIcon}>{icon}</Text><View style={styles.itemCopy}><Text style={styles.itemTitle}>{title}</Text><Text style={styles.itemDetail}>{detail}</Text></View><Text style={styles.arrow}>›</Text>
  </Pressable>;
}

export function BaoFace({ size }: { size: number }) {
  return <View style={[styles.faceCircle, { width: size, height: size, borderRadius: size / 2 }]}>
    <Svg width={size * 0.72} height={size * 0.84} viewBox="0 0 120 140">
      <Path d={BAO_BODY} fill={BAO_CREAM} stroke={BAO_INK} strokeWidth="5" />
      <Path d={BAO_PLEATS} fill="none" stroke={BAO_INK} strokeWidth="2.7" strokeLinecap="round" />
      <Ellipse cx="32" cy="76" rx="11" ry="7" fill={BAO_CHEEK} />
      <Ellipse cx="84" cy="76" rx="11" ry="7" fill={BAO_CHEEK} />
      <Ellipse cx="45" cy="69" rx="3.4" ry="4" fill={BAO_INK} />
      <Ellipse cx="70" cy="69" rx="3.4" ry="4" fill={BAO_INK} />
      <Path d="M52 82 Q58 87 64 82" fill="none" stroke={BAO_INK} strokeWidth="2.5" strokeLinecap="round" />
    </Svg>
  </View>;
}

const styles = StyleSheet.create({
  launcher: { width: 76, minHeight: 52, alignItems: 'center', justifyContent: 'center', gap: 1, padding: 2, zIndex: 10 },
  launcherText: { color: '#221D18', fontSize: 9, fontWeight: '800' },
  strip: { width: '100%', maxWidth: 720, alignSelf: 'center', minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFF9C2', paddingHorizontal: 12, paddingVertical: 7 },
  stripTitle: { color: '#161616', fontSize: 14, fontWeight: '800', marginTop: 1 },
  stripAction: { color: '#111111', fontSize: 13, fontWeight: '800' },
  faceCircle: { backgroundColor: '#FFE900', alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.7 },
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 100, elevation: 20 },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: '#00000066' },
  // Sits just under the header so it reads as dropping from Bao.
  column: { width: '100%', maxWidth: 720, alignSelf: 'center', alignItems: 'flex-end', paddingTop: 100, paddingHorizontal: 12 },
  panel: { width: '100%', maxWidth: 340, backgroundColor: '#FFFFFF', borderRadius: 20, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  headingCopy: { flex: 1 },
  eyebrow: { color: '#776B2B', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: '#161616', fontSize: 18, fontWeight: '900' },
  close: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#666666', fontSize: 29 },
  party: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 12, marginBottom: 8, borderRadius: 12, backgroundColor: '#FFF8B8' },
  partyText: { flex: 1, color: '#221D18', fontSize: 13, fontWeight: '800' },
  partyLink: { color: '#221D18', fontSize: 13, fontWeight: '800' },
  item: { minHeight: 65, flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderTopColor: '#EFEFEF' },
  itemIcon: { width: 33, textAlign: 'center', color: '#2B211C', fontSize: 23, fontWeight: '800' },
  itemCopy: { flex: 1 },
  itemTitle: { color: '#181818', fontSize: 15, fontWeight: '800' },
  itemDetail: { color: '#777777', fontSize: 11, marginTop: 3 },
  arrow: { color: '#888888', fontSize: 25 },
});

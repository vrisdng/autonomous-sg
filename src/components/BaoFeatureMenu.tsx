import { RefObject, useEffect, useRef, useState } from 'react';
import { Animated, Easing, PanResponder, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Ellipse, Path } from 'react-native-svg';
import { BAO_INK } from './baoArt';
import { BaoApple } from './BaoApple';
import { feedParty } from '../features/plans/feedParty';
import { activeParty } from '../features/plans/friends';
import { useOuting } from '../hooks/useOuting';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { Tab } from '../types';

type Point = { x: number; y: number };
const launcher = { width: 76, height: 74 };
const dragThreshold = 4;

// Drag anywhere, tap to open. A short press stays a tap; only real movement starts a drag.
export function BaoLauncher({ onPress, centerRef, dropping, over }: { onPress: (center: Point) => void; centerRef: RefObject<Point | undefined>; dropping: boolean; over: boolean }) {
  const { width, height } = useWindowDimensions();
  const [dragged, setDragged] = useState<Point>();
  const reduced = useReducedMotion();
  const bob = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    bob.setValue(0);
    if (reduced) return;
    const ease = Easing.inOut(Easing.sin);
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(bob, { toValue: -6, duration: 1400, easing: ease, useNativeDriver: false }),
      Animated.timing(bob, { toValue: 0, duration: 1400, easing: ease, useNativeDriver: false }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [reduced, bob]);
  const clamp = ({ x, y }: Point) => ({
    x: Math.max(4, Math.min(width - launcher.width - 4, x)),
    y: Math.max(4, Math.min(height - launcher.height - 4, y)),
  });
  // Starts at the feed column's bottom right, clear of the nav.
  const position = clamp(dragged ?? { x: Math.min(width, (width + 720) / 2) - launcher.width - 12, y: height - launcher.height - 84 });
  const live = useRef({ position, clamp });
  live.current = { position, clamp };
  centerRef.current = { x: position.x + launcher.width / 2, y: position.y + launcher.height / 2 };
  const origin = useRef(position);
  // The browser still fires a click when a drag ends. It must not open the menu.
  const justDragged = useRef(false);
  const endDrag = () => { setTimeout(() => { justDragged.current = false; }, 100); };
  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_, gesture) => Math.abs(gesture.dx) + Math.abs(gesture.dy) > dragThreshold,
    onPanResponderGrant: () => { justDragged.current = true; origin.current = live.current.position; },
    onPanResponderMove: (_, gesture) => setDragged(live.current.clamp({ x: origin.current.x + gesture.dx, y: origin.current.y + gesture.dy })),
    onPanResponderRelease: endDrag,
    onPanResponderTerminate: endDrag,
    onPanResponderTerminationRequest: () => false,
  })).current;
  return <Animated.View {...pan.panHandlers} style={[styles.launcher, styles.launcherGrab, { left: position.x, top: position.y, transform: [{ translateY: bob }, { scale: over ? 1.3 : dropping ? 1.12 : 1 }] }]}>
    <Pressable accessibilityRole="button" accessibilityLabel="Open Bojio features with Bao" onPress={() => { if (!justDragged.current) onPress({ x: position.x + launcher.width / 2, y: position.y + launcher.height / 2 }); }} style={({ pressed }) => [styles.launcherButton, pressed && styles.pressed]}>
      <View style={styles.launcherFace}><BaoFace size={54} /></View>
      <Text style={styles.launcherText}>{dropping ? 'Add to swipe' : 'Jio with Bao'}</Text>
    </Pressable>
  </Animated.View>;
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

export function BaoFeatureMenu({ visible, anchor, onClose, onNavigate, onCreateParty, onInvite }: {
  visible: boolean;
  anchor?: Point;
  onClose: () => void;
  onNavigate: (tab: Tab) => void;
  onCreateParty: () => void;
  onInvite: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const party = activeParty(useOuting().plan);
  const go = (tab: Tab) => { onClose(); onNavigate(tab); };
  const open = (next: () => void) => { onClose(); next(); };
  if (!visible) return null;
  // Open beside Bao wherever it was dragged: above it in the lower half, below it otherwise.
  const panelWidth = Math.min(340, width - 24);
  const center = anchor ?? { x: width / 2, y: 0 };
  const left = Math.max(12, Math.min(width - panelWidth - 12, center.x - panelWidth / 2));
  const place = center.y > height / 2 ? { bottom: height - center.y + 46 } : { top: center.y + 46 };
  return <View style={styles.overlay} accessibilityViewIsModal>
      <Pressable accessibilityRole="button" accessibilityLabel="Close Bao menu" onPress={onClose} style={styles.scrim} />
      <View style={styles.column} pointerEvents="box-none">
        <View style={[styles.panel, { left, width: panelWidth }, place]}>
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
      <BaoApple />
      <Ellipse cx="45" cy="69" rx="3.4" ry="4" fill={BAO_INK} />
      <Ellipse cx="70" cy="69" rx="3.4" ry="4" fill={BAO_INK} />
      <Path d="M52 82 Q58 87 64 82" fill="none" stroke={BAO_INK} strokeWidth="2.5" strokeLinecap="round" />
    </Svg>
  </View>;
}

const styles = StyleSheet.create({
  launcher: { position: 'absolute', width: launcher.width, height: launcher.height, zIndex: 70, elevation: 8 },
  launcherGrab: { cursor: 'grab', touchAction: 'none', userSelect: 'none' } as object,
  launcherButton: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  launcherFace: { borderRadius: 27, shadowColor: '#000000', shadowOpacity: 0.22, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  launcherText: { color: '#221D18', fontSize: 9, fontWeight: '800', backgroundColor: '#FFFFFF', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, overflow: 'hidden' },
  strip: { width: '100%', maxWidth: 720, alignSelf: 'center', minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFF9C2', paddingHorizontal: 12, paddingVertical: 7 },
  stripTitle: { color: '#161616', fontSize: 14, fontWeight: '800', marginTop: 1 },
  stripAction: { color: '#111111', fontSize: 13, fontWeight: '800' },
  faceCircle: { backgroundColor: '#FFE900', alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.7 },
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 100, elevation: 20 },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: '#00000066' },
  column: { ...StyleSheet.absoluteFillObject },
  panel: { position: 'absolute', backgroundColor: '#FFFFFF', borderRadius: 20, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 },
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

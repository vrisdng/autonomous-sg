import { useLayoutEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { colors, shadow } from '../theme';
import { likeShare, rankMetal, readLiveTop3, subscribeLiveTop3, type LiveRankRow } from './liveTop3Store';

const nativeDriver = Platform.OS !== 'web';
const ROW = 32;

/** Floating live leaderboard for the Meet swipe deck. Sits above the screen, not in the scroll. */
export function LiveTop3Dock() {
  const snapshot = useSyncExternalStore(subscribeLiveTop3, readLiveTop3, readLiveTop3);
  if (!snapshot) return null;
  const summary = snapshot.rows.length
    ? `Live Top 3. ${snapshot.rows.map((row, index) => `${['1st', '2nd', '3rd'][index] ?? index + 1} ${row.name}, ${row.likes} likes`).join('. ')}`
    : 'Live Top 3. No favourites yet';
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={summary} testID="live-top3" onPress={snapshot.open} style={styles.card}>
      <View pointerEvents="none" style={styles.header}>
        <Text style={styles.title}>Top 3</Text>
        <Text style={styles.more}>Details</Text>
      </View>
      {snapshot.rows.length ? (
        <View pointerEvents="none" style={{ height: snapshot.rows.length * ROW }}>
          {snapshot.rows.map((row, index) => (
            <RankSlot key={row.id} index={index}>
              <RankRow row={row} index={index} voters={snapshot.voters} />
            </RankSlot>
          ))}
        </View>
      ) : <Text pointerEvents="none" style={styles.empty}>No hearts yet</Text>}
    </Pressable>
  );
}

function RankSlot({ index, children }: { index: number; children: ReactNode }) {
  const reduced = useReducedMotion();
  const y = useRef(new Animated.Value(index * ROW)).current;
  const seen = useRef(index);
  useLayoutEffect(() => {
    const next = index * ROW;
    if (seen.current === index || reduced) {
      y.setValue(next);
      seen.current = index;
      return;
    }
    seen.current = index;
    const animation = Animated.timing(y, { toValue: next, duration: 320, easing: Easing.inOut(Easing.cubic), useNativeDriver: nativeDriver });
    animation.start();
    return () => animation.stop();
  }, [index, reduced, y]);
  return <Animated.View style={[styles.slot, { transform: [{ translateY: y }] }]}>{children}</Animated.View>;
}

function RankRow({ row, index, voters }: { row: LiveRankRow; index: number; voters: number }) {
  const metal = rankMetal(index);
  return (
    <View style={styles.row} testID={`live-top3-place-${index + 1}`}>
      <View style={styles.mark}>
        <PodiumCup color={metal.ink} />
        <View style={[styles.rank, { backgroundColor: metal.fill, borderColor: metal.ring }]}>
          <Text style={[styles.rankText, { color: metal.ink }]}>{index + 1}</Text>
        </View>
      </View>
      <View style={styles.copy}>
        <View style={styles.nameRow}>
          <Text numberOfLines={1} style={styles.name}>{row.name}</Text>
          <Text style={styles.likes}>♥ {row.likes}</Text>
        </View>
        <LikeBar likes={row.likes} voters={voters} color={metal.bar} />
      </View>
    </View>
  );
}

/** Tiny award cup. Same shape for each place; the metal colour tells them apart. */
function PodiumCup({ color }: { color: string }) {
  return (
    <Svg width={12} height={12} viewBox="0 0 16 16">
      <Path fill={color} d="M5 1.7h6v3.5c0 1.7-1.3 3-3 3s-3-1.3-3-3V1.7z" />
      <Path d="M5 3.1C3.6 3.1 2.7 3.7 2.7 4.7S3.6 6.3 5 6.3M11 3.1c1.4 0 2.3.6 2.3 1.6S12.4 6.3 11 6.3" fill="none" stroke={color} strokeWidth={1.15} strokeLinecap="round" />
      <Path d="M8 8.2v2.1M5.3 11.4h5.4" fill="none" stroke={color} strokeWidth={1.35} strokeLinecap="round" />
    </Svg>
  );
}

function LikeBar({ likes, voters, color }: { likes: number; voters: number; color: string }) {
  const reduced = useReducedMotion();
  const share = likeShare(likes, voters);
  const width = useRef(new Animated.Value(share)).current;
  useLayoutEffect(() => {
    if (reduced) {
      width.setValue(share);
      return;
    }
    const animation = Animated.timing(width, { toValue: share, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    animation.start();
    return () => animation.stop();
  }, [reduced, share, width]);
  return (
    <View style={styles.track}>
      <Animated.View style={[styles.fill, { backgroundColor: color, width: width.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 152,
    zIndex: 3,
    backgroundColor: 'rgba(250, 244, 237, 0.72)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(205, 184, 159, 0.55)',
    paddingHorizontal: 8,
    paddingTop: 4,
    paddingBottom: 4,
    gap: 2,
    shadowColor: shadow.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 18 },
  title: { color: colors.ink, fontSize: 12, fontWeight: '900' },
  more: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  empty: { color: colors.muted, fontSize: 11, fontWeight: '700', paddingVertical: 4 },
  slot: { position: 'absolute', left: 0, right: 0, height: ROW, justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  mark: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  rank: { width: 16, height: 16, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  rankText: { fontSize: 10, fontWeight: '900' },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  name: { flex: 1, minWidth: 0, color: colors.ink, fontSize: 11, fontWeight: '800' },
  likes: { color: colors.green, fontSize: 10, fontWeight: '900' },
  track: { height: 4, borderRadius: 2, backgroundColor: 'rgba(212, 183, 154, 0.45)', overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2 },
});

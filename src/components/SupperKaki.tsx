import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Ellipse, Path } from 'react-native-svg';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { colors } from '../theme';
import { BAO_BODY, BAO_CHEEK, BAO_CREAM, BAO_GROUND, BAO_INK, BAO_LEAF, BAO_PLEATS, BAO_STEAMER } from './baoArt';

const nativeDriver = Platform.OS !== 'web';
const swayEase = Easing.inOut(Easing.sin);
const tapEase = Easing.inOut(Easing.quad);

const CREAM = BAO_CREAM;
const INK = BAO_INK;
const CHEEK = BAO_CHEEK;
const STEAMER = BAO_STEAMER;
const LEAF = BAO_LEAF;
const GROUND = BAO_GROUND;

export function SupperKaki({ ask = false, onAsk }: { ask?: boolean; onAsk?: () => void } = {}) {
  const reduced = useReducedMotion();
  const sway = useRef(new Animated.Value(0)).current;
  const steamL = useRef(new Animated.Value(0)).current;
  const steamR = useRef(new Animated.Value(0)).current;
  const blink = useRef(new Animated.Value(1)).current;
  const squash = useRef(new Animated.Value(0)).current;
  const puff = useRef(new Animated.Value(0)).current;
  const leaf = useRef(new Animated.Value(0)).current;
  const [hello, setHello] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const tapAnim = useRef<Animated.CompositeAnimation | undefined>(undefined);

  useEffect(() => {
    const stops: Array<() => void> = [];
    sway.setValue(0);
    steamL.setValue(0);
    steamR.setValue(0);
    blink.setValue(1);
    squash.setValue(0);
    puff.setValue(0);
    leaf.setValue(0);
    if (!reduced) {
      const swayLoop = Animated.loop(Animated.sequence([
        Animated.timing(sway, { toValue: 1, duration: 1600, easing: swayEase, useNativeDriver: nativeDriver }),
        Animated.timing(sway, { toValue: -1, duration: 3200, easing: swayEase, useNativeDriver: nativeDriver }),
        Animated.timing(sway, { toValue: 0, duration: 1600, easing: swayEase, useNativeDriver: nativeDriver }),
      ]));
      const leafLoop = Animated.loop(Animated.sequence([
        Animated.timing(leaf, { toValue: 1, duration: 2200, easing: swayEase, useNativeDriver: nativeDriver }),
        Animated.timing(leaf, { toValue: 0, duration: 2200, easing: swayEase, useNativeDriver: nativeDriver }),
      ]));
      swayLoop.start();
      leafLoop.start();
      stops.push(() => swayLoop.stop(), () => leafLoop.stop());
      stops.push(rise(steamL, 2200));
      stops.push(rise(steamR, 2200, 1100));
      const blinkLoop = Animated.loop(Animated.sequence([
        Animated.delay(2600),
        closeEyes(blink),
        Animated.delay(160),
        closeEyes(blink),
        Animated.delay(3200),
        closeEyes(blink),
      ]));
      blinkLoop.start();
      stops.push(() => blinkLoop.stop());
    }
    return () => {
      stops.forEach((stop) => stop());
      tapAnim.current?.stop();
    };
  }, [reduced, sway, steamL, steamR, blink, squash, puff, leaf]);

  useEffect(() => () => {
    clearTimeout(timer.current);
    tapAnim.current?.stop();
  }, []);

  const nudge = () => {
    tapAnim.current?.stop();
    if (reduced) {
      squash.setValue(0);
      return;
    }
    squash.setValue(0);
    const tap = Animated.sequence([
      Animated.timing(squash, { toValue: 1, duration: 130, easing: tapEase, useNativeDriver: nativeDriver }),
      Animated.timing(squash, { toValue: 0, duration: 210, easing: tapEase, useNativeDriver: nativeDriver }),
    ]);
    tapAnim.current = tap;
    tap.start();
  };

  const greet = () => {
    clearTimeout(timer.current);
    tapAnim.current?.stop();
    setHello(true);
    const settle = () => setHello(false);
    if (reduced) {
      squash.setValue(0);
      puff.setValue(0);
      timer.current = setTimeout(settle, 1800);
      return;
    }
    squash.setValue(0);
    puff.setValue(0);
    const tap = Animated.parallel([
      Animated.sequence([
        Animated.timing(squash, { toValue: 1, duration: 130, easing: tapEase, useNativeDriver: nativeDriver }),
        Animated.timing(squash, { toValue: 0, duration: 210, easing: tapEase, useNativeDriver: nativeDriver }),
      ]),
      Animated.sequence([
        Animated.timing(puff, { toValue: 1, duration: 200, easing: Easing.out(Easing.quad), useNativeDriver: nativeDriver }),
        Animated.timing(puff, { toValue: 0, duration: 420, easing: Easing.in(Easing.quad), useNativeDriver: nativeDriver }),
      ]),
    ]);
    tapAnim.current = tap;
    tap.start();
    timer.current = setTimeout(settle, 1800);
  };

  const swayX = useMemo(() => sway.interpolate({ inputRange: [-1, 1], outputRange: [-2, 2] }), [sway]);
  const swayRot = useMemo(() => sway.interpolate({ inputRange: [-1, 1], outputRange: ['-2.2deg', '2.2deg'] }), [sway]);
  const scaleX = useMemo(() => squash.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }), [squash]);
  const scaleY = useMemo(() => squash.interpolate({ inputRange: [0, 1], outputRange: [1, 0.9] }), [squash]);
  const leafScale = useMemo(() => leaf.interpolate({ inputRange: [0, 1], outputRange: [1, 1.045] }), [leaf]);
  const leafTilt = useMemo(() => leaf.interpolate({ inputRange: [0, 1], outputRange: ['-1.6deg', '1.6deg'] }), [leaf]);
  const leafTiltBack = useMemo(() => leaf.interpolate({ inputRange: [0, 1], outputRange: ['1.6deg', '-1.6deg'] }), [leaf]);
  const steamLeft = steamStyle(steamL, '16deg');
  const steamRight = steamStyle(steamR, '-16deg');
  const puffY = useMemo(() => puff.interpolate({ inputRange: [0, 1], outputRange: [2, -16] }), [puff]);
  const puffOpacity = useMemo(() => puff.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0, 0.95, 0] }), [puff]);
  const puffScale = useMemo(() => puff.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.15] }), [puff]);

  const press = () => {
    if (onAsk) {
      nudge();
      onAsk();
      return;
    }
    greet();
  };

  return <View style={s.stage}>
    <View style={[s.bubbleWrap, ask && s.held]} pointerEvents="none" accessibilityElementsHidden={ask} importantForAccessibility={ask ? 'no-hide-descendants' : 'auto'}><Text accessibilityLiveRegion={ask ? 'none' : 'polite'} style={s.bubble}>{hello ? 'Bao jio! ♡' : 'Hungry already?'}</Text><View style={s.bubbleTail}/></View>
    <Pressable accessibilityRole="button" accessibilityLabel={onAsk ? (ask ? 'Close ask Bao' : 'Ask Bao') : 'Say hello to Bao'} testID={onAsk ? 'home-bao' : undefined} onPress={press} style={s.art}>
      <View style={s.ground}/>
      <Animated.View style={[s.leaf, s.leafLeft, { transform: [{ rotate: '-42deg' }, { scale: leafScale }, { rotate: leafTilt }] }]}><MintLeaf width={40} height={22}/></Animated.View>
      <Animated.View style={[s.leaf, s.leafMid, { transform: [{ rotate: '18deg' }, { scale: leafScale }, { rotate: leafTiltBack }] }]}><MintLeaf width={30} height={17}/></Animated.View>
      <Animated.View style={[s.leaf, s.leafRight, { transform: [{ rotate: '36deg' }, { scale: leafScale }, { rotate: leafTilt }] }]}><MintLeaf width={38} height={21}/></Animated.View>
      <Animated.View style={[s.sway, { transform: [{ translateX: swayX }, { translateY: 52 }, { rotate: swayRot }, { translateY: -52 }] }]}>
        <Animated.View style={[s.steam, s.steamLeft, reduced ? s.steamStill : steamLeft]}/>
        <Animated.View style={[s.steam, s.steamRight, reduced ? s.steamStillRight : steamRight]}/>
        <Animated.View pointerEvents="none" style={[s.puff, s.puffLeft, { opacity: puffOpacity, transform: [{ translateY: puffY }, { scale: puffScale }, { rotate: '-18deg' }] }]}/>
        <Animated.View pointerEvents="none" style={[s.puff, s.puffRight, { opacity: puffOpacity, transform: [{ translateY: puffY }, { scale: puffScale }, { rotate: '18deg' }] }]}/>
        <Animated.View style={[s.squash, { transform: [{ translateY: 59 }, { scaleX }, { scaleY }, { translateY: -59 }] }]}>
          <View style={s.clip}>
            <Svg width={120} height={140} viewBox="0 0 120 140">
              <Path d={BAO_BODY} fill={CREAM}/>
              <Ellipse cx={32} cy={76} rx={11} ry={7} fill={CHEEK}/>
              <Ellipse cx={84} cy={76} rx={11} ry={7} fill={CHEEK}/>
              <Path d={BAO_BODY} fill="none" stroke={INK} strokeWidth={4.5} strokeLinejoin="round" strokeLinecap="round"/>
              <Path d={BAO_PLEATS} fill="none" stroke={INK} strokeWidth={2.6} strokeLinecap="round"/>
              {hello ? <>
                <Path d="M40 60 L52 67 L40 74" fill="none" stroke={INK} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round"/>
                <Path d="M76 60 L64 67 L76 74" fill="none" stroke={INK} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round"/>
                <Ellipse cx={58} cy={84} rx={5.1} ry={4.2} fill={INK}/>
              </> : <Path d="M52 80 Q58 86 64 80" fill="none" stroke={INK} strokeWidth={2.4} strokeLinecap="round"/>}
            </Svg>
            {!hello ? <>
              <Animated.View style={[s.dot, s.dotLeft, { transform: [{ scaleY: blink }] }]}/>
              <Animated.View style={[s.dot, s.dotRight, { transform: [{ scaleY: blink }] }]}/>
            </> : null}
          </View>
        </Animated.View>
      </Animated.View>
      <View style={s.basket}><View style={s.weave}/></View>
    </Pressable>
    <Text style={[s.hint, ask && s.held]} accessibilityElementsHidden={ask}>{onAsk ? 'tap to ask' : 'tap me'}</Text>
  </View>;
}

function MintLeaf({ width, height }: { width: number; height: number }) {
  return <Svg width={width} height={height} viewBox="0 0 40 22">
    <Path d="M4 12 C4 4 22 1 34 8 C40 13 32 21 18 21 C8 21 4 16 4 12 Z" fill={LEAF} stroke={INK} strokeWidth={2.5} strokeLinejoin="round"/>
    <Path d="M8 12 C16 11 26 11 34 9" fill="none" stroke={INK} strokeWidth={1.7} strokeLinecap="round"/>
  </Svg>;
}

function closeEyes(blink: Animated.Value) {
  return Animated.sequence([
    Animated.timing(blink, { toValue: 0.08, duration: 80, easing: tapEase, useNativeDriver: nativeDriver }),
    Animated.timing(blink, { toValue: 1, duration: 110, easing: tapEase, useNativeDriver: nativeDriver }),
  ]);
}

function rise(value: Animated.Value, duration: number, delay = 0) {
  let stopped = false;
  let wait: ReturnType<typeof setTimeout> | undefined;
  const tick = () => {
    if (stopped) return;
    value.setValue(0);
    Animated.timing(value, { toValue: 1, duration, easing: swayEase, useNativeDriver: nativeDriver }).start(({ finished }) => {
      if (finished && !stopped) tick();
    });
  };
  if (delay) wait = setTimeout(tick, delay);
  else tick();
  return () => {
    stopped = true;
    clearTimeout(wait);
    value.stopAnimation();
  };
}

function steamStyle(value: Animated.Value, lean: '16deg' | '-16deg') {
  return {
    opacity: value.interpolate({ inputRange: [0, 0.16, 0.74, 1], outputRange: [0, 0.95, 0.95, 0] }),
    transform: [
      { translateY: value.interpolate({ inputRange: [0, 1], outputRange: [4, -10] }) },
      { rotate: lean },
    ],
  };
}

const s = StyleSheet.create({
  stage: { width: 150, minWidth: 150, maxWidth: 150, alignItems: 'center' },
  held: { opacity: 0 },
  bubbleWrap: { alignItems: 'center', marginBottom: 4 },
  bubble: { fontSize: 12, fontWeight: '800', color: colors.ink, backgroundColor: 'white', paddingHorizontal: 11, paddingVertical: 8, borderRadius: 16 },
  bubbleTail: { width: 10, height: 10, backgroundColor: 'white', transform: [{ rotate: '45deg' }], marginTop: -6 },
  art: { width: 150, height: 132, alignItems: 'center' },
  ground: { position: 'absolute', bottom: 1, width: 100, height: 13, borderRadius: 8, backgroundColor: GROUND },
  leaf: { position: 'absolute' },
  leafLeft: { left: 0, top: 58 },
  leafMid: { left: 16, top: 72 },
  leafRight: { right: 0, top: 54 },
  sway: { position: 'absolute', left: 15, top: 0, width: 120, height: 124, alignItems: 'center' },
  squash: { width: 120, height: 118 },
  clip: { width: 120, height: 118, overflow: 'hidden' },
  dot: { position: 'absolute', top: 64, width: 5.5, height: 5.5, borderRadius: 3, backgroundColor: INK },
  dotLeft: { left: 43 },
  dotRight: { left: 67 },
  basket: { position: 'absolute', left: 8, top: 96, width: 134, height: 24, borderRadius: 8, backgroundColor: STEAMER, borderWidth: 3, borderColor: INK, alignItems: 'center', justifyContent: 'center' },
  weave: { width: 110, height: 3, borderRadius: 2, backgroundColor: INK },
  steam: { position: 'absolute', top: 0, width: 8, height: 14, borderLeftWidth: 2.5, borderColor: BAO_CREAM, borderRadius: 8 },
  steamLeft: { left: 36 },
  steamRight: { right: 36 },
  steamStill: { opacity: 0.85, transform: [{ rotate: '16deg' }] },
  steamStillRight: { opacity: 0.85, transform: [{ rotate: '-16deg' }] },
  puff: { position: 'absolute', top: 2, width: 9, height: 16, borderLeftWidth: 2.5, borderColor: BAO_CREAM, borderRadius: 8 },
  puffLeft: { left: 48 },
  puffRight: { right: 48 },
  hint: { fontSize: 10, color: colors.muted, marginTop: 2, fontWeight: '700' },
});

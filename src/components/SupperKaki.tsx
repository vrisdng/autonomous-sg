import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Ellipse, Path } from 'react-native-svg';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { colors } from '../theme';
import { BAO_GROUND, BAO_INK } from './baoArt';
import { BaoApple } from './BaoApple';

const nativeDriver = Platform.OS !== 'web';
const swayEase = Easing.inOut(Easing.sin);
const tapEase = Easing.inOut(Easing.quad);

const INK = BAO_INK;
const GROUND = BAO_GROUND;

export function SupperKaki({ ask = false, onAsk }: { ask?: boolean; onAsk?: () => void } = {}) {
  const reduced = useReducedMotion();
  const sway = useRef(new Animated.Value(0)).current;
  const blink = useRef(new Animated.Value(1)).current;
  const squash = useRef(new Animated.Value(0)).current;
  const [hello, setHello] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const tapAnim = useRef<Animated.CompositeAnimation | undefined>(undefined);

  useEffect(() => {
    const stops: Array<() => void> = [];
    sway.setValue(0);
    blink.setValue(1);
    squash.setValue(0);
    if (!reduced) {
      const swayLoop = Animated.loop(Animated.sequence([
        Animated.timing(sway, { toValue: 1, duration: 1600, easing: swayEase, useNativeDriver: nativeDriver }),
        Animated.timing(sway, { toValue: -1, duration: 3200, easing: swayEase, useNativeDriver: nativeDriver }),
        Animated.timing(sway, { toValue: 0, duration: 1600, easing: swayEase, useNativeDriver: nativeDriver }),
      ]));
      swayLoop.start();
      stops.push(() => swayLoop.stop());
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
  }, [reduced, sway, blink, squash]);

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
      timer.current = setTimeout(settle, 1800);
      return;
    }
    squash.setValue(0);
    const tap = Animated.parallel([
      Animated.sequence([
        Animated.timing(squash, { toValue: 1, duration: 130, easing: tapEase, useNativeDriver: nativeDriver }),
        Animated.timing(squash, { toValue: 0, duration: 210, easing: tapEase, useNativeDriver: nativeDriver }),
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
      <Animated.View style={[s.sway, { transform: [{ translateX: swayX }, { translateY: 52 }, { rotate: swayRot }, { translateY: -52 }] }]}>
        <Animated.View style={[s.squash, { transform: [{ translateY: 59 }, { scaleX }, { scaleY }, { translateY: -59 }] }]}>
          <View style={s.clip}>
            <Svg width={120} height={140} viewBox="0 0 120 140">
              <BaoApple />
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
    </Pressable>
    <Text style={[s.hint, ask && s.held]} accessibilityElementsHidden={ask}>{onAsk ? 'tap to ask' : 'tap me'}</Text>
  </View>;
}

function closeEyes(blink: Animated.Value) {
  return Animated.sequence([
    Animated.timing(blink, { toValue: 0.08, duration: 80, easing: tapEase, useNativeDriver: nativeDriver }),
    Animated.timing(blink, { toValue: 1, duration: 110, easing: tapEase, useNativeDriver: nativeDriver }),
  ]);
}

const s = StyleSheet.create({
  stage: { width: 150, minWidth: 150, maxWidth: 150, alignItems: 'center' },
  held: { opacity: 0 },
  bubbleWrap: { alignItems: 'center', marginBottom: 4 },
  bubble: { fontSize: 12, fontWeight: '800', color: colors.ink, backgroundColor: 'white', paddingHorizontal: 11, paddingVertical: 8, borderRadius: 16 },
  bubbleTail: { width: 10, height: 10, backgroundColor: 'white', transform: [{ rotate: '45deg' }], marginTop: -6 },
  art: { width: 150, height: 144, alignItems: 'center' },
  ground: { position: 'absolute', bottom: 1, width: 100, height: 13, borderRadius: 8, backgroundColor: GROUND },
  sway: { position: 'absolute', left: 15, top: 0, width: 120, height: 124, alignItems: 'center' },
  squash: { width: 120, height: 140 },
  clip: { width: 120, height: 140, overflow: 'hidden' },
  dot: { position: 'absolute', top: 64, width: 5.5, height: 5.5, borderRadius: 3, backgroundColor: INK },
  dotLeft: { left: 43 },
  dotRight: { left: 67 },
  hint: { fontSize: 10, color: colors.muted, marginTop: 2, fontWeight: '700' },
});

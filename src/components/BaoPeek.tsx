import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MutableRefObject, type RefObject } from 'react';
import { Animated, Easing, GestureResponderEvent, PanResponder, PanResponderGestureState, Platform, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Ellipse, Path, Rect } from 'react-native-svg';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { BaoAskPanel } from './BaoAsk';
import { BAO_BODY, BAO_CHEEK, BAO_CREAM, BAO_INK, BAO_PLEATS, BAO_STEAMER } from './baoArt';
import {
  alongForDrop,
  askShiftForGrowth,
  askTowardForPeek,
  baoPeekArt,
  baoPeekMarks,
  clearBaoDragBlocking,
  initialPeekChoice,
  nearestPeekEdge,
  peekDragFrame,
  peekLookProgress,
  peekPointerKind,
  placeBaoAsk,
  projectPeekPoint,
  resolvePeekLayout,
  setBaoDragBlocking,
  writePeekChoice,
  type PeekChoice,
  type PeekLayout,
  type PeekSide,
} from './baoPeekLogic';

const nativeDriver = Platform.OS !== 'web';
const swayEase = Easing.inOut(Easing.sin);
const grabSize = 44;
const dropRingSize = 84;

type ColumnBox = { x: number; y: number; width: number; height: number };

/** Last real column size. A tab remount can place a saved `along` on the first paint. */
let parkedColumn = { width: 0, height: 0 };

/**
 * Bao looks in from a screen edge when a tab opens.
 * Parked, only a small face handle takes presses. A tap opens a question bubble, or calls `onTap` with the tap point
 * when the host screen opens its own menu; a drag follows the pointer to another edge.
 */
export function BaoPeek({ side: forced, onTap, dropTargetRef, dropping, over }: {
  side?: PeekSide;
  onTap?: (point: { x: number; y: number }) => void;
  /** Gets Bao's face in page coordinates, so a post dragged from the feed can be dropped on Bao. */
  dropTargetRef?: MutableRefObject<{ x: number; y: number } | undefined>;
  dropping?: boolean;
  over?: boolean;
}) {
  const [choice, setChoice] = useState<PeekChoice>(() => initialPeekChoice(forced));
  const [skipIntro, setSkipIntro] = useState(false);
  const [asking, setAsking] = useState(false);
  const [holding, setHolding] = useState(false);
  const [askExtra, setAskExtra] = useState(0);
  const [column, setColumn] = useState(parkedColumn);
  const reduced = useReducedMotion();
  const columnRef = useRef<View>(null);
  const columnBox = useRef<ColumnBox>({ x: 0, y: 0, width: parkedColumn.width, height: parkedColumn.height });
  const layout = useMemo(() => resolvePeekLayout(choice, column), [choice, column]);
  const faceLocal = layout && column.width > 2 && column.height > 2 ? projectPeekPoint(layout, column, baoPeekMarks.face, 'settle') : undefined;
  const publishTarget = () => {
    if (!dropTargetRef) return;
    const box = columnBox.current;
    dropTargetRef.current = faceLocal && box.width > 1 ? { x: box.x + faceLocal.x, y: box.y + faceLocal.y } : undefined;
  };
  publishTarget();
  useEffect(() => () => { if (dropTargetRef) dropTargetRef.current = undefined; }, [dropTargetRef]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return () => clearBaoDragBlocking();
    const id = 'bao-peek-pointer';
    let style = document.getElementById(id) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement('style');
      style.id = id;
      document.head.appendChild(style);
    }
    style.textContent = [
      '[data-testid="bao-peek"], [data-testid="bao-peek"] * { pointer-events: none !important; }',
      '[data-testid="bao-peek"] [data-testid="bao-peek-shield"] { pointer-events: auto !important; }',
      '[data-testid="bao-peek"] [data-testid="bao-peek-grab"], [data-testid="bao-peek"] [data-testid="bao-peek-grab"] * { pointer-events: auto !important; cursor: grab; }',
      '[data-testid="bao-peek"] [data-testid="bao-peek-dragging"], [data-testid="bao-peek"] [data-testid="bao-peek-dragging"] * { pointer-events: auto !important; cursor: grabbing; }',
      '[data-testid="bao-peek"] [data-testid="bao-ask-dismiss"] { pointer-events: auto !important; }',
      '[data-testid="bao-peek"] [data-testid="bao-ask"], [data-testid="bao-peek"] [data-testid="bao-ask"] * { pointer-events: auto !important; }',
    ].join('\n');
    return () => clearBaoDragBlocking();
  }, []);

  const dropAt = (point: { x: number; y: number }, box: ColumnBox) => {
    if (box.width < 2 || box.height < 2) return;
    const side = nearestPeekEdge(point, box);
    const next = { side, along: alongForDrop(side, point, box) };
    writePeekChoice(next);
    setChoice(next);
    setSkipIntro(true);
  };

  const askPlace = layout && column.width > 2 && column.height > 2
    ? placeBaoAsk(projectPeekPoint(layout, column, baoPeekMarks.face, 'settle'), askTowardForPeek(layout.side), column)
    : undefined;
  const askShift = askPlace ? askShiftForGrowth(askPlace, column, askExtra) : 0;
  const closeAsk = () => {
    setAskExtra(0);
    setAsking(false);
  };

  return (
    <View pointerEvents="box-none" testID="bao-peek" style={styles.overlay}>
      {holding ? <View testID="bao-peek-shield" pointerEvents="auto" style={styles.shield} /> : null}
      <View
        ref={columnRef}
        pointerEvents="box-none"
        collapsable={false}
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          if (width < 2 || height < 2) return;
          parkedColumn = { width, height };
          setColumn((current) => current.width === width && current.height === height ? current : { width, height });
          columnRef.current?.measureInWindow((x, y, measuredWidth, measuredHeight) => {
            columnBox.current = { x, y, width: measuredWidth || width, height: measuredHeight || height };
            publishTarget();
          });
        }}
        style={styles.column}
      >
        {asking ? <Pressable accessibilityLabel="Close ask Bao" testID="bao-ask-dismiss" onPress={closeAsk} style={styles.dismiss} /> : null}
        {layout ? (
          <PeekSprite
            layout={layout}
            reduced={reduced}
            instant={skipIntro}
            asking={asking}
            columnRef={columnRef}
            columnBox={columnBox}
            onDrop={dropAt}
            tapLabel={onTap ? 'Jio with Bao, or drag Bao to another edge' : undefined}
            onAsk={(point) => {
              if (onTap) {
                onTap(point);
                return;
              }
              setAskExtra(0);
              setAsking((open) => !open);
            }}
            onDragStart={closeAsk}
            onHold={setHolding}
          />
        ) : null}
        {dropping && faceLocal ? <View pointerEvents="none" testID="bao-drop-ring" style={[styles.dropRing, over && styles.dropRingOver, { left: faceLocal.x - dropRingSize / 2, top: faceLocal.y - dropRingSize / 2 }]} /> : null}
        {asking && askPlace ? (
          <View pointerEvents="box-none" style={[styles.ask, { left: askPlace.left, top: askPlace.top - askShift }]}>
            <BaoAskPanel tail={askPlace.tail} onExtra={setAskExtra} onClose={closeAsk} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

function pageOf(event: GestureResponderEvent, gesture: PanResponderGestureState) {
  const native = event.nativeEvent as { pageX?: number; pageY?: number };
  return {
    pageX: typeof native.pageX === 'number' ? native.pageX : gesture.moveX,
    pageY: typeof native.pageY === 'number' ? native.pageY : gesture.moveY,
  };
}

function capturePointer(event: GestureResponderEvent) {
  const native = event.nativeEvent as { pointerId?: number; target?: { setPointerCapture?: (id: number) => void } | null };
  if (native.target && typeof native.target.setPointerCapture === 'function' && typeof native.pointerId === 'number') {
    try { native.target.setPointerCapture(native.pointerId); } catch { /* the shield still covers the deck */ }
  }
}

function PeekSprite({ layout, reduced, instant, asking, tapLabel, columnRef, columnBox, onDrop, onAsk, onDragStart, onHold }: {
  layout: PeekLayout;
  reduced: boolean;
  instant: boolean;
  asking: boolean;
  tapLabel?: string;
  columnRef: RefObject<View | null>;
  columnBox: MutableRefObject<ColumnBox>;
  onDrop: (point: { x: number; y: number }, box: ColumnBox) => void;
  onAsk: (point: { x: number; y: number }) => void;
  onDragStart: () => void;
  onHold: (held: boolean) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const draggingRef = useRef(false);
  const progress = useRef(new Animated.Value(0)).current;
  const idle = useRef(new Animated.Value(0)).current;
  const blink = useRef(new Animated.Value(1)).current;
  const still = useRef(new Animated.Value(0)).current;
  const dragLeft = useRef(new Animated.Value(0)).current;
  const dragTop = useRef(new Animated.Value(0)).current;
  const dragRotate = useRef(new Animated.Value(0)).current;
  const pointer = useRef({ pageX: 0, pageY: 0 });
  const onDropRef = useRef(onDrop);
  const onAskRef = useRef(onAsk);
  const onDragRef = useRef(onDragStart);
  const onHoldRef = useRef(onHold);
  onDropRef.current = onDrop;
  onAskRef.current = onAsk;
  onDragRef.current = onDragStart;
  onHoldRef.current = onHold;

  const gesture = useMemo(() => {
    const follow = () => {
      const box = columnBox.current;
      if (box.width < 2 || box.height < 2) return;
      const point = { x: pointer.current.pageX - box.x, y: pointer.current.pageY - box.y };
      const frame = peekDragFrame(nearestPeekEdge(point, box), point);
      dragLeft.setValue(frame.left);
      dragTop.setValue(frame.top);
      dragRotate.setValue(frame.rotate);
      if (!draggingRef.current) {
        draggingRef.current = true;
        setDragging(true);
      }
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: (event, pan) => {
        setBaoDragBlocking(true);
        onHoldRef.current(true);
        capturePointer(event);
        pointer.current = pageOf(event, pan);
        columnRef.current?.measureInWindow((x, y, width, height) => {
          if (width > 0 && height > 0) columnBox.current = { x, y, width, height };
          if (draggingRef.current) follow();
        });
      },
      onPanResponderMove: (event, pan) => {
        pointer.current = pageOf(event, pan);
        if (!draggingRef.current && peekPointerKind(pan.dx, pan.dy) !== 'drag') return;
        if (!draggingRef.current) onDragRef.current();
        follow();
      },
      onPanResponderRelease: (event, pan) => {
        pointer.current = pageOf(event, pan);
        const dragged = draggingRef.current || peekPointerKind(pan.dx, pan.dy) === 'drag';
        draggingRef.current = false;
        setDragging(false);
        setBaoDragBlocking(false);
        onHoldRef.current(false);
        if (!dragged) {
          onAskRef.current({ x: pointer.current.pageX, y: pointer.current.pageY });
          return;
        }
        const box = columnBox.current;
        onDropRef.current({ x: pointer.current.pageX - box.x, y: pointer.current.pageY - box.y }, box);
      },
      onPanResponderTerminate: () => {
        draggingRef.current = false;
        setDragging(false);
        setBaoDragBlocking(false);
        onHoldRef.current(false);
      },
    });
  }, [columnBox, columnRef, dragLeft, dragRotate, dragTop]);

  useLayoutEffect(() => {
    if (dragging) {
      blink.setValue(1);
      return;
    }
    progress.setValue(reduced || instant ? 1 : 0);
    idle.setValue(0);
    blink.setValue(1);
    if (reduced) return;
    const enter = instant ? null : Animated.sequence([
      Animated.timing(progress, { toValue: peekLookProgress, duration: 560, easing: Easing.out(Easing.cubic), useNativeDriver: nativeDriver }),
      Animated.timing(progress, { toValue: 1, duration: 380, easing: Easing.inOut(Easing.quad), useNativeDriver: nativeDriver }),
    ]);
    const bob = Animated.loop(Animated.sequence([
      Animated.timing(idle, { toValue: 1, duration: 1700, easing: swayEase, useNativeDriver: nativeDriver }),
      Animated.timing(idle, { toValue: -1, duration: 1700, easing: swayEase, useNativeDriver: nativeDriver }),
    ]));
    const eyes = Animated.loop(Animated.sequence([
      Animated.delay(2400),
      Animated.timing(blink, { toValue: 0.12, duration: 80, easing: Easing.inOut(Easing.quad), useNativeDriver: nativeDriver }),
      Animated.timing(blink, { toValue: 1, duration: 110, easing: Easing.inOut(Easing.quad), useNativeDriver: nativeDriver }),
    ]));
    enter?.start();
    const idleTimer = setTimeout(() => bob.start(), instant ? 0 : 980);
    eyes.start();
    return () => {
      enter?.stop();
      bob.stop();
      eyes.stop();
      clearTimeout(idleTimer);
    };
  }, [blink, dragging, idle, instant, layout.side, progress, reduced]);

  const shift = progress.interpolate({
    inputRange: [0, 1, peekLookProgress],
    outputRange: [layout.hiddenShift, layout.settleShift, layout.lookShift],
  });
  const rotate = progress.interpolate({
    inputRange: [0, 1, peekLookProgress],
    outputRange: [`${layout.hiddenRotate}deg`, `${layout.settleRotate}deg`, `${layout.lookRotate}deg`],
  });
  const bob = idle.interpolate({ inputRange: [-1, 1], outputRange: [-2, 2] });
  const shiftX = layout.shiftAxis === 'x' ? shift : layout.bobAxis === 'x' ? bob : still;
  const shiftY = layout.shiftAxis === 'y' ? shift : layout.bobAxis === 'y' ? bob : still;
  const cx = baoPeekArt.width / 2;
  const cy = baoPeekArt.height / 2;
  const dragSpin = dragRotate.interpolate({ inputRange: [-180, 180], outputRange: ['-180deg', '180deg'] });

  return (
    <Animated.View
      pointerEvents={dragging ? 'auto' : 'box-none'}
      testID={dragging ? 'bao-peek-dragging' : `bao-peek-${layout.side}`}
      style={[
        styles.art,
        dragging ? { left: dragLeft, top: dragTop } : layout.anchor,
        {
          transformOrigin: '0px 0px',
          transform: dragging
            ? [{ translateX: cx }, { translateY: cy }, { rotate: dragSpin }, { translateX: -cx }, { translateY: -cy }]
            : [{ translateX: shiftX }, { translateY: shiftY }, { translateX: cx }, { translateY: cy }, { rotate }, { translateX: -cx }, { translateY: -cy }],
        },
      ]}
    >
      <SteamerBaoMark blink={blink} />
      <View
        testID="bao-peek-grab"
        pointerEvents="auto"
        accessibilityRole="button"
        accessibilityLabel={asking ? 'Close ask Bao' : tapLabel ?? 'Ask Bao, or drag Bao to another edge'}
        {...gesture.panHandlers}
        style={styles.grab}
      />
    </Animated.View>
  );
}

function SteamerBaoMark({ blink }: { blink: Animated.Value }) {
  const { width, height } = baoPeekArt;
  const sx = width / 120;
  const sy = height / 140;
  const eye = Math.max(3.5, 5.5 * sx);
  return (
    <View pointerEvents="none" importantForAccessibility="no-hide-descendants" style={{ width, height }}>
      <Svg pointerEvents="none" width={width} height={height} viewBox="0 0 120 140">
        <Path d={BAO_BODY} fill={BAO_CREAM} />
        <Ellipse cx={32} cy={76} rx={11} ry={7} fill={BAO_CHEEK} />
        <Ellipse cx={84} cy={76} rx={11} ry={7} fill={BAO_CHEEK} />
        <Path d={BAO_BODY} fill="none" stroke={BAO_INK} strokeWidth={4.5} strokeLinejoin="round" strokeLinecap="round" />
        <Path d={BAO_PLEATS} fill="none" stroke={BAO_INK} strokeWidth={2.6} strokeLinecap="round" />
        <Path d="M52 80 Q58 86 64 80" fill="none" stroke={BAO_INK} strokeWidth={2.4} strokeLinecap="round" />
        <Rect x={16} y={106} width={88} height={20} rx={6} fill={BAO_STEAMER} stroke={BAO_INK} strokeWidth={3} />
        <Path d="M28 116 H92" stroke={BAO_INK} strokeWidth={2.4} strokeLinecap="round" />
      </Svg>
      <Animated.View pointerEvents="none" style={[styles.eye, { width: eye, height: eye, borderRadius: eye, left: 43 * sx, top: 64 * sy, transform: [{ scaleY: blink }] }]} />
      <Animated.View pointerEvents="none" style={[styles.eye, { width: eye, height: eye, borderRadius: eye, left: 67 * sx, top: 64 * sy, transform: [{ scaleY: blink }] }]} />
      <View pointerEvents="none" style={[styles.steam, styles.steamLeft]} />
      <View pointerEvents="none" style={[styles.steam, styles.steamRight]} />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 6,
    alignItems: 'center',
  },
  shield: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 1 },
  column: {
    width: '100%',
    maxWidth: 720,
    height: '100%',
    alignSelf: 'center',
    position: 'relative',
    overflow: 'hidden',
    zIndex: 2,
  },
  dismiss: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 1 },
  art: { position: 'absolute', width: baoPeekArt.width, height: baoPeekArt.height, zIndex: 2 },
  ask: { position: 'absolute', zIndex: 3, width: 220 },
  grab: {
    position: 'absolute',
    width: grabSize,
    height: grabSize,
    borderRadius: grabSize / 2,
    left: baoPeekMarks.face.x - grabSize / 2,
    top: baoPeekMarks.face.y - grabSize / 2,
    zIndex: 2,
    ...(Platform.OS === 'web' ? { touchAction: 'none' } as object : {}),
  },
  dropRing: { position: 'absolute', width: dropRingSize, height: dropRingSize, borderRadius: dropRingSize / 2, borderWidth: 3, borderStyle: 'dashed', borderColor: '#E5D94A', backgroundColor: 'rgba(255,233,0,0.18)', zIndex: 3 },
  dropRingOver: { borderStyle: 'solid', borderColor: '#FFE900', backgroundColor: 'rgba(255,233,0,0.45)', transform: [{ scale: 1.25 }] },
  eye: { position: 'absolute', backgroundColor: BAO_INK },
  steam: {
    position: 'absolute',
    top: 0,
    width: 6,
    height: 10,
    borderLeftWidth: 2,
    borderColor: BAO_CREAM,
    borderRadius: 8,
  },
  steamLeft: { left: 22, opacity: 0.9, transform: [{ rotate: '16deg' }] },
  steamRight: { right: 22, opacity: 0.9, transform: [{ rotate: '-16deg' }] },
});

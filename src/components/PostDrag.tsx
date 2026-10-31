import { ReactNode, RefObject, useEffect, useRef, useState } from 'react';
import { Animated, GestureResponderEvent, Image, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { Post } from '../data/feedPosts';

type Point = { x: number; y: number };
export type PostDragControls = {
  start: (post: Post, point: Point) => void;
  move: (point: Point) => void;
  end: () => void;
  cancel: () => void;
};
export type DropNoticeState = { text: string; view?: boolean };

const dragThreshold = 8;
const dropRadius = 64;
const ghost = { width: 132, photo: 72, height: 98 };
// A mouse drags straight away. A finger holds first, or it could never scroll the feed.
const mouse = typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: fine)').matches;
const pagePoint = (event: GestureResponderEvent) => ({ x: event.nativeEvent.pageX, y: event.nativeEvent.pageY });

export function usePostDrag(target: RefObject<Point | undefined>, onDrop: (post: Post) => void) {
  const [post, setPost] = useState<Post>();
  const [over, setOver] = useState(false);
  const point = useRef(new Animated.ValueXY()).current;
  const dragging = useRef<Post | undefined>(undefined);
  const hovering = useRef(false);
  const place = (next: Point) => {
    // Above the pointer, so neither a finger nor Bao hides the restaurant name.
    point.setValue({ x: next.x - ghost.width / 2, y: next.y - ghost.height - 44 });
    const center = target.current;
    const inside = !!center && Math.hypot(next.x - center.x, next.y - center.y) < dropRadius;
    if (inside !== hovering.current) { hovering.current = inside; setOver(inside); }
  };
  const stop = () => { dragging.current = undefined; hovering.current = false; setPost(undefined); setOver(false); };
  const controls: PostDragControls = {
    start: (next, at) => { dragging.current = next; setPost(next); place(at); },
    move: place,
    end: () => { const dropped = hovering.current ? dragging.current : undefined; stop(); if (dropped) onDrop(dropped); },
    cancel: stop,
  };
  return { post, over, point, controls };
}

export function DraggablePost({ post, drag, label, onOpen, children }: { post: Post; drag: PostDragControls; label: string; onOpen: () => void; children: ReactNode }) {
  const live = useRef({ post, drag, onOpen });
  live.current = { post, drag, onOpen };
  const held = useRef(false);
  const moved = useRef(false);
  // The browser still fires a click when a drag ends. It must not open the post.
  const reset = () => { setTimeout(() => { held.current = false; moved.current = false; }, 100); };
  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_, gesture) => {
      if (held.current || (mouse && Math.abs(gesture.dx) + Math.abs(gesture.dy) > dragThreshold)) moved.current = true;
      return moved.current;
    },
    onPanResponderGrant: event => { if (!held.current) live.current.drag.start(live.current.post, pagePoint(event)); },
    onPanResponderMove: event => live.current.drag.move(pagePoint(event)),
    onPanResponderRelease: () => { live.current.drag.end(); reset(); },
    onPanResponderTerminate: () => { live.current.drag.cancel(); reset(); },
    onPanResponderTerminationRequest: () => false,
  })).current;
  return <View {...pan.panHandlers} style={styles.grab}>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      delayLongPress={250}
      onLongPress={event => { held.current = true; drag.start(post, pagePoint(event)); }}
      onPressOut={() => { if (held.current && !moved.current) { drag.cancel(); held.current = false; onOpen(); } }}
      onPress={() => { if (!moved.current) onOpen(); }}
      style={({ pressed }) => [styles.link, pressed && styles.pressed]}
    >{children}</Pressable>
  </View>;
}

export function PostDragGhost({ post, point }: { post?: Post; point: Animated.ValueXY }) {
  if (!post) return null;
  return <Animated.View pointerEvents="none" style={[styles.ghost, { transform: [...point.getTranslateTransform(), { rotate: '-3deg' }] }]}>
    {post.image ? <Image source={post.image} resizeMode="cover" style={styles.ghostPhoto} /> : <View style={[styles.ghostPhoto, { backgroundColor: post.tint }]} />}
    <Text numberOfLines={1} style={styles.ghostText}>{post.place?.name ?? 'No restaurant on this post'}</Text>
  </Animated.View>;
}

export function DropNotice({ notice, onView, onDone }: { notice?: DropNoticeState; onView: () => void; onDone: () => void }) {
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(onDone, 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  if (!notice) return null;
  return <View accessibilityLiveRegion="polite" style={styles.notice}>
    <Text numberOfLines={2} style={styles.noticeText}>{notice.text}</Text>
    {notice.view ? <Pressable accessibilityRole="button" accessibilityLabel="View the party swipe" onPress={onView} hitSlop={8}><Text style={styles.noticeAction}>View</Text></Pressable> : null}
  </View>;
}

const styles = StyleSheet.create({
  grab: { userSelect: 'none', WebkitTouchCallout: 'none' } as object,
  link: { gap: 6 },
  pressed: { opacity: 0.65 },
  ghost: { position: 'absolute', left: 0, top: 0, width: ghost.width, height: ghost.height, zIndex: 69, elevation: 7, borderRadius: 12, overflow: 'hidden', backgroundColor: '#FFFFFF', shadowColor: '#000000', shadowOpacity: 0.28, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  ghostPhoto: { height: ghost.photo, width: '100%', backgroundColor: '#EEEEEE' },
  ghostText: { color: '#161616', fontSize: 11, lineHeight: 14, fontWeight: '800', paddingHorizontal: 8, paddingTop: 6 },
  notice: { position: 'absolute', top: 112, alignSelf: 'center', width: '92%', maxWidth: 420, zIndex: 90, elevation: 12, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#161616', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11 },
  noticeText: { flex: 1, color: '#FFFFFF', fontSize: 13, lineHeight: 18, fontWeight: '700' },
  noticeAction: { color: '#FFE900', fontSize: 13, fontWeight: '900' },
});

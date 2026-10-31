import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { BAO_CREAM, BAO_INK, BAO_STEAMER } from './baoArt';
import { baoAskPanel, type AskTail } from './baoPeek';
import { colors } from '../theme';
import { PartyPulse } from './PartyPulse';
import { SoftCross } from './Ui';

const KEEP_OPEN = '[data-testid="bao-ask"], [data-testid="bao-peek-grab"], [data-testid="home-bao"]';

/** Tap outside the bubble or Bao closes the ask. Bao and the field itself stay put. */
function useAskOutsideClose(onClose: () => void) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const onPointerDown = (event: PointerEvent) => {
      const raw = event.target;
      const element = raw instanceof Element ? raw : raw instanceof Node ? raw.parentElement : null;
      if (element?.closest(KEEP_OPEN)) return;
      event.preventDefault();
      event.stopPropagation();
      closeRef.current();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, []);
}

/**
 * Small steamer speech bubble. The question stays on this screen; nothing is sent.
 */
export function BaoAskPanel({ onClose, tail, width, onExtra }: { onClose: () => void; tail: AskTail; width?: number; onExtra?: (extra: number) => void }) {
  const [draft, setDraft] = useState('');
  useAskOutsideClose(onClose);
  return (
    <View testID="bao-ask" accessibilityLabel="Ask Bao" style={[styles.panel, width ? { width } : null]}>
      <View pointerEvents="none" style={styles.rim}><View style={styles.slat} /></View>
      <View style={styles.head}>
        <Text style={styles.title}>Ask me anything!</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" testID="bao-ask-close" onPress={onClose} style={({ pressed }) => [styles.close, pressed && styles.closePressed]}>
          <SoftCross size={12} stroke={2.4} />
        </Pressable>
      </View>
      <TextInput
        accessibilityLabel="Question for Bao"
        testID="bao-ask-input"
        value={draft}
        onChangeText={setDraft}
        placeholder="A craving, a place, a plan…"
        placeholderTextColor={colors.muted}
        style={styles.input}
      />
      <Text style={styles.note}>On this screen only. Bao is not online yet.</Text>
      <PartyPulse onExtra={onExtra} />
      <AskTail tail={tail} />
    </View>
  );
}

function AskTail({ tail }: { tail: AskTail }) {
  const clear = 'transparent';
  const point = tail === 'left'
    ? { left: -9, top: 46, borderTopWidth: 7, borderBottomWidth: 7, borderRightWidth: 10, borderTopColor: clear, borderBottomColor: clear, borderRightColor: BAO_CREAM }
    : tail === 'right'
      ? { right: -9, top: 46, borderTopWidth: 7, borderBottomWidth: 7, borderLeftWidth: 10, borderTopColor: clear, borderBottomColor: clear, borderLeftColor: BAO_CREAM }
      : tail === 'top'
        ? { top: -9, left: 28, borderLeftWidth: 7, borderRightWidth: 7, borderBottomWidth: 10, borderLeftColor: clear, borderRightColor: clear, borderBottomColor: BAO_CREAM }
        : { bottom: -9, left: 28, borderLeftWidth: 7, borderRightWidth: 7, borderTopWidth: 10, borderLeftColor: clear, borderRightColor: clear, borderTopColor: BAO_CREAM };
  return <View pointerEvents="none" style={[styles.tail, point]} />;
}

const styles = StyleSheet.create({
  panel: {
    width: baoAskPanel.width,
    minHeight: baoAskPanel.height,
    backgroundColor: BAO_CREAM,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: BAO_INK,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 8,
  },
  rim: {
    height: 10,
    borderRadius: 6,
    backgroundColor: BAO_STEAMER,
    borderWidth: 2,
    borderColor: BAO_INK,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slat: { width: '78%', height: 2, borderRadius: 1, backgroundColor: BAO_INK, opacity: 0.85 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, color: BAO_INK, fontSize: 15, lineHeight: 19, fontWeight: '900' },
  close: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.rejectSoft,
    borderWidth: 1,
    borderColor: colors.rejectLine,
  },
  closePressed: { backgroundColor: colors.rejectPressed },
  input: {
    minHeight: 36,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.limeLine,
    backgroundColor: colors.card,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: colors.ink,
    fontSize: 14,
    fontWeight: '600',
  },
  note: { color: colors.muted, fontSize: 11, lineHeight: 15, fontWeight: '700' },
  tail: { position: 'absolute', width: 0, height: 0 },
});

import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSwipes } from '../hooks/useSwipes';
import { useOuting } from '../hooks/useOuting';
import { PlanDraft } from '../types';
import { BAO_INK, BAO_STEAMER } from './baoArt';
import { buildPartyPulse, pulseDeckFromSwipes, type PartyPulseModel, type PulsePhase } from './partyPulse';
import { colors } from '../theme';

/** Collapsed row under Ask me anything. Expands to the party roster and any swipe progress we actually have. */
export function PartyPulse({ onExtra }: { onExtra?: (extra: number) => void }) {
  const { plan, loaded } = useOuting();
  if (!plan?.participants.length) return <PulseList model={buildPartyPulse(plan, null, loaded ? 'ready' : 'loading')} onExtra={onExtra} />;
  return <LivePartyPulse plan={plan} onExtra={onExtra} />;
}

function LivePartyPulse({ plan, onExtra }: { plan: PlanDraft; onExtra?: (extra: number) => void }) {
  const voting = useSwipes(plan);
  const phase: PulsePhase = voting.loaded ? 'ready' : voting.error ? 'unavailable' : 'loading';
  const model = buildPartyPulse(plan, phase === 'ready' ? pulseDeckFromSwipes(voting.state) : null, phase);
  return <PulseList model={model} onExtra={onExtra} />;
}

function PulseList({ model, onExtra }: { model: PartyPulseModel; onExtra?: (extra: number) => void }) {
  const [open, setOpen] = useState(false);
  const base = useRef(0);
  const reported = useRef(-1);
  const report = (extra: number) => {
    if (reported.current === extra) return;
    reported.current = extra;
    onExtra?.(extra);
  };

  useEffect(() => {
    if (!open) report(0);
  }, [open]);

  const scroll = model.people.length > 4;
  return (
    <View
      testID="party-pulse"
      onLayout={(event) => {
        const height = event.nativeEvent.layout.height;
        if (!open) {
          base.current = height;
          report(0);
          return;
        }
        if (base.current > 0) report(Math.max(0, Math.round(height - base.current)));
      }}
      style={styles.wrap}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Party pulse, ${model.summary}`}
        accessibilityState={{ expanded: open }}
        testID="party-pulse-toggle"
        onPress={() => setOpen((value) => !value)}
        style={({ pressed }) => [styles.toggle, pressed && styles.togglePressed]}
      >
        <View style={styles.copy}>
          <Text style={styles.title}>Party pulse</Text>
          <Text numberOfLines={2} style={styles.summary}>{model.summary}</Text>
        </View>
        <View style={styles.chevron}><Text style={styles.chevronText}>{open ? '−' : '⌄'}</Text></View>
      </Pressable>
      {open ? (
        <View testID="party-pulse-list" style={styles.list}>
          {scroll ? (
            <ScrollView style={styles.scroll} nestedScrollEnabled keyboardShouldPersistTaps="handled">
              {model.people.map((person) => <PersonRow key={person.id} person={person} />)}
            </ScrollView>
          ) : model.people.length ? model.people.map((person) => <PersonRow key={person.id} person={person} />) : (
            <Text style={styles.empty}>No one in a party yet.</Text>
          )}
          <Text style={styles.note}>{model.note}</Text>
        </View>
      ) : null}
    </View>
  );
}

function PersonRow({ person }: { person: PartyPulseModel['people'][number] }) {
  const initial = person.name.trim().charAt(0).toUpperCase() || '?';
  return (
    <View accessibilityLabel={`${person.name}${person.you ? ', you' : ''}, ${person.label}`} style={styles.person}>
      <View style={styles.mark}><Text style={styles.initial}>{initial}</Text></View>
      <View style={styles.copy}>
        <Text numberOfLines={1} style={styles.name}>{person.name}{person.you ? ' · you' : ''}</Text>
        <Text numberOfLines={1} style={styles.label}>{person.label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  toggle: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.limeLine,
    backgroundColor: colors.card,
    paddingHorizontal: 8,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  togglePressed: { backgroundColor: colors.lime },
  copy: { flex: 1, minWidth: 0 },
  title: { color: BAO_INK, fontSize: 13, lineHeight: 16, fontWeight: '900' },
  summary: { color: colors.muted, fontSize: 11, lineHeight: 14, fontWeight: '700', marginTop: 1 },
  chevron: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BAO_STEAMER,
    borderWidth: 1,
    borderColor: colors.limeLine,
  },
  chevronText: { color: BAO_INK, fontSize: 14, lineHeight: 16, fontWeight: '900', marginTop: -1 },
  list: {
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.limeLine,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 6,
  },
  scroll: { maxHeight: 148 },
  empty: { color: colors.muted, fontSize: 12, lineHeight: 16, fontWeight: '700' },
  person: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 32 },
  mark: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BAO_STEAMER,
    borderWidth: 1,
    borderColor: BAO_INK,
  },
  initial: { color: BAO_INK, fontSize: 12, fontWeight: '900' },
  name: { color: BAO_INK, fontSize: 13, lineHeight: 16, fontWeight: '800' },
  label: { color: colors.muted, fontSize: 11, lineHeight: 14, fontWeight: '700' },
  note: { color: colors.muted, fontSize: 10, lineHeight: 13, fontWeight: '700' },
});

import { ReactNode, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { GeoLocation } from '../types';
import { searchLocations } from '../data/travelProvider';
import { Button } from './Ui';
import { colors } from '../theme';

/** Shared chrome for the current-location and type-a-location choices. */
export const locationChoiceBlock = {
  flex: 1,
  minWidth: 0,
  minHeight: 118,
  backgroundColor: colors.lime,
  borderRadius: 18,
  padding: 12,
  justifyContent: 'center' as const,
  gap: 8,
};

export function LocationPicker({ value, onChange, label, initialQuery = '', compact=false, aside }: { value?: GeoLocation; onChange: (location: GeoLocation) => void; label: string; initialQuery?: string; compact?:boolean; aside?: ReactNode }) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<GeoLocation[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const version = useRef(0);
  const controller = useRef<AbortController | undefined>(undefined);
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => { version.current++; controller.current?.abort(); clearTimeout(debounce.current); }, []);
  const search = async (text = query) => {
    clearTimeout(debounce.current);
    controller.current?.abort();
    controller.current = new AbortController();
    const current = ++version.current;
    setBusy(true); setError(''); setResults([]);
    try {
      const locations = await searchLocations(text.trim(), controller.current.signal);
      if (current !== version.current) return;
      setResults(locations);
      if (!locations.length) setError('No matches. Try the street address or postal code.');
    } catch (cause) { if (current === version.current) setError(cause instanceof Error ? cause.message : 'Search failed. Please retry.'); }
    finally { if (current === version.current) setBusy(false); }
  };
  const field = <>
    <Text style={aside ? styles.choiceLabel : styles.label}>{label}</Text>
    {!aside && value ? <Text style={styles.saved}>✓ {value.label}</Text> : null}
    <TextInput accessibilityLabel={label} value={query} onChangeText={(text) => { version.current++; controller.current?.abort(); clearTimeout(debounce.current); setBusy(false); setError(text.trim().length>=2?'Searching shortly…':''); setResults([]); setQuery(text); if(text.trim().length>=2)debounce.current=setTimeout(()=>void search(text),300); }} onSubmitEditing={() => { if (query.trim().length >= 2 && !busy) void search(); }} returnKeyType="search" placeholder="Address, postal code, or MRT station" placeholderTextColor={colors.muted} style={aside ? styles.choiceInput : styles.input} />
  </>;
  return <View style={[styles.wrap, aside ? styles.wrapAside : undefined]}>
    {aside ? <View style={styles.choiceRow}>{aside}<View style={locationChoiceBlock}>{field}</View></View> : field}
    {!compact||query.trim().length>=2?<Button label={busy ? 'Searching OneMap…' : 'Search location'} secondary onPress={query.trim().length >= 2 && !busy ? () => void search() : undefined} />:null}
    {aside && value ? <Text style={styles.saved}>✓ {value.label}</Text> : null}
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    {results.length ? <Text accessibilityLiveRegion="polite" style={styles.label}>Tap a result below to confirm your location.</Text> : !compact && !value && !busy && !error ? <Text style={styles.note}>Type an address, then select a search result. Typing alone does not set your location.</Text> : null}
    {results.map((result, index) => <Button key={`${result.latitude}-${index}`} secondary label={result.label} onPress={() => { version.current++; controller.current?.abort();clearTimeout(debounce.current);onChange(result); setResults([]); setError(''); setBusy(false); setQuery(''); }} />)}
    <Text style={styles.note}>Search by OneMap, Singapore Land Authority.</Text>
  </View>;
}
const styles = StyleSheet.create({
  wrap: { gap: 8, marginTop: 10 },
  wrapAside: { marginTop: 0 },
  choiceRow: { flexDirection: 'row', alignItems: 'stretch', gap: 8 },
  choiceLabel: { fontSize: 15, lineHeight: 19, fontWeight: '800', color: colors.ink },
  choiceInput: { width: '100%', backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 10, color: colors.ink, fontSize: 14 },
  label: { fontSize: 12, fontWeight: '800', color: colors.ink },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 12, color: colors.ink },
  saved: { color: colors.mint, fontSize: 12 },
  error: { color: colors.reject, fontSize: 12 },
  note: { color: colors.muted, fontSize: 10 },
});

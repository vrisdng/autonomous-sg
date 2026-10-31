import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

export type FeedView = 'home' | 'search' | 'compose' | 'activity' | 'profile';
const items: { id: FeedView; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'search', label: 'Search' },
  { id: 'compose', label: 'Create' },
  { id: 'activity', label: 'Activity' },
  { id: 'profile', label: 'Profile' },
];

export function DiscoveryNav({ active, onChange }: { active: FeedView | null; onChange: (view: FeedView) => void }) {
  return <View style={styles.bar} accessibilityLabel="Discovery navigation">
    {items.map(item => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={item.label} accessibilityState={{ selected: active === item.id }} onPress={() => onChange(item.id)} style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
      {item.id === 'compose' ? <View style={styles.create}><Text style={styles.plus}>+</Text></View> : <NavIcon kind={item.id} active={active === item.id} />}
      <Text style={[styles.label, active === item.id && styles.activeLabel]}>{item.label}</Text>
    </Pressable>)}
  </View>;
}

function NavIcon({ kind, active }: { kind: Exclude<FeedView, 'compose'>; active: boolean }) {
  const ink = active ? '#151515' : '#444444';
  return <Svg width={23} height={23} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden>
    {kind === 'home' ? <Path d="M3 10.5 12 3l9 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-5v-6h-5v6h-5A1.5 1.5 0 0 1 3 19.5v-9Z" fill={active ? ink : 'none'} stroke={ink} strokeWidth="1.7" strokeLinejoin="round" /> : null}
    {kind === 'search' ? <><Circle cx="10.8" cy="10.8" r="6.7" stroke={ink} strokeWidth="1.8" /><Path d="m16 16 4.5 4.5" stroke={ink} strokeWidth="1.8" strokeLinecap="round" /></> : null}
    {kind === 'activity' ? <Path d="M18.2 9.2a6.2 6.2 0 0 0-12.4 0c0 5.1-2 6.8-2 7.7h16.4c0-.9-2-2.6-2-7.7ZM10 20h4" stroke={ink} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /> : null}
    {kind === 'profile' ? <><Circle cx="12" cy="7.5" r="3.4" stroke={ink} strokeWidth="1.7" /><Path d="M4.5 20c.3-4.2 3-6.3 7.5-6.3s7.2 2.1 7.5 6.3" stroke={ink} strokeWidth="1.7" strokeLinecap="round" /></> : null}
  </Svg>;
}

const styles = StyleSheet.create({
  bar: { width: '100%', maxWidth: 720, alignSelf: 'center', minHeight: 64, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#EFEFEF' },
  item: { flex: 1, minHeight: 64, alignItems: 'center', justifyContent: 'center', gap: 3 },
  pressed: { opacity: 0.55 },
  create: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFE900', borderRadius: 8 },
  plus: { color: '#111111', fontSize: 24, lineHeight: 27, fontWeight: '500', marginTop: -1 },
  label: { color: '#777777', fontSize: 10, fontWeight: '600' },
  activeLabel: { color: '#171717', fontWeight: '800' },
});

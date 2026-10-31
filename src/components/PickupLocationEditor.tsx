import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { GeoLocation } from '../types';
import { validLocation } from '../features/travel/types';
import { LocationPicker } from './LocationPicker';
import { Button } from './Ui';
import { colors } from '../theme';

export function PickupLocationEditor({ value, onChange }: { value?: GeoLocation; onChange: (location: GeoLocation) => void }) {
  const [editing, setEditing] = useState(!value);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');
  const version = useRef(0);
  useEffect(() => () => { version.current++; }, []);
  const choose = (location: GeoLocation) => {
    version.current++;
    setLocating(false);
    setError('');
    setEditing(false);
    onChange(location);
  };
  const locate = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError('Location isn’t available here. Type an address below.');
      return;
    }
    const request = ++version.current;
    setLocating(true);
    setError('');
    navigator.geolocation.getCurrentPosition((position) => {
      if (request !== version.current) return;
      const location = { label: 'Current location', latitude: position.coords.latitude, longitude: position.coords.longitude };
      if (!validLocation(location)) {
        setLocating(false);
        setError('Choose a location in Singapore below.');
        return;
      }
      choose(location);
    }, (cause) => {
      if (request !== version.current) return;
      setLocating(false);
      setError(cause.code === 1 ? 'Location access was declined. Type an address below.' : 'Couldn’t locate you. Try again or type an address.');
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 });
  };
  const open = editing || !value;
  return <View style={{ borderBottomWidth: 1, borderColor: colors.line, paddingVertical: 14, gap: 10 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ width: 38, height: 38, borderRadius: 13, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 18, color: colors.ink }}>⌖</Text></View>
      <View style={{ flex: 1, minWidth: 0 }}><Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 1, color: colors.muted }}>YOUR PICKUP</Text><Text style={{ fontSize: 14, lineHeight: 20, fontWeight: '600', color: colors.ink, marginTop: 3 }}>{value?.label ?? 'Where is the car starting?'}</Text></View>
      {value ? <Pressable accessibilityRole="button" accessibilityLabel="Change pickup" onPress={() => { version.current++; setLocating(false); setEditing(!editing); }} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 }}><Text style={{ color: colors.green, fontWeight: '800' }}>{editing ? 'Done' : 'Change'}</Text></Pressable> : null}
    </View>
    {open ? <>
      <Button secondary label={locating ? 'Finding your location…' : 'Use my current location ⌖'} onPress={!locating ? locate : undefined} />
      {error ? <Text accessibilityRole="alert" style={{ color: colors.reject, fontSize: 12 }}>{error}</Text> : null}
      <LocationPicker label="Pickup or current location" value={value} onChange={choose} />
    </> : null}
    <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 16 }}>Remembered on this device for this party, including Last Call. Everyone still gets dropped at home.</Text>
  </View>;
}

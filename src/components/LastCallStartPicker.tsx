import { useEffect, useRef, useState } from 'react';
import { Pressable, Text } from 'react-native';
import { GeoLocation } from '../types';
import { validLocation } from '../features/travel/types';
import { LocationPicker, locationChoiceBlock } from './LocationPicker';
import { colors } from '../theme';

/** Search or current location for the Last Call start. Stays on this screen. */
export function LastCallStartPicker({ value, onChange }: { value?: GeoLocation; onChange: (location: GeoLocation) => void }) {
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');
  const version = useRef(0);
  useEffect(() => () => { version.current++; }, []);
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
      setLocating(false);
      onChange(location);
    }, (cause) => {
      if (request !== version.current) return;
      setLocating(false);
      setError(cause.code === 1 ? 'Location access was declined. Type an address below.' : 'Couldn’t locate you. Try again or type an address.');
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 });
  };
  const currentLabel = locating ? 'Finding your location…' : 'Use my current location';
  return <>
    <LocationPicker compact label="Or type a location" value={value} onChange={onChange} aside={
      <Pressable accessibilityRole="button" accessibilityLabel={currentLabel} accessibilityState={{ disabled: locating, busy: locating }} disabled={locating} onPress={locate} style={({ pressed }) => [locationChoiceBlock, { alignItems: 'center' }, locating && { opacity: 0.55 }, pressed && { opacity: 0.78 }]}>
        <Text style={{ fontSize: 22, color: colors.ink }}>⌖</Text>
        <Text style={{ color: colors.ink, fontWeight: '800', fontSize: 15, lineHeight: 19, textAlign: 'center' }}>{currentLabel}</Text>
      </Pressable>
    } />
    {error ? <Text accessibilityRole="alert" style={{ color: colors.reject, fontSize: 12 }}>{error}</Text> : null}
  </>;
}

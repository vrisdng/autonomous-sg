import AsyncStorage from '@react-native-async-storage/async-storage';
import { GeoLocation } from '../types';
import { validLocation } from '../features/travel/types';

// Shared with Last Call’s group start. Share ride uses it only when no Meet venue is chosen.
const key = (code: string) => `bojio.ride-pickup.v1:${code}`;

export async function loadRidePickup(code: string): Promise<GeoLocation | undefined> {
  const raw = await AsyncStorage.getItem(key(code));
  if (!raw) return undefined;
  const value = JSON.parse(raw);
  if (!validLocation(value)) throw new Error('Saved pickup could not be read.');
  return value;
}

export async function saveRidePickup(code: string, location: GeoLocation) {
  if (!code.trim() || !validLocation(location)) throw new Error('Choose a pickup in Singapore.');
  await AsyncStorage.setItem(key(code), JSON.stringify(location));
}

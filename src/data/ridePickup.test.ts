import { expect, it, vi } from 'vitest';

const values = vi.hoisted(() => new Map<string, string>());
vi.mock('@react-native-async-storage/async-storage', () => ({ default: { getItem: async (k: string) => values.get(k) ?? null, setItem: async (k: string, v: string) => { values.set(k, v); } } }));
import { ridePickup } from '../features/rides/rideOrigin';
import { loadRidePickup, saveRidePickup } from './ridePickup';

const school = { label: 'School gate', latitude: 1.3521, longitude: 103.9445 };

it('remembers a pickup for one party only', async () => {
  await saveRidePickup('QYBVJF', school);
  expect(await loadRidePickup('QYBVJF')).toEqual(school);
  expect(await loadRidePickup('OTHER1')).toBeUndefined();
});

it('keeps a Last Call start as the Share ride pickup when no meetup is chosen', async () => {
  const mall = { label: 'Tampines Mall', latitude: 1.3525, longitude: 103.9447 };
  await saveRidePickup('QYBVJF', mall);
  expect(ridePickup(undefined, await loadRidePickup('QYBVJF'))).toEqual(mall);
});

it('rejects a pickup outside Singapore and leaves a bad save unread', async () => {
  await expect(saveRidePickup('QYBVJF', { label: 'Elsewhere', latitude: 40, longitude: -74 })).rejects.toThrow();
  values.set('bojio.ride-pickup.v1:BAD123', '{"label":"Nope"}');
  await expect(loadRidePickup('BAD123')).rejects.toThrow('Saved pickup could not be read.');
  expect(values.get('bojio.ride-pickup.v1:BAD123')).toBe('{"label":"Nope"}');
});

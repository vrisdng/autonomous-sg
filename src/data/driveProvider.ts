import { parseLiveDriveRoutes } from '../features/rides/liveDriveRoutes';
import { RideGroup } from '../features/rides/planRides';
import { Place } from '../types';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, '');
const publicKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();

export function isLiveDriveConfigured() { return Boolean(supabaseUrl && publicKey); }

export async function searchCurrentDriveRoutes(venue: Place, groups: RideGroup[]) {
  if (!supabaseUrl || !publicKey) throw new Error('Current driving routes are not configured yet.');
  const response = await fetch(`${supabaseUrl}/functions/v1/drive-routes`, {
    method: 'POST',
    headers: { apikey: publicKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      venue: { name: venue.name, address: venue.address ?? venue.area, providerPlaceId: venue.providerPlaceId, latitude: venue.latitude, longitude: venue.longitude },
      groups: groups.filter((group) => group.routeKnown).map((group) => ({ groupId: group.id, stops: group.dropOrder.map((rider) => rider.origin) })),
    }),
  });
  if (!response.ok) throw new Error('Current driving routes are unavailable. Prototype matching remains visible.');
  const routes = parseLiveDriveRoutes(await response.json());
  if (!routes.length) throw new Error('No current driving routes came back. Prototype matching remains visible.');
  return routes;
}

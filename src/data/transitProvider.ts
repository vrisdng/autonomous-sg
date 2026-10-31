import { parseLiveJourneys } from '../features/train/liveJourneys';
import { Participant, Place } from '../types';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, '');
const publicKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();

export function isLiveTransitConfigured() {
  return Boolean(supabaseUrl && publicKey);
}

export async function searchScheduledJourneys(venue: Place, participants: Participant[]) {
  if (!supabaseUrl || !publicKey) throw new Error('Scheduled routing is not configured in this build.');
  const response = await fetch(`${supabaseUrl}/functions/v1/transit-routes`, {
    method: 'POST',
    headers: { apikey: publicKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ venue: { name: venue.name, address: venue.address ?? venue.area, providerPlaceId: venue.providerPlaceId, latitude: venue.latitude, longitude: venue.longitude }, participants }),
  });
  if (!response.ok) throw new Error('Scheduled routes are unavailable right now. The prototype estimate remains visible.');
  const journeys = parseLiveJourneys(await response.json());
  if (!journeys.length) throw new Error('No scheduled routes were returned for this plan. The prototype estimate remains visible.');
  return journeys;
}

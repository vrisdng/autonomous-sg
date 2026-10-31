import { parseLivePlaces } from '../features/meet/livePlaces';
import { Place } from '../types';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
const publicKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export function isLiveVenueProviderConfigured() {
  return Boolean(supabaseUrl && publicKey);
}

export async function searchLiveSupperPlaces(): Promise<Place[]> {
  if (!supabaseUrl || !publicKey) throw new Error('Live venue search is not configured.');
  const response = await fetch(`${supabaseUrl}/functions/v1/venue-search`, {
    method: 'POST',
    headers: { apikey: publicKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: 'late night supper in Singapore', maxResults: 8 }),
  });
  if (!response.ok) throw new Error('Live venues could not be reached. Showing the clearly labelled prototype list instead.');
  const places = parseLivePlaces(await response.json());
  if (!places.length) throw new Error('No usable live venues came back. Showing the clearly labelled prototype list instead.');
  return places;
}

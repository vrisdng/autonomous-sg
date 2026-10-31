const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

type Input = {
  venue?: { name?: unknown; address?: unknown; providerPlaceId?: unknown; latitude?: unknown; longitude?: unknown };
  groups?: { groupId?: unknown; stops?: unknown }[];
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
  if (!apiKey) return json({ error: 'Routing provider is not configured' }, 503);
  let input: Input;
  try { input = await request.json(); } catch { return json({ error: 'Invalid request' }, 400); }
  if (!input.venue || typeof input.venue.name !== 'string' || !Array.isArray(input.groups)) return json({ error: 'Venue and ride groups are required' }, 400);
  const venue = input.venue;
  const origin = typeof venue.providerPlaceId === 'string' && venue.providerPlaceId
    ? { placeId: venue.providerPlaceId }
    : typeof venue.latitude === 'number' && typeof venue.longitude === 'number'
      ? { location: { latLng: { latitude: venue.latitude, longitude: venue.longitude } } }
      : { address: `${venue.name}, ${typeof venue.address === 'string' ? venue.address : 'Singapore'}` };
  const sourceTimestamp = new Date().toISOString();
  const routes = await Promise.all(input.groups.slice(0, 8).map(async (group) => {
    if (typeof group.groupId !== 'string' || !Array.isArray(group.stops)) return null;
    const stops = group.stops.filter((stop): stop is string => typeof stop === 'string' && stop.length <= 120).slice(0, 4);
    if (!stops.length) return null;
    const waypoints = stops.map((stop) => ({ address: `${stop} MRT Station, Singapore` }));
    const provider = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters' },
      body: JSON.stringify({ origin, destination: waypoints.at(-1), intermediates: waypoints.slice(0, -1), travelMode: 'DRIVE', routingPreference: 'TRAFFIC_AWARE', languageCode: 'en', regionCode: 'SG', units: 'METRIC' }),
    });
    if (!provider.ok) return null;
    const data = await provider.json() as { routes?: { duration?: string; distanceMeters?: number }[] };
    const route = data.routes?.[0];
    const seconds = Number(route?.duration?.replace(/s$/, ''));
    if (!route?.distanceMeters || !Number.isFinite(seconds)) return null;
    return { groupId: group.groupId, durationMinutes: seconds / 60, distanceMeters: route.distanceMeters };
  }));
  return json({ routes: routes.filter(Boolean), sourceTimestamp });
});

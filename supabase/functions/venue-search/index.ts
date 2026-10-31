const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type GooglePlace = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  primaryTypeDisplayName?: { text?: string };
  currentOpeningHours?: { openNow?: boolean; nextCloseTime?: string };
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

function closingLabel(value?: string) {
  if (!value) return 'closing time unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'closing time unavailable' : date.toLocaleTimeString('en-SG', {
    timeZone: 'Asia/Singapore', hour: 'numeric', minute: '2-digit',
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
  if (!apiKey) return json({ error: 'Venue provider is not configured' }, 503);

  let input: { query?: unknown; maxResults?: unknown } = {};
  try { input = await request.json(); } catch { /* Defaults are safe. */ }
  const query = typeof input.query === 'string' && input.query.trim() ? input.query.trim().slice(0, 120) : 'late night supper in Singapore';
  const maxResults = typeof input.maxResults === 'number' ? Math.max(1, Math.min(10, Math.round(input.maxResults))) : 8;

  const provider = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.primaryTypeDisplayName,places.currentOpeningHours',
    },
    body: JSON.stringify({ textQuery: query, languageCode: 'en', regionCode: 'SG', maxResultCount: maxResults }),
  });

  if (!provider.ok) return json({ error: 'Place provider request failed' }, 502);
  const payload = await provider.json() as { places?: GooglePlace[] };
  const sourceTimestamp = new Date().toISOString();
  const places = (payload.places ?? []).flatMap((place) => {
    const latitude = place.location?.latitude;
    const longitude = place.location?.longitude;
    if (!place.id || !place.displayName?.text || typeof latitude !== 'number' || typeof longitude !== 'number') return [];
    const type = place.primaryTypeDisplayName?.text;
    const isOpenNow = place.currentOpeningHours?.openNow;
    return [{
      id: place.id,
      name: place.displayName.text,
      address: place.formattedAddress ?? 'Singapore',
      detail: isOpenNow === true ? 'Reported open by Google Places' : isOpenNow === false ? 'Reported closed by Google Places' : 'Opening status unavailable',
      openUntil: closingLabel(place.currentOpeningHours?.nextCloseTime),
      isOpenNow,
      tags: [type, 'Live result'].filter(Boolean),
      latitude,
      longitude,
    }];
  });
  return json({ places, sourceTimestamp });
});

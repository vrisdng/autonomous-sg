const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Input = {
  venue?: { name?: unknown; address?: unknown; providerPlaceId?: unknown; latitude?: unknown; longitude?: unknown };
  participants?: { id?: unknown; name?: unknown; origin?: unknown }[];
};

type GoogleStep = {
  travelMode?: string;
  staticDuration?: string;
  navigationInstruction?: { instructions?: string };
  transitDetails?: {
    stopDetails?: { departureStop?: { name?: string }; arrivalStop?: { name?: string }; departureTime?: string; arrivalTime?: string };
    transitLine?: { name?: string; nameShort?: string; vehicle?: { type?: string } };
    headsign?: string;
  };
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

function nextSingaporeCutoff(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Singapore', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const number = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  let cutoff = new Date(Date.UTC(number('year'), number('month') - 1, number('day'), 1, 30) - 8 * 60 * 60 * 1000);
  if (cutoff <= now) cutoff = new Date(cutoff.getTime() + 24 * 60 * 60 * 1000);
  return cutoff.toISOString();
}

function durationMinutes(value?: string) {
  const seconds = Number(value?.replace(/s$/, ''));
  return Number.isFinite(seconds) ? Math.max(1, Math.round(seconds / 60)) : 0;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
  if (!apiKey) return json({ error: 'Routing provider is not configured' }, 503);

  let input: Input;
  try { input = await request.json(); } catch { return json({ error: 'Invalid request' }, 400); }
  const participants = Array.isArray(input.participants) ? input.participants.slice(0, 12) : [];
  const venue = input.venue;
  if (!venue || typeof venue.name !== 'string' || participants.length < 1) return json({ error: 'Venue and participants are required' }, 400);
  const origin = typeof venue.providerPlaceId === 'string' && venue.providerPlaceId
    ? { placeId: venue.providerPlaceId }
    : typeof venue.latitude === 'number' && typeof venue.longitude === 'number'
      ? { location: { latLng: { latitude: venue.latitude, longitude: venue.longitude } } }
      : { address: `${venue.name}, ${typeof venue.address === 'string' ? venue.address : 'Singapore'}` };
  const arrivalTime = nextSingaporeCutoff();
  const sourceTimestamp = new Date().toISOString();

  const journeys = await Promise.all(participants.map(async (participant) => {
    if (typeof participant.id !== 'string' || typeof participant.origin !== 'string') return null;
    const provider = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'routes.duration,routes.legs.steps.travelMode,routes.legs.steps.staticDuration,routes.legs.steps.navigationInstruction,routes.legs.steps.transitDetails',
      },
      body: JSON.stringify({
        origin,
        destination: { address: `${participant.origin} MRT Station, Singapore` },
        travelMode: 'TRANSIT',
        arrivalTime,
        computeAlternativeRoutes: true,
        languageCode: 'en',
        regionCode: 'SG',
        transitPreferences: { allowedTravelModes: ['SUBWAY', 'TRAIN', 'LIGHT_RAIL', 'BUS'], routingPreference: 'FEWER_TRANSFERS' },
      }),
    });
    if (!provider.ok) return null;
    const data = await provider.json() as { routes?: { duration?: string; legs?: { steps?: GoogleStep[] }[] }[] };
    const route = data.routes?.[0];
    const rawSteps = route?.legs?.flatMap((leg) => leg.steps ?? []) ?? [];
    const transitSteps = rawSteps.filter((step) => step.travelMode === 'TRANSIT' && step.transitDetails);
    const firstDeparture = transitSteps[0]?.transitDetails?.stopDetails?.departureTime;
    const lastArrival = transitSteps[transitSteps.length - 1]?.transitDetails?.stopDetails?.arrivalTime;
    if (!route || !firstDeparture || !lastArrival) return null;
    const firstTransitIndex = rawSteps.findIndex((step) => step.travelMode === 'TRANSIT');
    const walkToTransitMinutes = rawSteps.slice(0, Math.max(0, firstTransitIndex)).reduce((sum, step) => sum + (step.travelMode === 'WALK' ? durationMinutes(step.staticDuration) : 0), 0);
    return {
      participantId: participant.id,
      durationMinutes: durationMinutes(route.duration),
      departureTime: firstDeparture,
      arrivalTime: lastArrival,
      transfers: Math.max(0, transitSteps.length - 1),
      walkToTransitMinutes,
      steps: rawSteps.map((step) => {
        const details = step.transitDetails;
        const line = details?.transitLine?.nameShort || details?.transitLine?.name;
        const instruction = step.navigationInstruction?.instructions || (details ? `Take ${line || details.transitLine?.vehicle?.type || 'public transport'}${details.headsign ? ` towards ${details.headsign}` : ''}` : step.travelMode === 'WALK' ? 'Walk to the next stop' : 'Continue');
        return {
          mode: step.travelMode ?? 'TRANSIT', instruction, line,
          departureStop: details?.stopDetails?.departureStop?.name,
          arrivalStop: details?.stopDetails?.arrivalStop?.name,
          departureTime: details?.stopDetails?.departureTime,
          arrivalTime: details?.stopDetails?.arrivalTime,
        };
      }),
    };
  }));
  return json({ journeys: journeys.filter(Boolean), sourceTimestamp, requestedArrivalTime: arrivalTime });
});

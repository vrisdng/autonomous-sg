import { parseGoogleTransit } from '../_shared/googleTransit.ts';
import { mapPairs } from '../_shared/parallel.ts';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const point = (p: any) => p && Number.isFinite(p.latitude) && Number.isFinite(p.longitude) && p.latitude >= 1.1 && p.latitude <= 1.6 && p.longitude >= 103.5 && p.longitude <= 104.2;
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  const started = Date.now(); let outcome = 'unavailable';
  try {
    const url = Deno.env.get('SUPABASE_URL'), publicKey = req.headers.get('apikey');
    if (!url || !publicKey || publicKey.length > 4096) return json({ error: 'Project access required.' }, 401);
    const auth = await fetch(url + '/auth/v1/settings', { headers: { apikey: publicKey }, signal: AbortSignal.timeout(5000) });
    if (!auth.ok) return json({ error: 'Project access unavailable.' }, auth.status === 401 || auth.status === 403 ? 401 : 503);
    const raw = await req.text(); if (raw.length > 12000) return json({ error: 'Request too large.' }, 400);
    let input; try { input = JSON.parse(raw); } catch { return json({ error: 'Invalid request.' }, 400); }
    if (input?.action !== 'transit' || !Array.isArray(input.trips) || input.trips.length < 1 || input.trips.length > 4 || input.trips.some((t: any) => !t || typeof t.id !== 'string' || t.id.length > 200 || !point(t.from) || !point(t.to))) return json({ error: 'Choose 1–4 Singapore journeys.' }, 400);
    const at = Date.parse(input.departureAt);
    if (typeof input.departureAt !== 'string' || !Number.isFinite(at) || at < Date.now() - 60000 || at > Date.now() + 28 * 86400000) return json({ error: 'Choose a time from now to 28 days ahead.' }, 400);
    const key = Deno.env.get('GOOGLE_ROUTES_API_KEY') || Deno.env.get('GOOGLE_MAPS_API_KEY') || Deno.env.get('GOOGLE_PLACES_API_KEY');
    if (!key) return json({ error: 'Google Routes key is not configured.' }, 503);
    // Existing atomic shared travel budget; fail closed. This is not an account-wide spending cap.
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!serviceKey) return json({ error: 'Route protection unavailable.' }, 503);
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`google:${ip}:${new Date().toISOString().slice(0,10)}`));
    const bucket = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
    const budget = await fetch(url + '/rest/v1/rpc/consume_travel_budget', { method: 'POST', headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_bucket: bucket, p_units: input.trips.length }), signal: AbortSignal.timeout(5000) });
    if (!budget.ok) return json({ error: 'Route protection unavailable.' }, 503);
    if (await budget.json() !== true) return json({ error: 'Route request limit reached. Try again later.' }, 429);
    const results = await mapPairs(input.trips, async (trip: any) => {
      try {
        const provider = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', { method: 'POST', signal: AbortSignal.timeout(12000), headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'routes.legs.steps.travelMode,routes.legs.steps.staticDuration,routes.legs.steps.navigationInstruction,routes.legs.steps.transitDetails' }, body: JSON.stringify({ origin: { location: { latLng: { latitude: trip.from.latitude, longitude: trip.from.longitude } } }, destination: { location: { latLng: { latitude: trip.to.latitude, longitude: trip.to.longitude } } }, travelMode: 'TRANSIT', departureTime: new Date(Math.max(at, Date.now())).toISOString(), languageCode: 'en', regionCode: 'SG' }) });
        if (!provider.ok) return { id: trip.id, status: 'unavailable', failure: provider.status === 429 ? 'quota' : provider.status === 401 || provider.status === 403 ? 'authentication' : 'unavailable', message: provider.status === 403 ? 'Enable Routes API and allow it on the server key in Google Cloud.' : `Google Routes unavailable (HTTP ${provider.status}).` };
        const route = parseGoogleTransit(await provider.json(), input.departureAt, new Date().toISOString());
        return { id: trip.id, status: route ? 'available' : 'unavailable', ...(route ? { route } : { message: 'No complete scheduled Google journey returned.' }) };
      } catch { return { id: trip.id, status: 'unavailable', failure: 'timeout', message: 'Google Routes timed out. Try again or open Maps.' }; }
    });
    outcome = results.every((r: any) => r.status === 'available') ? 'available' : 'partial';
    return json({ results });
  } catch { return json({ error: 'Route service temporarily unavailable.' }, 503); }
  finally { console.info(JSON.stringify({ event: 'google_transit', outcome, durationMs: Date.now() - started })); }
});

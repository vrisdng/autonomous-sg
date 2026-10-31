import { parseTransit, searchPayload, singaporeRouteParams } from '../_shared/onemapPayload.ts';
import { mapPairs } from '../_shared/parallel.ts';

const base = 'https://www.onemap.gov.sg';
let cachedToken: { value: string; expires: number } | undefined;
let pendingToken: Promise<string> | undefined;
const pendingLookups = new Map<string, Promise<any>>();
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'apikey, authorization, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const request = (url: string, init: RequestInit = {}) => fetch(url, { ...init, signal: AbortSignal.timeout(10_000) });
class ServiceError extends Error { status: number; constructor(message: string, status = 503) { super(message); this.status = status; } }

// Guests have no user JWT. Validate their project API key using Supabase Auth
// instead; a publishable key is not a secret or an individual identity.
async function authenticateClient(req: Request) {
  if (Deno.env.get('BOJIO_LOCAL_DEV') === '1') return;
  const key = req.headers.get('apikey');
  if (!key || key.length > 4096) throw new ServiceError('A valid project API key is required.', 401);
  const url = Deno.env.get('SUPABASE_URL');
  if (!url) throw new ServiceError('Travel service is not configured.');
  const response = await fetch(`${url}/auth/v1/settings`, {
    headers: { apikey: key }, signal: AbortSignal.timeout(5000),
  });
  if (response.status === 401 || response.status === 403) throw new ServiceError('Project API key is invalid.', 401);
  if (!response.ok) throw new ServiceError('Cannot validate travel access. Please retry.');
}

async function token(force = false): Promise<string> {
  if (!force && cachedToken && cachedToken.expires > Date.now() + 60_000) return cachedToken.value;
  if (pendingToken) return pendingToken;
  pendingToken = (async () => {
    const email = Deno.env.get('ONEMAP_EMAIL');
    const password = Deno.env.get('ONEMAP_PASSWORD');
    if (!email || !password) {
      const manualToken = Deno.env.get('ONEMAP_ACCESS_TOKEN');
      if (manualToken && !force) return manualToken;
      throw new ServiceError(manualToken ? 'The OneMap token expired. The host needs to renew it.' : 'Singapore location services are not connected yet.');
    }
    const response = await request(`${base}/api/auth/post/getToken`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
    });
    const data = await response.json();
    if (!response.ok || typeof data.access_token !== 'string') throw new ServiceError('Location service authentication failed. The host needs to reconnect OneMap.');
    const expires = Number(data.expiry_timestamp) * 1000;
    cachedToken = { value: data.access_token, expires: Number.isFinite(expires) ? expires : Date.now() + 3600_000 };
    return cachedToken.value;
  })();
  try { return await pendingToken; } finally { pendingToken = undefined; }
}

function oneMap(path: string, params: Record<string, string>) {
  const key = JSON.stringify([path, params]);
  const existing = pendingLookups.get(key);
  if (existing) return existing;
  const task = fetchOneMap(path, params).finally(() => pendingLookups.delete(key));
  pendingLookups.set(key, task);
  return task;
}
async function fetchOneMap(path: string, params: Record<string, string>) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const accessToken = await token(attempt === 1);
    const response = await request(`${base}${path}?${new URLSearchParams(params)}`, { headers: { Authorization: accessToken } });
    const data = await response.json().catch(() => ({}));
    const error = String(data.error ?? '');
    if (attempt === 0 && (response.status === 401 || /token.*(expired|invalid|missing)|authentication/i.test(error))) continue;
    if (response.status === 429) throw new ServiceError('The free routing quota is temporarily busy. Please try again later.', 429);
    if (response.status === 404) return null;
    if (!response.ok || data.error) throw new ServiceError('OneMap could not return this result. Please retry.');
    return data;
  }
  throw new ServiceError('OneMap needs to be reconnected.');
}

function coordinate(value: unknown) {
  if (!value || typeof value !== 'object') throw new ServiceError('Select a valid location first.', 400);
  const { latitude, longitude } = value as { latitude: number; longitude: number };
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < 1.1 || latitude > 1.6 || longitude < 103.5 || longitude > 104.2) throw new ServiceError('Location must be within Singapore.', 400);
  return `${latitude},${longitude}`;
}

// Persist quota buckets in Postgres so limits apply across Edge instances.
async function enforceQuota(request: Request, units: number) {
  if (Deno.env.get('BOJIO_LOCAL_DEV') === '1') return;
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${ip}:${new Date().toISOString().slice(0, 10)}`));
  const bucket = Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new ServiceError('Routing quota protection is not configured.');
  const result = await fetch(`${url}/rest/v1/rpc/consume_travel_budget`, { method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_bucket: bucket, p_units: units }), signal: AbortSignal.timeout(5000) });
  if (!result.ok) throw new ServiceError('Routing quota protection is unavailable. Please retry.');
  if (await result.json() !== true) throw new ServiceError('Free routing request limit reached. Please try again later.', 429);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const started=Date.now();let action='unknown';let outcome='available';
  try {
    await authenticateClient(req);
    const raw = await req.text();
    if (raw.length > 12000) throw new ServiceError('Request is too large.', 400);
    let input;
    try { input = JSON.parse(raw); } catch { throw new ServiceError('Invalid request.', 400); }
    if (!input || typeof input !== 'object') throw new ServiceError('Invalid request.', 400);
    action=['search','drive','transit'].includes(input.action)?input.action:'unknown';
    if (input.action === 'search') {
      if (typeof input.query !== 'string' || input.query.trim().length < 2 || input.query.length > 160) throw new ServiceError('Enter an address or postal code.', 400);
      await enforceQuota(req, 4);
      const data = await oneMap('/api/common/elastic/search', { searchVal: input.query.trim(), returnGeom: 'Y', getAddrDetails: 'Y', pageNum: '1' });
      return json({ locations: searchPayload(data), source: 'onemap', checkedAt: new Date().toISOString() });
    }
    if (!['transit', 'drive'].includes(input.action) || !Array.isArray(input.trips) || !input.trips.length || input.trips.length > 4) throw new ServiceError('Request 1–4 journeys at a time.', 400);
    if (input.action === 'transit' && (typeof input.departureAt !== 'string' || !Number.isFinite(Date.parse(input.departureAt)) || Date.parse(input.departureAt) < Date.now() - 60_000 || Date.parse(input.departureAt) > Date.now() + 28 * 86400_000)) throw new ServiceError('Choose a departure time from now to 28 days ahead.', 400);
    const trips = input.trips.map((trip: { id: string; from: unknown; to: unknown }) => {
      if (!trip || typeof trip.id !== 'string' || trip.id.length > 200) throw new ServiceError('Invalid journey.', 400);
      return { id: trip.id, start: coordinate(trip.from), end: coordinate(trip.to) };
    });
    const checkedAt = new Date().toISOString();
    // Each journey reserves route + retry + refresh; two extra calls cover initial auth.
    await enforceQuota(req, trips.length * 3 + 2);
    const results = await mapPairs(trips as { id: string; start: string; end: string }[], async (trip) => {
      try {
        const data = await oneMap('/api/public/routingsvc/route', {
          start: trip.start, end: trip.end, routeType: input.action === 'drive' ? 'drive' : 'pt',
          ...(input.action === 'transit' ? { ...singaporeRouteParams(input.departureAt), mode: 'TRANSIT', maxWalkDistance: '1000', numItineraries: '3' } : {}),
        });
        if (input.action === 'drive') {
          const seconds = data?.route_summary?.total_time;
          return { id: trip.id, ...(typeof seconds === 'number' && Number.isFinite(seconds) && seconds >= 0 ? { seconds } : { message: 'No driving route returned.' }) };
        } else {
          const route = parseTransit(data, input.departureAt, checkedAt);
          return { id: trip.id, status: route ? 'available' : 'unavailable', ...(route ? { route } : { message: 'No scheduled itinerary returned for this departure.' }) };
        }
      } catch (error) {
        const failure=error instanceof ServiceError ? error.status===429?'quota':/auth|token|reconnect/i.test(error.message)?'authentication':'unavailable' : 'timeout';
        outcome='partial';
        return { id: trip.id, status: 'unavailable', failure, message: error instanceof ServiceError ? error.message : 'Route service timed out. Please retry or open Google Maps.' };
      }
    });
    if (input.action === 'drive') {
      const limited = results.find((row: { failure?: string; message?: string }) => row.failure === 'quota' || (typeof row.message === 'string' && /limit|quota/i.test(row.message)));
      if (limited) throw new ServiceError(typeof limited.message === 'string' && limited.message ? limited.message : 'Free routing request limit reached. Please try again later.', 429);
      return json({ legs: results, checkedAt });
    }
    return json({ results, checkedAt });
  } catch (error) {
    outcome=error instanceof ServiceError && error.status===429?'quota':error instanceof ServiceError && error.status===401?'authentication':'unavailable';
    return json({ error: error instanceof ServiceError ? error.message : 'Location service is temporarily unavailable. Please retry.' }, error instanceof ServiceError ? error.status : 503);
  } finally { console.info(JSON.stringify({event:'travel_request',action,outcome,durationMs:Date.now()-started})); }
});

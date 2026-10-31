const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
class ServiceError extends Error {
  constructor(message: string, public status = 503) { super(message); }
}

// Guests use the project's public API key, not a user JWT. This does not identify
// an individual. A database-wide hard cap also bounds abuse across instances.
async function authorize(req: Request) {
  const key = req.headers.get('apikey');
  const url = Deno.env.get('SUPABASE_URL');
  if (!key || key.length > 4096 || !url) throw new ServiceError('Project access is required.', 401);
  const response = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key }, signal: AbortSignal.timeout(5000) });
  if (response.status === 401 || response.status === 403) throw new ServiceError('Project access is invalid.', 401);
  if (!response.ok) throw new ServiceError('Could not check project access. Retry.');
}

async function reserve(req: Request, sku: string) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${ip}:${new Date().toISOString().slice(0, 10)}`));
  const bucket = Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const url = Deno.env.get('SUPABASE_URL');
  if (!key || !url) throw new ServiceError('Restaurant request protection is not configured.');
  const response = await fetch(`${url}/rest/v1/rpc/consume_places_budget`, {
    method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_bucket: bucket, p_sku: sku }), signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new ServiceError('Restaurant request protection is unavailable. Retry later.');
  if (await response.json() !== true) throw new ServiceError('Restaurant request could not be recorded. Try again later or use Google Maps.', 503);
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  const started = Date.now(); let outcome = 'available';
  try {
    await authorize(req);
    const text = await req.text();
    if (text.length > 4096) throw new ServiceError('Request too large.', 400);
    let input;
    try { input = JSON.parse(text); } catch { throw new ServiceError('Invalid request.', 400); }
    const action=input?.action??'nearby';
    if(!['nearby','details','photo','reviews'].includes(action))throw new ServiceError('Invalid restaurant action.',400);
    const { latitude, longitude } = input?.center ?? {};
    if (action==='nearby' && (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < 1.1 || latitude > 1.6 || longitude < 103.5 || longitude > 104.2)) throw new ServiceError('Choose a Singapore search area.', 400);
    if(['details','reviews'].includes(action) && (typeof input.placeId!=='string'||!/^[A-Za-z0-9_-]{1,150}$/.test(input.placeId)))throw new ServiceError('Invalid restaurant reference.',400);
    if(action==='photo' && (typeof input.name!=='string'||!/^places\/[A-Za-z0-9_-]{1,150}\/photos\/[A-Za-z0-9_-]{1,2000}$/.test(input.name)))throw new ServiceError('Invalid photo reference. Reopen restaurant details.',400);
    if(action==='nearby' && input.rankPreference!==undefined && !['POPULARITY','DISTANCE'].includes(input.rankPreference))throw new ServiceError('Invalid search order.',400);
    const radius=input.radius??2000;
    if(action==='nearby' && ![2000,5000].includes(radius))throw new ServiceError('Choose a 2 km or 5 km radius.',400);
    const key = Deno.env.get('GOOGLE_PLACES_API_KEY');
    if (!key) throw new ServiceError('Google Places is not connected yet.');
    await reserve(req,action==='photo'?'photos':action==='reviews'?'reviews':action==='details'?'details-enterprise':'nearby-enterprise');
    if(action==='photo'||action==='reviews'){
      const target=action==='photo'?`https://places.googleapis.com/v1/${input.name}/media?maxWidthPx=720&skipHttpRedirect=true`:`https://places.googleapis.com/v1/places/${input.placeId}?languageCode=en`;
      const response=await fetch(target,{headers:{'X-Goog-Api-Key':key,...(action==='reviews'?{'X-Goog-FieldMask':'id,reviews'}:{})},signal:AbortSignal.timeout(12000)});
      if(!response.ok)throw new ServiceError(response.status===429?'Google media quota reached. Try Google Maps.':'Photos or reviews are unavailable. Reopen details or try Google Maps.',response.status===429?429:503);
      const data=await response.json();
      if(action==='photo'){
        let url;try{url=new URL(data.photoUri);}catch{throw new ServiceError('Photo unavailable.');}
        if(url.protocol!=='https:'||!url.hostname.endsWith('.googleusercontent.com'))throw new ServiceError('Photo unavailable.');
        return json({photoUri:url.toString()});
      }
      return json({reviews:Array.isArray(data.reviews)?data.reviews.slice(0,5):[]});
    }
    // One billable Nearby Search Enterprise or Details Enterprise call. No
    // automatic retry, photos, reviews, provider-content cache or response logs.
    const fields='id,displayName,formattedAddress,location,businessStatus,googleMapsUri,attributions,rating,userRatingCount,regularOpeningHours,currentOpeningHours,photos,priceLevel,priceRange';
    const response = await fetch(action==='details'?`https://places.googleapis.com/v1/places/${encodeURIComponent(input.placeId)}?languageCode=en`:'https://places.googleapis.com/v1/places:searchNearby', {
      method: action==='details'?'GET':'POST', headers: {
        'Content-Type': 'application/json', 'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': action==='details'?fields:fields.split(',').map(field=>`places.${field}`).join(','),
      },
      ...(action==='nearby'?{body: JSON.stringify({ includedTypes: ['restaurant'], maxResultCount: 20, rankPreference: input.rankPreference??'POPULARITY', languageCode: 'en', locationRestriction: { circle: { center: { latitude, longitude }, radius } } })}:{}),
      signal: AbortSignal.timeout(12000),
    });
    if (response.status === 429) throw new ServiceError('Google Places quota is unavailable. Retry later or open Google Maps.', 429);
    if (response.status === 401 || response.status === 403) throw new ServiceError('Google Places access failed. Check Places API (New), billing and server key restrictions.', 503);
    if (!response.ok) throw new ServiceError('Google Places could not return restaurants. Retry or open Google Maps.');
    const data = await response.json();
    if(action==='details') {
      const {latitude:lat,longitude:lng}=data.location??{};
      if(!Number.isFinite(lat)||!Number.isFinite(lng)||lat<1.1||lat>1.6||lng<103.5||lng>104.2)throw new ServiceError('Restaurant details are unavailable in Singapore.',404);
      return json({place:data,checkedAt:new Date().toISOString(),provider:'google_places'});
    }
    if (data.places !== undefined && !Array.isArray(data.places)) throw new ServiceError('Google Places returned an unreadable result.');
    return json({ places: data.places ?? [], checkedAt: new Date().toISOString(), provider: 'google_places', radiusMeters: radius });
  } catch (error) {
    outcome = error instanceof ServiceError && error.status === 429 ? 'quota' : 'unavailable';
    return json({ error: error instanceof ServiceError ? error.message : 'Restaurant search timed out or is unavailable. Retry or open Google Maps.' }, error instanceof ServiceError ? error.status : 503);
  } finally { console.info(JSON.stringify({ event: 'places_request', outcome, durationMs: Date.now() - started })); }
});

import assert from 'node:assert/strict';
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
assert.ok(url && key, 'Load .env.local with the public Supabase configuration.');
const endpoint = `${url.replace(/\/$/, '')}/functions/v1/google-places`;
const call = (body, authorized = true) => fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(authorized ? { apikey: key } : {}) }, body: JSON.stringify(body), signal: AbortSignal.timeout(25000) });
assert.equal((await call({}, false)).status, 401);
assert.equal((await call({ center: { latitude: 0, longitude: 0 } })).status, 400);
for (const [area, latitude, longitude] of [['west',1.3151,103.7652], ['central',1.3008,103.8385], ['east',1.3525,103.9453]]) {
  const start = Date.now();
  const response = await call({ center: { latitude, longitude } });
  const data = await response.json();
  assert.equal(response.status, 200, data.error || 'Places request failed');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.ok(data.places.length > 0 && data.places.length <= 10);
  assert.ok(data.places.every(place => place.id && place.displayName?.text && Number.isFinite(place.location?.latitude)));
  // Log counts/timing only: no keys, addresses or provider content persisted.
  console.log(JSON.stringify({ area, count: data.places.length, rated: data.places.filter(p => Number.isFinite(p.rating)).length, listedHours: data.places.filter(p => p.regularOpeningHours?.weekdayDescriptions?.length).length, durationMs: Date.now()-start }));
  const detailStart=Date.now();const detailResponse=await call({action:'details',placeId:data.places[0].id});const detail=await detailResponse.json();
  assert.equal(detailResponse.status,200,detail.error||'Place Details failed');assert.equal(detail.place.id,data.places[0].id);assert.ok(detail.place.displayName.text);assert.equal(detailResponse.headers.get('cache-control'),'no-store');
  console.log(JSON.stringify({area,detailsDurationMs:Date.now()-detailStart}));
}
console.log('Live Places: access rejection, coordinate validation, three real searches and three selected-place details passed. Six attempts reserved across two SKUs.');

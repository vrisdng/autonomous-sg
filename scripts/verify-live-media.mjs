import assert from 'node:assert/strict';
const url=process.env.EXPO_PUBLIC_SUPABASE_URL,key=process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
assert.ok(url&&key);
async function call(body){const start=Date.now();const r=await fetch(url+'/functions/v1/google-places',{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(25000)});const data=await r.json();assert.equal(r.status,200,data.error);return {data,ms:Date.now()-start};}
const {data:search}=await call({center:{latitude:1.3,longitude:103.838}});
const place=search.places.find(p=>p.photos?.length);assert.ok(place,'Real photos available');
const photo=await call({action:'photo',name:place.photos[0].name});assert.ok(photo.data.photoUri.startsWith('https://'));
const image=await fetch(photo.data.photoUri,{signal:AbortSignal.timeout(15000)});assert.ok(image.ok);assert.ok(image.headers.get('content-type').startsWith('image/'));await image.arrayBuffer();
const reviews=await call({action:'reviews',placeId:place.id});assert.ok(Array.isArray(reviews.data.reviews));assert.ok(reviews.data.reviews.length>0);
console.log(JSON.stringify({photoRequestMs:photo.ms,reviewsRequestMs:reviews.ms,reviewCount:reviews.data.reviews.length,photoImageVerified:true}));
console.log('PASS real Google photo metadata, photo delivery and reviews. No provider content saved. Uses one search, photo and review request.');

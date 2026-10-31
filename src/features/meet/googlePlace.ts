import { GeoLocation, Participant, Place, PlanDraft } from '../../types';
import { validLocation } from '../travel/types';

export const validPlaceId = (id: unknown): id is string => typeof id === 'string' && /^[A-Za-z0-9_-]{1,150}$/.test(id);
export function googleReference(value: any): Place | undefined {
  if(value?.source!=='google_places')return undefined;
  const id = value?.providerPlaceId ?? (value?.source === 'google_places' ? value.id?.replace(/^google-/, '') : undefined);
  if (!validPlaceId(id)) return undefined;
  return { id: `google-${id}`, providerPlaceId: id, source: 'google_places', name: 'Selected restaurant · details pending', area: '', nearestStation: '', detail: '', openUntil: 'Hours unavailable', tags: [], point: { x: 0, y: 0 } };
}
export function persistedVenue(place?: Place) {
  if (place?.source !== 'google_places') return place;
  const ref = googleReference(place);
  if (!ref) throw new Error('Invalid Google restaurant reference. Choose a restaurant again.');
  return { source: 'google_places', providerPlaceId: ref.providerPlaceId };
}
export function serializePlan(plan: PlanDraft) {
  return JSON.stringify({ ...plan, chosenVenue: persistedVenue(plan.chosenVenue) });
}
export function midpoint(people: Participant[]): { center?: GeoLocation; count: number } {
  const locations = people.map(p => p.location).filter(validLocation);
  return { count: locations.length, center: locations.length ? { label: 'Group geographic midpoint', latitude: locations.reduce((sum,p)=>sum+p.latitude,0)/locations.length, longitude: locations.reduce((sum,p)=>sum+p.longitude,0)/locations.length } : undefined };
}
export function parseGooglePlace(raw: any, checkedAt: string): Place | undefined {
  if (!validPlaceId(raw?.id) || typeof raw.displayName?.text !== 'string' || !validLocation({ label: raw.displayName.text, ...raw.location })) return undefined;
  return { ...googleReference({source:'google_places',providerPlaceId:raw.id})!, name:raw.displayName.text, address:raw.formattedAddress ?? '', area:raw.formattedAddress ?? 'Singapore', latitude:raw.location.latitude, longitude:raw.location.longitude, sourceTimestamp:checkedAt,
    rating: typeof raw.rating==='number'?raw.rating:undefined, reviewCount:typeof raw.userRatingCount==='number'?raw.userRatingCount:undefined,
    priceLabel:googlePriceLabel(raw),
    photos:Array.isArray(raw.photos)?raw.photos.filter((p:any)=>typeof p.name==='string').slice(0,10):[],
    regularHours:parseHours(raw.regularOpeningHours), currentHours:parseHours(raw.currentOpeningHours), businessStatus:raw.businessStatus,
    attributions:Array.isArray(raw.attributions)?raw.attributions.filter((a:any)=>typeof a.provider==='string').map((a:any)=>({provider:a.provider,uri:typeof a.providerUri==='string'&&a.providerUri.startsWith('https://')?a.providerUri:undefined})):[] };
}
export function googlePriceLabel(raw:any):string|undefined {
  const money=(v:any)=>{if(v?.currencyCode!=='SGD'||!/^\d+$/.test(String(v.units??'')))return undefined;const n=Number(v.units)+(Number(v.nanos??0)/1e9);return Number.isFinite(n)&&n>=0?n:undefined;};
  const lo=money(raw?.priceRange?.startPrice),hi=money(raw?.priceRange?.endPrice);
  if(lo!==undefined&&hi!==undefined&&hi>=lo)return `S$${lo}–${hi} · Google price range`;
  if(lo!==undefined)return `From S$${lo} · Google price range`;
  return ({PRICE_LEVEL_FREE:'Free · Google price level',PRICE_LEVEL_INEXPENSIVE:'$ · Inexpensive',PRICE_LEVEL_MODERATE:'$$ · Moderate',PRICE_LEVEL_EXPENSIVE:'$$$ · Expensive',PRICE_LEVEL_VERY_EXPENSIVE:'$$$$ · Very expensive'} as Record<string,string>)[raw?.priceLevel];
}
function parseHours(raw:any){return raw&&typeof raw==='object'?{periods:Array.isArray(raw.periods)?raw.periods.filter((p:any)=>p&&typeof p==='object'):[],weekdayDescriptions:Array.isArray(raw.weekdayDescriptions)?raw.weekdayDescriptions.filter((s:any)=>typeof s==='string'):[]}:undefined;}
// Weekday numbers and wall-clock minutes are interpreted in Singapore time.
// A missing close is 24/7 only for Google's documented Sunday 00:00 convention.
export function hoursAt(place: Place, at?: string): { matches: boolean; label: string } {
  if (place.businessStatus && place.businessStatus !== 'OPERATIONAL') return {matches:false,label:'Listed as temporarily or permanently closed'};
  const when = new Date(at ?? '');
  if (!Number.isFinite(when.getTime())) return {matches:false,label:'Set a meetup time to check listed hours'};
  const local = new Date(when.getTime()+8*3600000);
  const checked = Date.parse(place.sourceTimestamp ?? '');
  const current = Number.isFinite(checked) && when.getTime()>=checked && when.getTime()<checked+6*86400000 ? place.currentHours : undefined;
  const hours = current?.periods?.length ? current : place.regularHours;
  if (!hours?.periods?.length) return {matches:false,label:'Hours unavailable · check with the restaurant'};
  const minute = local.getUTCDay()*1440+local.getUTCHours()*60+local.getUTCMinutes();
  const datedMinute=(p: any) => p?.date && Number.isInteger(p.hour) ? Date.UTC(p.date.year,p.date.month-1,p.date.day,p.hour,p.minute??0)/60000 : undefined;
  const matches = hours.periods.some((period: any) => {
    const o=period.open,c=period.close;
    if (!o || !Number.isInteger(o.hour)) return false;
    const startDate=datedMinute(o),endDate=datedMinute(c);
    if(startDate!==undefined && endDate!==undefined) return local.getTime()/60000>=startDate && local.getTime()/60000<endDate;
    if (!c) return o.day===0 && o.hour===0 && (o.minute??0)===0;
    if (!Number.isInteger(o.day)||!Number.isInteger(c.day)||!Number.isInteger(c.hour))return false;
    const start=o.day*1440+o.hour*60+(o.minute??0);let end=c.day*1440+c.hour*60+(c.minute??0);
    if(end<=start)end+=10080;
    return [minute,minute+10080].some(m=>m>=start&&m<end);
  });
  return {matches,label:`${matches?'Listed hours cover this time':'Outside listed hours'} · ${hours===current?'date-specific':'usual schedule'}, not guaranteed`};
}

import { describe,it,expect } from 'vitest';
import { straightLineKm } from './cardFacts';
import { googlePriceLabel,googleReference,persistedVenue } from './googlePlace';
describe('restaurant card facts',()=>{
 const place={...googleReference({source:'google_places',providerPlaceId:'fixture'})!,latitude:1.3,longitude:103.8};
 it('shows provider ranges, not a fabricated average',()=>{expect(googlePriceLabel({priceRange:{startPrice:{currencyCode:'SGD',units:'10'},endPrice:{currencyCode:'SGD',units:'20'}}})).toBe('S$10–20 · Google price range');expect(googlePriceLabel({priceLevel:'PRICE_LEVEL_MODERATE'})).toBe('$$ · Moderate');expect(googlePriceLabel({})).toBeUndefined();});
 it('does not relabel foreign currency or save price data',()=>{expect(googlePriceLabel({priceRange:{startPrice:{currencyCode:'USD',units:'10'}}})).toBeUndefined();expect(persistedVenue({...place,priceLabel:'S$10–20'})).toEqual({source:'google_places',providerPlaceId:'fixture'});});
 it('measures coordinates without pretending to know the user location',()=>{expect(straightLineKm(undefined,place)).toBeUndefined();expect(straightLineKm({label:'same',latitude:1.3,longitude:103.8},place)).toBe(0);expect(straightLineKm({label:'north',latitude:1.4,longitude:103.8},place)).toBeCloseTo(11.119,2);});
});

import { GeoLocation } from '../../types';
// Experimental app handoff, not a booking API. No undocumented multi-stop parameters.
export function grabLink(from:GeoLocation,to:GeoLocation){
 const query=new URLSearchParams({screenType:'BOOKING',pickUpLatitude:String(from.latitude),pickUpLongitude:String(from.longitude),pickUpAddress:from.label,dropOffLatitude:String(to.latitude),dropOffLongitude:String(to.longitude),dropOffAddress:to.label});
 return 'grab://open?'+query.toString();
}
export const gojekLink='gojek://';
export function rideStopText(from:GeoLocation,stops:GeoLocation[]){return ['Pickup: '+from.label,...stops.map((p,i)=>`${i+1}. ${p.label}`)].join('\n');}

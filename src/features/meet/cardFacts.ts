import { GeoLocation, Place } from '../../types';
import { validLocation } from '../travel/types';
export function straightLineKm(origin:GeoLocation|undefined,place:Place):number|undefined {
 if(!validLocation(origin)||!validLocation({label:place.name,latitude:place.latitude,longitude:place.longitude}))return undefined;
 const rad=(v:number)=>v*Math.PI/180;
 const lat=rad(place.latitude!-origin.latitude),lon=rad(place.longitude!-origin.longitude);
 const a=Math.sin(lat/2)**2+Math.cos(rad(origin.latitude))*Math.cos(rad(place.latitude!))*Math.sin(lon/2)**2;
 return 6371*2*Math.atan2(Math.sqrt(Math.min(1,a)),Math.sqrt(Math.max(0,1-a)));
}

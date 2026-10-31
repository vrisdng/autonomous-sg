import AsyncStorage from '@react-native-async-storage/async-storage';
import {GeoLocation} from '../types';
import {validLocation} from '../features/travel/types';

const key=(name:string)=>`bojio.saved-home.v1:${encodeURIComponent(name.trim().normalize('NFKC').toLocaleLowerCase())}`;
export async function loadSavedHome(name:string):Promise<GeoLocation|null|undefined>{
 const raw=await AsyncStorage.getItem(key(name));
 if(!raw)return undefined;
 const value=JSON.parse(raw);
 if(value===null)return null;
 if(!validLocation(value))throw new Error('Saved address could not be read.');
 return value;
}
export async function rememberHome(name:string,location:GeoLocation){
 if(!name.trim()||!validLocation(location))throw new Error('Choose a valid home address.');
 await AsyncStorage.setItem(key(name),JSON.stringify(location));
}
export const forgetHome=(name:string)=>AsyncStorage.setItem(key(name),'null');

const partyKey=(code:string,id:string)=>`bojio.party-home.v1:${code}:${id}`;
const clip=(location:GeoLocation):GeoLocation=>({label:location.label.slice(0,300),latitude:location.latitude,longitude:location.longitude});

/** Home confirmed for one person on one party, on this device. */
export async function loadPartyHome(code:string,id:string):Promise<GeoLocation|undefined>{
 if(!code||!id)return;
 const raw=await AsyncStorage.getItem(partyKey(code,id));
 if(!raw)return;
 const value=JSON.parse(raw);
 if(!validLocation(value))throw new Error('Saved address could not be read.');
 return value;
}
export async function rememberPartyHome(code:string,id:string,location:GeoLocation){
 if(!code||!id||!validLocation(location))throw new Error('Choose a valid home address.');
 await AsyncStorage.setItem(partyKey(code,id),JSON.stringify(clip(location)));
}

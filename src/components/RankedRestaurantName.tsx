import { useEffect,useRef } from 'react';
import { Platform,Pressable,Text,View } from 'react-native';
import { Place } from '../types';
import { ensurePlace } from '../data/googlePlaces';
import { colors } from '../theme';

// Saved Google references contain IDs only. Resolve names when this lower list
// actually enters view, using the existing shared two-request details resolver.
export function RankedRestaurantName({place,onOpen}:{place:Place;onOpen:()=>void}){
 const element=useRef<any>(null);
 useEffect(()=>{
  if(place.source!=='google_places'||place.latitude||!place.providerPlaceId)return;
  const load=()=>void ensurePlace(place.providerPlaceId!);
  if(Platform.OS!=='web'||typeof IntersectionObserver==='undefined'){load();return;}
  const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){load();observer.disconnect();}});
  if(element.current)observer.observe(element.current);return()=>observer.disconnect();
 },[place.id,place.latitude]);
 return <View ref={element}><Pressable accessibilityRole="button" accessibilityLabel={`Open rated restaurant ${place.name}`} onPress={onOpen} style={({pressed})=>({minHeight:48,paddingVertical:13,borderBottomWidth:1,borderColor:colors.line,opacity:pressed?0.6:1})}><Text style={{fontSize:14,color:colors.muted}}>{place.name}</Text></Pressable></View>;
}

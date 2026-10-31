import { Linking, Text, View } from 'react-native';
import { Place } from '../types';
import { Button } from './Ui';
import { ensurePlace, placeFailure } from '../data/googlePlaces';
import { venueMapsUrl } from '../features/meet/discovery';
import { colors } from '../theme';
export function GoogleVenueStatus({place}:{place?:Place}){
  if(place?.source!=='google_places')return null;
  const error=placeFailure(place.providerPlaceId!);
  return <View style={{gap:8}}><Text style={{fontSize:12,color:colors.muted}}>Google Maps</Text>{!place.latitude?<><Text accessibilityRole={error?'alert':undefined}>{error||'Loading selected restaurant details… Your choice is saved.'}</Text>{error?<Button secondary label="Retry restaurant details" onPress={()=>void ensurePlace(place.providerPlaceId!,true)}/>:null}<Button secondary label="Open selected restaurant in Google Maps ↗" onPress={()=>void Linking.openURL(venueMapsUrl(place))}/></>:null}{place.attributions?.map((a,i)=><Text key={i} style={{fontSize:12}} onPress={a.uri?()=>void Linking.openURL(a.uri!):undefined}>{a.provider}</Text>)}</View>;
}

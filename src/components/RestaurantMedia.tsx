import { useEffect,useRef,useState,useSyncExternalStore } from 'react';
import { Image,Linking,Modal,PanResponder,Pressable,ScrollView,StyleProp,StyleSheet,Text,TextStyle,View } from 'react-native';
import { Place } from '../types';
import { Button, CloseButton } from './Ui';
import { ensurePlace,placeFailure,placesRevision,requestGoogle,resolvedPlace,subscribePlaces } from '../data/googlePlaces';
import { venuePhotoSource } from '../data/venues';
import { venueMapsUrl } from '../features/meet/discovery';
import { googleReference } from '../features/meet/googlePlace';
import { colors } from '../theme';
const photos=new Map<string,Promise<string>>();
const photo=(name:string)=>{let p=photos.get(name);if(!p){p=requestGoogle({action:'photo',name}).then(r=>r.photoUri as string).catch(e=>{photos.delete(name);throw e;});photos.set(name,p);}return p;};
// Checked venues have no Google data of their own, so they read their chain's Google listing.
function useVenueGoogle(place?:Place){
 useSyncExternalStore(subscribePlaces,placesRevision);
 const source=place&&!place.photos?.length?venuePhotoSource(place.id):undefined;
 useEffect(()=>{if(source)void ensurePlace(source.placeId);},[source?.placeId]);
 const shown=source?resolvedPlace(googleReference({source:'google_places',providerPlaceId:source.placeId})):place;
 return {source,shown};
}
export function VenueRating({place,style}:{place:Place;style?:StyleProp<TextStyle>}){
 const {source,shown}=useVenueGoogle(place);
 return <Text style={style}>★ {shown?.rating??'Unrated'} · {shown?.reviewCount??0} ratings{source&&!source.sameBranch?` at ${source.branch}`:''} · {shown?.priceLabel??'Price unavailable'}</Text>;
}
export function RestaurantPhoto({place,index=0,height=230,fill=false}:{place:Place;index?:number;height?:number;fill?:boolean}){
 const {source,shown}=useVenueGoogle(place);
 const box=fill?{flex:1,minHeight:0}:{height};
 const selected=shown?.photos?.[index];const [uri,setUri]=useState(''),[error,setError]=useState('');
 useEffect(()=>{let active=true;setUri('');setError('');if(selected)void photo(selected.name).then(url=>{if(active)setUri(url);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[selected?.name]);
 return <View style={fill?{flex:1}:undefined}>{uri?<Image accessibilityLabel={`Restaurant photo ${index+1}`} source={{uri}} resizeMode="cover" style={{width:'100%',borderRadius:18,...box}} onError={()=>{setUri('');setError('Photo unavailable. Open Google Maps below.');}}/>:<View style={{...box,borderRadius:18,backgroundColor:colors.bambooSoft,alignItems:'center',justifyContent:'center',padding:20}}><Text style={{fontSize:34}}>🍽️</Text><Text>{error||(selected||(source&&!placeFailure(source.placeId))?'Loading photo…':'No Google photo available')}</Text></View>}
 <Text style={{fontSize:12,color:colors.muted,marginTop:6}}>Google Maps{uri&&source&&!source.sameBranch?' · Photo from another branch':''}</Text>{selected?.authorAttributions?.map((a,i)=><Text key={i} style={{fontSize:12,color:colors.muted}} onPress={a.uri&&/^(https:)?\/\//.test(a.uri)?()=>void Linking.openURL(a.uri!.startsWith('//')?'https:'+a.uri:a.uri!):undefined}>Photo: {a.displayName}</Text>)}</View>;
}
export function RestaurantDetails({place,onClose,mention}:{place?:Place;onClose:()=>void;mention?:{active:boolean;disabled:boolean;busy:boolean;error:string;onPress:()=>void}}){
 const [index,setIndex]=useState(0),[reviews,setReviews]=useState<any[]|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const version=useRef(0);
 useEffect(()=>{version.current++;setIndex(0);setReviews(null);setError('');setBusy(false);return()=>{version.current++;};},[place?.id]);
 const {source,shown}=useVenueGoogle(place);
 const reviewsId=place?.providerPlaceId??source?.placeId;
 const total=shown?.photos?.length??0;
 const next=(delta:number)=>setIndex(i=>Math.max(0,Math.min(total-1,i+delta)));
 const gestures=PanResponder.create({onStartShouldSetPanResponderCapture:()=>true,onMoveShouldSetPanResponderCapture:()=>true,onPanResponderRelease:(_,g)=>{if(Math.abs(g.dx)>40&&Math.abs(g.dx)>Math.abs(g.dy))next(g.dx<0?1:-1);}});
 const load=async()=>{if(!reviewsId||busy||reviews!==null)return;const v=++version.current;setBusy(true);setError('');try{const data=await requestGoogle({action:'reviews',placeId:reviewsId});if(v===version.current)setReviews(data.reviews);}catch(e){if(v===version.current)setError(e instanceof Error?e.message:'Reviews unavailable.');}finally{if(v===version.current)setBusy(false);}};
 return <Modal visible={!!place} transparent animationType="fade" onRequestClose={onClose}><View style={{flex:1,alignItems:'center',justifyContent:'center'}}><Pressable accessibilityRole="button" accessibilityLabel="Close details popup" onPress={onClose} style={{...StyleSheet.absoluteFillObject,backgroundColor:'#00000099'}}/><View style={{width:'96%',height:'94%',maxWidth:720,borderRadius:22,overflow:'hidden',backgroundColor:colors.paper,padding:20}}><View style={{alignSelf:'flex-end'}}><CloseButton label="Close restaurant details" onPress={onClose}/></View>{place?<ScrollView contentContainerStyle={{flexGrow:1}}><Text style={{fontSize:26,fontWeight:'800',marginVertical:16}}>{place.name}</Text>{mention?<View style={{gap:8,padding:14,borderRadius:16,borderWidth:1,borderColor:colors.limeLine,backgroundColor:colors.bambooSoft,marginBottom:16}}><Button label={mention.busy?'Saving…':mention.active?'Okay, chill · remove my mention':'Die die want this! ❤️'} onPress={!mention.disabled?mention.onPress:undefined}/><Text style={{fontSize:12,color:colors.muted}}>Adds your name to a special mention and counts as one like—not a confirmed meetup. Removing the mention keeps your like.</Text>{mention.error?<Text accessibilityRole="alert" style={{color:colors.reject}}>{mention.error}</Text>:null}</View>:null}<View {...gestures.panHandlers} style={{flex:1,minHeight:260}}><RestaurantPhoto key={`${place.id}:${index}`} place={place} index={index} fill/></View><View style={{flexDirection:'row',justifyContent:'space-between',marginVertical:12}}><Button secondary label="← Previous photo" onPress={index>0?()=>next(-1):undefined}/><Button secondary label="Next photo →" onPress={index+1<total?()=>next(1):undefined}/></View><Text>{total?`${index+1} / ${total} photos · swipe sideways here to browse`:'No photos returned'} · browsing does not vote</Text><Text style={{marginVertical:12}}>{place.address}</Text><VenueRating place={place}/>
 <Button secondary label={busy?'Loading reviews…':'Read Google reviews'} onPress={!busy?()=>void load():undefined}/>{source&&!source.sameBranch?<Text style={{fontSize:12,color:colors.muted,marginTop:8}}>Rating and reviews are from {source.branch}.</Text>:null}{error?<Text accessibilityRole="alert">{error}</Text>:null}{reviews?.length===0?<Text>No reviews returned. Google only supplies a limited selection.</Text>:null}{reviews?.map((r,i)=><View key={i} style={{paddingVertical:15,borderBottomWidth:1,borderColor:colors.line}}><Text style={{fontWeight:'800'}}>{r.authorAttribution?.displayName??'Google reviewer'} · {r.rating??'—'} ★</Text><Text>{r.relativePublishTimeDescription}</Text><Text style={{lineHeight:22,marginTop:8}}>{typeof r.text?.text==='string'?r.text.text:'No written review'}</Text>{typeof r.authorAttribution?.uri==='string'&&r.authorAttribution.uri.startsWith('https://')?<Text style={{color:colors.green}} onPress={()=>void Linking.openURL(r.authorAttribution.uri)}>Reviewer profile ↗</Text>:null}</View>)}<Text style={{fontSize:12,marginVertical:12}}>Google Maps · reviews supplied by Google in relevance order, not all reviews.</Text><Button secondary label="More reviews & photos in Google Maps ↗" onPress={()=>void Linking.openURL(venueMapsUrl(place))}/></ScrollView>:null}</View></View></Modal>;
}

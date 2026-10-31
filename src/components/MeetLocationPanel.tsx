import {useEffect,useRef,useState} from 'react';
import {Pressable,StyleSheet,Text,View} from 'react-native';
import {GeoLocation} from '../types';
import {validLocation} from '../features/travel/types';
import {Button,Card} from './Ui';
import {LocationPicker,locationChoiceBlock} from './LocationPicker';
import {colors} from '../theme';

export function MeetLocationPanel({value,name,disabled,canSearch,count,total,onLocation,onNearby,onMidpoint}:{value?:GeoLocation;name?:string;disabled:boolean;canSearch:boolean;count:number;total:number;onLocation:(location:GeoLocation)=>Promise<void>;onNearby:(location:GeoLocation)=>void;onMidpoint:()=>void}){
 const [point,setPoint]=useState(value),[locating,setLocating]=useState(false),[error,setError]=useState('');
 const version=useRef(0);
 const [saving,setSaving]=useState(false),[retry,setRetry]=useState<GeoLocation>();
 useEffect(()=>{setPoint(value);},[value?.latitude,value?.longitude,value?.label]);
 useEffect(()=>()=>{version.current++;},[]);
 const choose=async(location:GeoLocation)=>{
  const request=++version.current;setLocating(false);setSaving(Boolean(name));setError('');setRetry(undefined);
  try{
   await onLocation(location);
   if(request!==version.current)return false;
   setPoint(location);
   return true;
  }catch(cause){
   if(request===version.current){setPoint(value);setRetry(location);setError(cause instanceof Error?cause.message:'Couldn’t share your location. Retry.');}
   return false;
  }finally{if(request===version.current)setSaving(false);}
 };
 const apply=async(location:GeoLocation,search:boolean)=>{
  const saved=await choose(location);
  if(saved&&search&&!name&&canSearch)onNearby(location);
 };
 const locate=()=>{
  if(typeof navigator==='undefined'||!navigator.geolocation){setError('Location isn’t available here. Type an address below.');return;}
  const request=++version.current;setLocating(true);setError('');
  navigator.geolocation.getCurrentPosition(position=>{
   if(request!==version.current)return;
   const location={label:'Current location',latitude:position.coords.latitude,longitude:position.coords.longitude};
   if(!validLocation(location)){setLocating(false);setError('Choose a location in Singapore below.');return;}
   void apply(location,true);
  },cause=>{if(request!==version.current)return;setLocating(false);setError(cause.code===1?'Location access was declined. Type an address below.':'Couldn’t locate you. Try again or type an address.');},{enableHighAccuracy:false,timeout:10000,maximumAge:60000});
 };
 const currentLabel=locating?'Finding your location…':'Use my current location ⌖';
 return <Card><View style={{gap:8}}>
  <Text style={{fontSize:17,fontWeight:'800',color:colors.ink}}>{name?`${name}, where are you starting?`:'Where shall we search?'}</Text>
  {!disabled&&!saving?<LocationPicker compact label="Or type a location" value={point} onChange={location=>void apply(location,false)} aside={
   <Pressable accessibilityRole="button" accessibilityLabel={currentLabel} accessibilityState={{disabled:locating||disabled,busy:locating}} disabled={locating||disabled} onPress={locate} style={({pressed})=>[locationChoiceBlock,styles.current,locating&&styles.dim,pressed&&styles.pressed]}>
    <Text style={styles.currentIcon}>⌖</Text>
    <Text style={styles.currentText}>{locating?'Finding your location…':'Use my current location'}</Text>
   </Pressable>
  }/>:point?<Text>{point.label}</Text>:null}
  {error?<Text accessibilityRole="alert" style={{color:colors.reject,fontSize:12}}>{error}</Text>:null}
  {saving?<Text>Sharing location…</Text>:retry?<Button secondary label="Retry sharing location" onPress={!disabled?()=>void apply(retry,!name):undefined}/>:null}
  <Text style={{fontSize:11,color:colors.muted}}>{name?'Starting point · initially used for your journey home. Check your shared home address below.':'Search area only · no personal destination changed.'}</Text>
  {canSearch?<>
   {point?<Pressable accessibilityRole="button" accessibilityState={{disabled}} disabled={disabled} onPress={!disabled?()=>onNearby(point):undefined} style={({pressed})=>[styles.action,disabled&&styles.dim,pressed&&styles.pressed]}><Text style={styles.actionText}>Find food nearby →</Text></Pressable>:null}
   {total>1?<><Pressable accessibilityRole="button" accessibilityState={{disabled:disabled||count<2}} disabled={disabled||count<2} onPress={!disabled&&count>=2?onMidpoint:undefined} style={({pressed})=>[styles.action,(disabled||count<2)&&styles.dim,pressed&&styles.pressed]}><Text style={styles.actionText}>{`Meet in the middle · ${count}/${total} locations`}</Text></Pressable><Text style={{fontSize:11,color:colors.muted}}>Geographic midpoint, not the fastest journey for everyone.{count<total?' Friends can add their locations here too.':''}</Text></>:null}
  </>:<Text style={{fontSize:12,color:colors.muted}}>{count}/{total} locations ready. The host can search nearby or around your group midpoint.</Text>}
 </View></Card>;
}
const styles=StyleSheet.create({
 current:{alignItems:'center'},
 currentIcon:{fontSize:22,color:colors.ink},
 currentText:{color:colors.ink,fontWeight:'800',fontSize:15,lineHeight:19,textAlign:'center'},
 action:{backgroundColor:colors.lime,borderRadius:18,minHeight:52,paddingVertical:14,paddingHorizontal:16,alignItems:'center',justifyContent:'center'},
 actionText:{color:colors.ink,fontWeight:'800',fontSize:15,textAlign:'center'},
 dim:{opacity:0.55},
 pressed:{opacity:0.78},
});

import { useState } from 'react';
import { Linking,Text,View } from 'react-native';
import { GeoLocation } from '../types';
import { Button, CloseButton } from './Ui';
import { grabLink,gojekLink,rideStopText } from '../features/rides/rideLinks';
import { directions } from '../features/travel/types';
import { colors } from '../theme';
export function RideHandoff({from,stops}:{from:GeoLocation;stops:GeoLocation[]}){
 const [provider,setProvider]=useState<'grab'|'gojek'>(),[message,setMessage]=useState('');
 const open=async(url:string)=>{try{await Linking.openURL(url);setMessage('');}catch{setMessage('Couldn’t open the app. Try on your phone or use Maps.');}};
 const copy=async(text:string,label:string)=>{try{if(typeof navigator==='undefined'||!navigator.clipboard)throw new Error();await navigator.clipboard.writeText(text);setMessage(`${label} copied. Paste it in Gojek.`);return true;}catch{setMessage('Copy failed. Hold the address to copy it, then open Gojek.');return false;}};
 if(!stops.length)return null;
 return <View style={{gap:8,marginTop:12}}>
  <View style={{flexDirection:'row',gap:8}}><View style={{flex:1}}><Button label="Open Grab ↗" onPress={()=>{setMessage('');setProvider('grab');}}/></View><View style={{flex:1}}><Button secondary label="Open Gojek ↗" onPress={()=>{setMessage('');setProvider('gojek');}}/></View></View>
  {provider?<View style={{padding:12,borderRadius:12,backgroundColor:colors.bambooSoft,gap:8}}>
   <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}><Text style={{fontWeight:'800'}}>{provider==='grab'?'Ready for Grab':'Ready for Gojek'}</Text><CloseButton label="Close ride options" onPress={()=>setProvider(undefined)}/></View>
   <Text>{provider==='grab'?`Pickup and final stop are filled for you.${stops.length>1?' Add the stops in between in Grab.':''} Check before booking.`:'Copy these stops into Gojek, then check before booking.'}</Text>
   <Text selectable>{rideStopText(from,stops)}</Text>
   {provider==='gojek'?<>
    <Text>Paste one address at a time. Add drop-offs in this order.</Text>
    {[from,...stops].map((location,index)=><View key={index} style={{gap:5}}><Text selectable>{index===0?'Pickup':`Stop ${index}`}: {location.label}</Text><Button secondary label={`Copy ${index===0?'pickup':`stop ${index}`}`} onPress={()=>void copy(location.label,index===0?'Pickup':`Stop ${index}`)}/></View>)}
    <Button label="Copy pickup & open Gojek ↗" onPress={()=>void (async()=>{if(await copy(from.label,'Pickup'))await open(gojekLink);})()}/>
    <Button secondary label="Open Gojek without copying ↗" onPress={()=>void open(gojekLink)}/>
   </>:<Button label="Continue to Grab ↗" onPress={()=>void open(grabLink(from,stops.at(-1)!))}/>}
   <Button secondary label="Copy stops" onPress={()=>{if(typeof navigator!=='undefined'&&navigator.clipboard)void navigator.clipboard.writeText(rideStopText(from,stops)).then(()=>setMessage('Stops copied in order.')).catch(()=>setMessage('Copy failed. Select the addresses above to copy.'));else setMessage('Select the addresses above to copy.');}}/>
  </View>:null}
  <Button secondary label="All stops in Google Maps ↗" onPress={()=>void open(directions(from,stops.at(-1)!,'driving',stops.slice(0,-1)))}/>
  {message?<Text accessibilityRole="alert" style={{fontSize:12}}>{message}</Text>:null}
 </View>;
}

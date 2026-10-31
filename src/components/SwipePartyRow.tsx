import {PropsWithChildren,useEffect,useMemo,useRef} from 'react';
import {Animated,PanResponder,Pressable,Text,View} from 'react-native';
import { colors } from '../theme';

export function SwipePartyRow({code,open,disabled,onReveal,onDelete,children}:PropsWithChildren<{code:string;open:boolean;disabled:boolean;onReveal:(open:boolean)=>void;onDelete:()=>void}>){
 const x=useRef(new Animated.Value(0)).current;
 const axis=useRef<'x'|'y'|undefined>(undefined);
 useEffect(()=>{const animation=Animated.timing(x,{toValue:open?-96:0,duration:160,useNativeDriver:false});animation.start();return()=>animation.stop();},[open]);
 const gesture=useMemo(()=>PanResponder.create({
  onStartShouldSetPanResponderCapture:()=>{axis.current=undefined;return false;},
  onMoveShouldSetPanResponderCapture:(_,g)=>{if(disabled)return false;if(!axis.current){if(Math.abs(g.dy)>10&&Math.abs(g.dy)>=Math.abs(g.dx))axis.current='y';else if(Math.abs(g.dx)>16&&Math.abs(g.dx)>Math.abs(g.dy)*1.5)axis.current='x';}return axis.current==='x';},
  onPanResponderMove:(_,g)=>x.setValue(Math.max(-96,Math.min(0,(open?-96:0)+g.dx))),
  onPanResponderRelease:(_,g)=>{const reveal=(open?-96:0)+g.dx < -40;onReveal(reveal);Animated.timing(x,{toValue:reveal?-96:0,duration:160,useNativeDriver:false}).start();},
  onPanResponderTerminationRequest:()=>true,
  onPanResponderTerminate:()=>Animated.timing(x,{toValue:open?-96:0,duration:160,useNativeDriver:false}).start()
 }),[open,disabled,onReveal]);
 return <View style={{borderRadius:20,overflow:'hidden',backgroundColor:open?colors.rejectSoft:colors.bambooSoft}}>
  {open?<Pressable accessibilityRole="button" accessibilityLabel={`Remove party ${code} from list`} disabled={disabled} onPress={onDelete} style={{position:'absolute',right:0,top:0,bottom:0,width:96,alignItems:'center',justifyContent:'center',backgroundColor:colors.rejectSoft}}><Text style={{color:colors.reject,fontWeight:'900',fontSize:16}}>Delete</Text><Text style={{color:colors.reject,fontSize:10,marginTop:5}}>From this list</Text></Pressable>:null}
  <Animated.View {...gesture.panHandlers} style={{transform:[{translateX:x}],...({touchAction:'pan-y'} as any)}}>
   <View pointerEvents={open?'none':'auto'}>{children}</View>
   <Pressable accessibilityRole="button" accessibilityLabel={`${open?'Hide':'Show'} delete option for ${code}`} disabled={disabled} onPress={()=>onReveal(!open)} style={{position:'absolute',right:8,top:4,padding:12}}><Text style={{fontWeight:'900',fontSize:18}}>···</Text></Pressable>
  </Animated.View>
 </View>;
}

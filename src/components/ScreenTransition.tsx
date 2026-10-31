import {PropsWithChildren,useLayoutEffect,useRef} from 'react';
import {Animated,Easing} from 'react-native';
import {useReducedMotion} from '../hooks/useReducedMotion';

export function ScreenTransition({children}:PropsWithChildren){
 const reduced=useReducedMotion();
 const progress=useRef(new Animated.Value(1)).current;
 useLayoutEffect(()=>{
  if(reduced){progress.setValue(1);return;}
  progress.setValue(0);
  const animation=Animated.timing(progress,{toValue:1,duration:180,easing:Easing.out(Easing.cubic),useNativeDriver:false});
  animation.start();return()=>animation.stop();
 },[reduced,progress]);
 return <Animated.View style={{opacity:progress.interpolate({inputRange:[0,1],outputRange:[0.7,1]}),transform:[{translateY:progress.interpolate({inputRange:[0,1],outputRange:[7,0]})}]}}>{children}</Animated.View>;
}

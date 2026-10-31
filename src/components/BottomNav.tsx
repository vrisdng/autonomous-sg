import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import {useEffect,useRef} from 'react';
import {useReducedMotion} from '../hooks/useReducedMotion';
import { colors } from '../theme';
import { Tab } from '../types';

const items: { id: Tab; icon: string; label: string }[] = [
  { id: 'home', icon: '⌂', label: 'Home' },
  { id: 'meet', icon: '◎', label: 'Meet' },
  { id: 'split', icon: '$', label: 'Split' },
  { id: 'ride', icon: '◇', label: 'Share ride' },
  { id: 'train', icon: '↗', label: 'Last call' },
];

export function BottomNav({ active, onChange }: { active: Tab; onChange: (tab: Tab) => void }) {
  return (
    <View style={styles.bar}>
      {items.map((item) => (
        <Pressable accessibilityRole="button" accessibilityLabel={item.label} accessibilityState={{ selected: active === item.id }} key={item.id} onPress={() => onChange(item.id)} style={styles.item}>
          <NavIcon selected={active===item.id} icon={item.icon}/>
          <Text style={[styles.label, active === item.id && styles.active]}>{item.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function NavIcon({selected,icon}:{selected:boolean;icon:string}){
 const reduced=useReducedMotion(),scale=useRef(new Animated.Value(1)).current;
 const previous=useRef(selected);
 useEffect(()=>{
  const changed=selected&&!previous.current;previous.current=selected;
  scale.setValue(1);
  if(!changed||reduced)return;
  const animation=Animated.sequence([
   Animated.timing(scale,{toValue:1.12,duration:90,easing:Easing.out(Easing.quad),useNativeDriver:false}),
   Animated.timing(scale,{toValue:1,duration:140,easing:Easing.out(Easing.cubic),useNativeDriver:false}),
  ]);animation.start();return()=>animation.stop();
 },[selected,reduced,scale]);
 return <Animated.View style={[styles.iconWrap,selected&&styles.selected,{transform:[{scale}]}]}><Text style={[styles.icon,selected&&styles.active]}>{icon}</Text></Animated.View>;
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 8, paddingBottom: 14, width:'100%',maxWidth:720,alignSelf:'center' },
  item: { flex: 1, alignItems: 'center', gap: 4, minHeight:56 },
  iconWrap:{width:48,height:30,borderRadius:15,alignItems:'center',justifyContent:'center'},
  selected:{backgroundColor:colors.coral},
  icon: { color: colors.muted, fontSize: 20, fontWeight: '800' },
  label: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  active: { color: colors.green },
});

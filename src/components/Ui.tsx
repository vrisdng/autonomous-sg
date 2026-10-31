import { PropsWithChildren, useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../theme';
import {useReducedMotion} from '../hooks/useReducedMotion';

/** Rounded rose cross shared by close, pass, and remove controls. */
export function SoftCross({ size = 18, stroke = 2.25 }: { size?: number; stroke?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M7 7 L17 17 M17 7 L7 17" fill="none" stroke={colors.reject} strokeWidth={stroke} strokeLinecap="round" />
    </Svg>
  );
}

export function Card({ children }: PropsWithChildren) {
  return <View style={styles.card}>{children}</View>;
}

export function Pill({ children }: PropsWithChildren) {
  return <Text style={styles.pill}>{children}</Text>;
}

export function Toggle({label,description,value,onChange,disabled=false}:{label:string;description?:string;value:boolean;onChange:(value:boolean)=>void;disabled?:boolean}) {
  const position=useRef(new Animated.Value(value?20:0)).current;
  useEffect(()=>{const animation=Animated.timing(position,{toValue:value?20:0,duration:140,useNativeDriver:false});animation.start();return()=>animation.stop();},[value]);
  return <Pressable {...(Platform.OS==='web'?{onKeyDown:(event:any)=>{if(event.key===' '){event.preventDefault();if(!disabled&&!event.repeat)onChange(!value);}}}:{})} accessibilityRole="switch" accessibilityLabel={label} accessibilityHint={description} aria-checked={value} aria-disabled={disabled} accessibilityState={{checked:value,disabled}} disabled={disabled} onPress={()=>onChange(!value)} style={({pressed})=>({minHeight:64,paddingVertical:12,paddingHorizontal:14,flexDirection:'row',alignItems:'center',gap:14,borderRadius:16,backgroundColor:value?colors.blush:colors.paper,opacity:disabled?0.45:pressed?0.75:1})}>
    <View style={{flex:1}}><Text style={{fontSize:14,fontWeight:'800',color:colors.ink}}>{label}</Text>{description?<Text style={{fontSize:12,lineHeight:17,color:colors.muted,marginTop:4}}>{description}</Text>:null}</View>
    <View pointerEvents="none" style={{alignItems:'center',gap:3}}><View style={{width:52,height:32,padding:3,borderRadius:16,backgroundColor:value?colors.coral:colors.limeLine}}><Animated.View style={{width:26,height:26,borderRadius:13,backgroundColor:colors.card,transform:[{translateX:position}]}}/></View><Text style={{fontSize:10,fontWeight:'700',color:colors.muted}}>{value?'On':'Off'}</Text></View>
  </Pressable>;
}

export function CloseButton({label,onPress}:{label:string;onPress:()=>void}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({pressed})=>({width:48,height:48,borderRadius:24,backgroundColor:pressed?colors.rejectPressed:colors.rejectSoft,borderWidth:1,borderColor:colors.rejectLine,alignItems:'center',justifyContent:'center'})}><SoftCross size={20} /></Pressable>;
}

export function Disclosure({ title, summary, defaultOpen = false, children }: PropsWithChildren<{ title: string; summary?: string; defaultOpen?: boolean }>) {
  const [open, setOpen] = useState(defaultOpen);
  return <View>
    <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} style={styles.disclosure}>
      <View style={{ flex: 1 }}><Text style={styles.disclosureTitle}>{title}</Text>{summary ? <Text numberOfLines={2} style={styles.disclosureSummary}>{summary}</Text> : null}</View>
      <Text style={styles.disclosureIcon}>{open ? '−' : '+'}</Text>
    </Pressable>
    {open ? <View style={{ gap: 12, paddingTop: 12 }}>{children}</View> : null}
  </View>;
}

export function Button({ label, onPress, secondary = false }: { label: string; onPress?: () => void; secondary?: boolean }) {
  const reduced=useReducedMotion();
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: !onPress }} disabled={!onPress} onPress={onPress} style={({ pressed }) => [styles.button, secondary && styles.secondary, !onPress && { opacity: 0.5 }, pressed && styles.pressed, !reduced&&{transform:[{scale:pressed?0.98:1}],...(Platform.OS==='web'?{transitionProperty:'transform, opacity',transitionDuration:'100ms'} as any:{})}]}>
      <Text style={[styles.buttonText, secondary && styles.secondaryText]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 20,
    gap: 10,
  },
  pill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.lime,
    color: colors.ink,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginRight: 7,
    marginTop: 8,
    fontSize: 12,
    fontWeight: '700',
  },
  button: {
    backgroundColor: colors.coral,
    borderRadius: 18,
    minHeight: 50,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  secondary: { backgroundColor: colors.bambooSoft },
  pressed: { opacity: 0.78 },
  buttonText: { color: colors.ink, fontWeight: '800', fontSize: 15 },
  secondaryText: { color: colors.ink },
  disclosure: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth:1, borderBottomColor:colors.line },
  disclosureTitle: { color: colors.ink, fontWeight: '700', fontSize: 16 },
  disclosureSummary: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 4 },
  disclosureIcon: { color: colors.muted, fontSize: 22, width: 24, textAlign: 'center' },
});

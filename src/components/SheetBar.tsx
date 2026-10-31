import { ReactNode } from 'react';
import { View, ViewStyle } from 'react-native';

/** In-flow sheet header. Web replaces this with a viewport-fixed bar. */
export function SheetBar({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={style}>{children}</View>;
}

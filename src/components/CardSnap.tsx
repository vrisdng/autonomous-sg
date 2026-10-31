import { ReactNode } from 'react';
import { View } from 'react-native';

/** Native Meet scrolling has no web snap detent. */
export function CardSnap({ children }: { children: ReactNode }) {
  return <View style={{ gap: 12 }}>{children}</View>;
}

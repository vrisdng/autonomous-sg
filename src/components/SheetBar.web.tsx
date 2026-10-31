import { ReactNode } from 'react';
import { View, ViewStyle } from 'react-native';
// @ts-expect-error react-dom is the web renderer and ships without types here.
import { createPortal } from 'react-dom';

/**
 * The outing sheet scrolls inside a transformed modal, which carries the
 * top-right close out of the viewport. Pin that same bar to the window.
 */
export function SheetBar({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const bar = <View style={[style, { position: 'fixed', top: 0, left: 0, right: 0, zIndex: 10001 } as unknown as ViewStyle]}>{children}</View>;
  if (typeof document === 'undefined') return bar;
  return <>
    <View style={{ height: 72, flexShrink: 0 }} />
    {createPortal(bar, document.body)}
  </>;
}

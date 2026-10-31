import { ReactNode, useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { cardSnapAdjustment } from '../features/meet/cardSnap';

function scrollParent(node: HTMLElement): HTMLElement | null {
  let current = node.parentElement;
  while (current) {
    const overflow = getComputedStyle(current).overflowY;
    if (overflow === 'auto' || overflow === 'scroll' || overflow === 'overlay') return current;
    current = current.parentElement;
  }
  const scrolling = node.ownerDocument?.scrollingElement;
  return scrolling instanceof HTMLElement ? scrolling : null;
}

/**
 * Light vertical detent for the active swipe card. The card block matches the
 * scrollport, and a nearby scroll eases it flush. A farther scroll keeps going.
 */
export function CardSnap({ children }: { children: ReactNode }) {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [portHeight, setPortHeight] = useState(0);
  const ref = useCallback((value: unknown) => setNode((value as HTMLElement | null) ?? null), []);

  useEffect(() => {
    if (!node) return;
    const scroller = scrollParent(node);
    if (!scroller) return;
    const fit = () => setPortHeight(scroller.clientHeight);
    fit();
    let timer = 0;
    let frame = 0;
    let hold = false;
    let settling = false;
    let anchor = scroller.scrollTop;
    let travel = 0;
    const measure = () => { if (!settling) travel = scroller.scrollTop - anchor; };
    const settle = () => {
      if (hold || settling) return;
      const distance = travel;
      const delta = cardSnapAdjustment(node.getBoundingClientRect().top, scroller.getBoundingClientRect().top, scroller.clientHeight, distance);
      anchor = scroller.scrollTop;
      travel = 0;
      if (!delta) return;
      settling = true;
      const start = scroller.scrollTop;
      const dest = start + delta;
      const began = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - began) / 220);
        scroller.scrollTop = start + (dest - start) * (1 - (1 - t) ** 3);
        if (t < 1) frame = requestAnimationFrame(step);
        else { settling = false; anchor = scroller.scrollTop; travel = 0; }
      };
      frame = requestAnimationFrame(step);
    };
    const onScroll = () => {
      measure();
      if (hold || settling) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(settle, 120);
    };
    const down = () => {
      hold = true;
      settling = false;
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      anchor = scroller.scrollTop;
      travel = 0;
    };
    const up = () => { hold = false; measure(); window.clearTimeout(timer); timer = window.setTimeout(settle, 140); };
    scroller.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('pointerdown', down);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    const resize = new ResizeObserver(fit);
    resize.observe(scroller);
    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(frame);
      scroller.removeEventListener('scroll', onScroll);
      window.removeEventListener('pointerdown', down);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      resize.disconnect();
    };
  }, [node]);

  return <View ref={ref} style={portHeight ? { minHeight: portHeight, gap: 12 } : { gap: 12 }}>{children}</View>;
}

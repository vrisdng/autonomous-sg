import { describe, expect, it } from 'vitest';
import { cardSnapAdjustment } from './cardSnap';

describe('swipe card scroll detent', () => {
  it('settles a card that is close to the top of the scroll area', () => {
    expect(cardSnapAdjustment(180, 100, 800)).toBe(80);
    expect(cardSnapAdjustment(20, 100, 800)).toBe(-80);
  });

  it('lets a longer gesture pass even when the card stops near the top', () => {
    expect(cardSnapAdjustment(180, 100, 800, 200)).toBe(0);
    expect(cardSnapAdjustment(180, 100, 800, 50)).toBe(80);
  });

  it('leaves a card that is already aligned, or far from the snap', () => {
    expect(cardSnapAdjustment(100, 100, 800)).toBe(0);
    expect(cardSnapAdjustment(103, 100, 800)).toBe(0);
    expect(cardSnapAdjustment(250, 100, 800)).toBe(0);
    expect(cardSnapAdjustment(-50, 100, 400)).toBe(0);
  });
});

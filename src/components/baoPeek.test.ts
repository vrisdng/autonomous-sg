import { afterEach, describe, expect, it } from 'vitest';
import {
  PEEK_SIDES,
  alongForDrop,
  askShiftForGrowth,
  askTowardForPeek,
  baoAskPanel,
  baoPeekArt,
  baoPeekMarks,
  clearBaoDragBlocking,
  initialPeekChoice,
  isBaoDragBlocking,
  isPeekSide,
  nearestPeekEdge,
  peekChoiceFromStorage,
  peekDragFrame,
  peekDragSlop,
  peekLayout,
  peekPointerKind,
  placeBaoAsk,
  peekLayoutPlaced,
  resolvePeekLayout,
  peekSideFromSearch,
  pickPeekSide,
  projectPeekPoint,
  resetPeekChoice,
  setBaoDragBlocking,
  tabHasInlineBao,
  writePeekChoice,
} from './baoPeekLogic';

const column = { width: 390, height: 700 };

describe('Bao peek', () => {
  it('can arrive from every side', () => {
    const seen = PEEK_SIDES.map((_, index) => pickPeekSide(() => index / PEEK_SIDES.length));
    expect(seen).toEqual([...PEEK_SIDES]);
    expect(pickPeekSide(() => 0.99)).toBe('bottom');
    expect(isPeekSide('left')).toBe(true);
    expect(isPeekSide('middle')).toBe(false);
  });

  it('stays off screens that already show Bao', () => {
    expect(tabHasInlineBao('home')).toBe(true);
    expect(tabHasInlineBao('meet')).toBe(false);
    expect(tabHasInlineBao('split')).toBe(false);
    expect(tabHasInlineBao('ride')).toBe(false);
    expect(tabHasInlineBao('train')).toBe(false);
  });

  it('reads an optional side override and ignores anything else', () => {
    expect(peekSideFromSearch('?peek=right')).toBe('right');
    expect(peekSideFromSearch('peek=top')).toBe('top');
    expect(peekSideFromSearch('?peek=center')).toBeUndefined();
    expect(peekSideFromSearch('')).toBeUndefined();
  });

  it('turns onto each edge so the face stays whole and the steamer trails off', () => {
    const sx = baoPeekArt.width / 120;
    const sy = baoPeekArt.height / 140;
    const samples = [
      { x: 66 * sx, y: 4.5 * sy },
      { x: 43 * sx, y: 66 * sy },
      { x: 72 * sx, y: 66 * sy },
      { x: 21 * sx, y: 76 * sy },
      { x: 95 * sx, y: 76 * sy },
      { x: 58 * sx, y: 84 * sy },
    ];
    const expectFace = {
      left: (points: { x: number; y: number }[], tail: { x: number }) => {
        for (const point of points) {
          expect(point.x).toBeGreaterThan(14);
          expect(point.x).toBeLessThan(160);
        }
        expect(tail.x).toBeLessThan(0);
      },
      right: (points: { x: number; y: number }[], tail: { x: number }) => {
        for (const point of points) {
          expect(point.x).toBeLessThan(column.width - 14);
          expect(point.x).toBeGreaterThan(column.width - 170);
        }
        expect(tail.x).toBeGreaterThan(column.width);
      },
      top: (points: { x: number; y: number }[], tail: { y: number }) => {
        for (const point of points) {
          expect(point.y).toBeGreaterThan(10);
          expect(point.y).toBeLessThan(130);
          expect(point.x).toBeGreaterThan(10);
          expect(point.x).toBeLessThan(column.width - 4);
        }
        expect(tail.y).toBeLessThan(4);
      },
      bottom: (points: { x: number; y: number }[], tail: { y: number }) => {
        for (const point of points) {
          expect(point.y).toBeLessThan(column.height - 4);
          expect(point.y).toBeGreaterThan(column.height - 170);
          expect(point.x).toBeGreaterThan(column.width - 180);
          expect(point.x).toBeLessThan(column.width - 8);
        }
        expect(tail.y).toBeGreaterThan(column.height - 16);
      },
    };
    for (const side of PEEK_SIDES) {
      const layout = peekLayout(side);
      const points = samples.map((sample) => projectPeekPoint(layout, column, sample, 'settle'));
      const tail = projectPeekPoint(layout, column, baoPeekMarks.tail, 'settle');
      expectFace[side](points, tail);
      expect(Math.abs(layout.settleRotate)).toBeGreaterThanOrEqual(24);
      if (side === 'left') expect(layout.settleRotate).toBeGreaterThan(60);
      if (side === 'right') expect(layout.settleRotate).toBeLessThan(-60);
    }
  });

  it('starts off the edge, leans in to look, then settles', () => {
    for (const side of PEEK_SIDES) {
      const layout = peekLayout(side);
      const hidden = projectPeekPoint(layout, column, baoPeekMarks.face, 'hidden');
      const look = projectPeekPoint(layout, column, baoPeekMarks.face, 'look');
      const settle = projectPeekPoint(layout, column, baoPeekMarks.face, 'settle');
      if (side === 'left') {
        expect(hidden.x).toBeLessThan(0);
        expect(look.x).toBeGreaterThan(settle.x);
      }
      if (side === 'right') {
        expect(hidden.x).toBeGreaterThan(column.width);
        expect(look.x).toBeLessThan(settle.x);
      }
      if (side === 'top') {
        expect(hidden.y).toBeLessThan(0);
        expect(look.y).toBeGreaterThan(settle.y);
      }
      if (side === 'bottom') {
        expect(hidden.y).toBeGreaterThan(column.height);
        expect(look.y).toBeLessThan(settle.y);
      }
    }
  });
});

describe('dragging Bao onto an edge', () => {
  afterEach(() => resetPeekChoice());

  it('snaps to the nearest edge, including when the pointer is past it', () => {
    expect(nearestPeekEdge({ x: 12, y: 300 }, column)).toBe('left');
    expect(nearestPeekEdge({ x: 370, y: 300 }, column)).toBe('right');
    expect(nearestPeekEdge({ x: 200, y: 8 }, column)).toBe('top');
    expect(nearestPeekEdge({ x: 200, y: 680 }, column)).toBe('bottom');
    expect(nearestPeekEdge({ x: -40, y: 20 }, column)).toBe('left');
  });

  it('slides along the chosen edge with the face on screen and the steamer off it', () => {
    for (const side of PEEK_SIDES) {
      for (const along of [0, 0.5, 1]) {
        const layout = peekLayoutPlaced(side, along, column);
        const face = projectPeekPoint(layout, column, baoPeekMarks.face, 'settle');
        const tail = projectPeekPoint(layout, column, baoPeekMarks.tail, 'settle');
        const drop = side === 'left' || side === 'right'
          ? { x: side === 'left' ? 0 : column.width, y: face.y }
          : { x: face.x, y: side === 'top' ? 0 : column.height };
        expect(alongForDrop(side, drop, column)).toBeCloseTo(along, 5);
        if (side === 'left' || side === 'right') {
          expect(face.y).toBeGreaterThan(40);
          expect(face.y).toBeLessThan(column.height - 40);
          if (side === 'left') expect(tail.x).toBeLessThan(0);
          if (side === 'right') expect(tail.x).toBeGreaterThan(column.width);
        } else {
          expect(face.x).toBeGreaterThan(40);
          expect(face.x).toBeLessThan(column.width - 40);
          if (side === 'top') expect(tail.y).toBeLessThan(4);
          if (side === 'bottom') expect(tail.y).toBeGreaterThan(column.height - 16);
        }
      }
    }
  });

  it('keeps the face under the pointer for the drag pose', () => {
    const point = { x: 140, y: 260 };
    for (const side of PEEK_SIDES) {
      const frame = peekDragFrame(side, point);
      const layout = { ...peekLayout(side), anchor: { left: frame.left, top: frame.top } };
      const face = projectPeekPoint(layout, column, baoPeekMarks.face, 'settle');
      expect(frame.rotate).toBe(peekLayout(side).settleRotate);
      expect(face.x).toBeCloseTo(point.x, 5);
      expect(face.y).toBeCloseTo(point.y, 5);
    }
  });

  it('keeps a saved along off the default corner until the column is measured', () => {
    const saved = { side: 'top' as const, along: 0.5 };
    expect(resolvePeekLayout(saved, { width: 0, height: 0 })).toBeUndefined();
    expect(resolvePeekLayout(saved, { width: 390, height: 0 })).toBeUndefined();
    const placed = resolvePeekLayout(saved, column);
    expect(placed).toEqual(peekLayoutPlaced('top', 0.5, column));
    expect(placed?.anchor).not.toEqual(peekLayout('top').anchor);
    const atStart = resolvePeekLayout({ side: 'top', along: 0 }, column);
    expect(atStart?.anchor).not.toEqual(peekLayout('top').anchor);
    expect(resolvePeekLayout({ side: 'left' }, { width: 0, height: 0 })).toEqual(peekLayout('left'));
  });

  it('treats a short press as a click and a move past the slop as a drag', () => {
    expect(peekDragSlop).toBe(8);
    expect(peekPointerKind(0, 0)).toBe('click');
    expect(peekPointerKind(peekDragSlop - 0.01, 0)).toBe('click');
    expect(peekPointerKind(3, 4)).toBe('click');
    expect(peekPointerKind(Number.NaN, 1)).toBe('click');
    expect(peekPointerKind(peekDragSlop, 0)).toBe('drag');
    expect(peekPointerKind(0, -peekDragSlop)).toBe('drag');
    expect(peekPointerKind(6, 6)).toBe('drag');
  });

  it('places the ask bubble inward of the parked face and inside the column', () => {
    for (const side of PEEK_SIDES) {
      const face = projectPeekPoint(peekLayout(side), column, baoPeekMarks.face, 'settle');
      const place = placeBaoAsk(face, askTowardForPeek(side), column);
      const center = { x: place.left + baoAskPanel.width / 2, y: place.top + baoAskPanel.height / 2 };
      expect(place.left).toBeGreaterThanOrEqual(8);
      expect(place.top).toBeGreaterThanOrEqual(8);
      expect(place.left + baoAskPanel.width).toBeLessThanOrEqual(column.width - 8);
      expect(place.top + baoAskPanel.height).toBeLessThanOrEqual(column.height - 8);
      if (side === 'left') {
        expect(place.tail).toBe('left');
        expect(center.x).toBeGreaterThan(face.x);
      }
      if (side === 'right') {
        expect(place.tail).toBe('right');
        expect(center.x).toBeLessThan(face.x);
      }
      if (side === 'top') {
        expect(place.tail).toBe('top');
        expect(center.y).toBeGreaterThan(face.y);
      }
      if (side === 'bottom') {
        expect(place.tail).toBe('bottom');
        expect(center.y).toBeLessThan(face.y);
      }
    }
    const clamped = placeBaoAsk({ x: 0, y: 0 }, 'right', column);
    expect(clamped.left).toBeGreaterThanOrEqual(8);
    expect(clamped.top).toBeGreaterThanOrEqual(8);
  });

  it('blocks the venue deck for the whole grab, including the pointer-up that ends it', async () => {
    clearBaoDragBlocking();
    expect(isBaoDragBlocking()).toBe(false);
    setBaoDragBlocking(true);
    setBaoDragBlocking(false);
    expect(isBaoDragBlocking()).toBe(true);
    setBaoDragBlocking(true);
    await Promise.resolve();
    expect(isBaoDragBlocking()).toBe(true);
    setBaoDragBlocking(false);
    await Promise.resolve();
    expect(isBaoDragBlocking()).toBe(false);
  });

  it('keeps an expanded party pulse inside the column without treating a tap as a drag', () => {
    expect(peekDragSlop).toBe(8);
    const place = { left: 40, top: 400, tail: 'left' as const };
    expect(askShiftForGrowth(place, column, 0)).toBe(0);
    expect(askShiftForGrowth(place, column, Number.NaN)).toBe(0);
    expect(askShiftForGrowth(place, column, 40)).toBe(0);
    const low = { left: 40, top: 500, tail: 'left' as const };
    const overflow = askShiftForGrowth(low, column, 220);
    expect(overflow).toBeGreaterThan(0);
    expect(low.top - overflow).toBeGreaterThanOrEqual(8);
    const above = { left: 40, top: 80, tail: 'bottom' as const };
    expect(askShiftForGrowth(above, column, 48)).toBe(48);
    expect(askShiftForGrowth({ ...above, top: 20 }, column, 48)).toBe(12);
  });

  it('remembers a dropped edge for the session and lets it beat a random or query side', () => {
    expect(peekChoiceFromStorage(null)).toBeUndefined();
    expect(peekChoiceFromStorage('{"side":"nope"}')).toBeUndefined();
    expect(peekChoiceFromStorage('{"side":"bottom","along":2}')).toEqual({ side: 'bottom', along: 1 });
    expect(initialPeekChoice('left').side).toBe('left');
    writePeekChoice({ side: 'right', along: 0.25 });
    expect(initialPeekChoice('left')).toEqual({ side: 'right', along: 0.25 });
    resetPeekChoice();
    expect(initialPeekChoice('top').side).toBe('top');
  });
});

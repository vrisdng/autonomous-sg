export const PEEK_SIDES = ['left', 'right', 'top', 'bottom'] as const;
export type PeekSide = (typeof PEEK_SIDES)[number];

export const baoPeekArt = { width: 96, height: 112 };

/** Eyes and steamer in the art box. The face should land on-screen; the steamer trails off the edge. */
export const baoPeekMarks = {
  face: { x: 58 * (baoPeekArt.width / 120), y: 70 * (baoPeekArt.height / 140) },
  tail: { x: 60 * (baoPeekArt.width / 120), y: 116 * (baoPeekArt.height / 140) },
};

const LOOK = 1.12;

export type PeekOffset = { x: number; y: number };

export type PeekLayout = {
  side: PeekSide;
  anchor: { top?: number; left?: number; right?: number; bottom?: number };
  /** Added to x or y. Larger magnitude hides the bun past the entry edge. */
  shiftAxis: 'x' | 'y';
  hiddenShift: number;
  lookShift: number;
  settleShift: number;
  /** Clockwise degrees. Side peeks lie toward the edge; top and bottom lean over that edge. */
  hiddenRotate: number;
  lookRotate: number;
  settleRotate: number;
  bobAxis: 'x' | 'y';
};

export function isPeekSide(value: string | null | undefined): value is PeekSide {
  return value === 'left' || value === 'right' || value === 'top' || value === 'bottom';
}

export function pickPeekSide(random: () => number = Math.random): PeekSide {
  const index = Math.floor(random() * PEEK_SIDES.length);
  return PEEK_SIDES[Math.min(PEEK_SIDES.length - 1, Math.max(0, index))]!;
}

/** `?peek=left` forces a side so a pass across tabs can be checked. Absent or unknown values stay random. */
export function peekSideFromSearch(search?: string): PeekSide | undefined {
  const query = search ?? (typeof window === 'undefined' ? '' : window.location.search);
  const value = new URLSearchParams(query).get('peek');
  return isPeekSide(value) ? value : undefined;
}

/**
 * Tabs that already draw Bao in the page. Home has the steamer card.
 * The party gate draws its own Bao and is skipped separately.
 * Meet, Split, Share ride, and Last call only have the edge peek.
 */
export function tabHasInlineBao(tab: string): boolean {
  return tab === 'home';
}

export function peekLayout(side: PeekSide): PeekLayout {
  // Anchors are the settled box. Shifts slide along the entry edge; rotation
  // turns the head into the page so the screen clips the steamer, not the face.
  if (side === 'left') {
    return {
      side,
      anchor: { left: -18, top: 228 },
      shiftAxis: 'x',
      hiddenShift: -130,
      lookShift: 16,
      settleShift: 0,
      hiddenRotate: 108,
      lookRotate: 64,
      settleRotate: 80,
      bobAxis: 'y',
    };
  }
  if (side === 'right') {
    return {
      side,
      anchor: { right: -15, bottom: 150 },
      shiftAxis: 'x',
      hiddenShift: 130,
      lookShift: -16,
      settleShift: 0,
      hiddenRotate: -108,
      lookRotate: -68,
      settleRotate: -85,
      bobAxis: 'y',
    };
  }
  if (side === 'top') {
    return {
      side,
      anchor: { top: -30, right: -12 },
      shiftAxis: 'y',
      hiddenShift: -140,
      lookShift: 14,
      settleShift: 0,
      hiddenRotate: 188,
      lookRotate: 156,
      settleRotate: 168,
      bobAxis: 'x',
    };
  }
  return {
    side,
    anchor: { bottom: -32, right: 8 },
    shiftAxis: 'y',
    hiddenShift: 120,
    lookShift: -18,
    settleShift: 0,
    hiddenRotate: -6,
    lookRotate: -16,
    settleRotate: -28,
    bobAxis: 'x',
  };
}

export const peekLookProgress = LOOK;

/** Movement below this stays a tap. At or past it, Bao follows the pointer to a new edge. */
export const peekDragSlop = 8;

export function peekPointerKind(dx: number, dy: number): 'click' | 'drag' {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return 'click';
  return Math.hypot(dx, dy) >= peekDragSlop ? 'drag' : 'click';
}

/** Collapsed ask bubble, including the Party pulse row. Placement uses this so the closed dropdown stays on screen. */
export const baoAskPanel = { width: 220, height: 208 };

export type AskTail = 'left' | 'right' | 'top' | 'bottom';
export type AskPlace = { left: number; top: number; tail: AskTail };

/** Which way the ask panel should sit from a peek parked on `side`. */
export function askTowardForPeek(side: PeekSide): 'left' | 'right' | 'up' | 'down' {
  if (side === 'left') return 'right';
  if (side === 'right') return 'left';
  if (side === 'top') return 'down';
  return 'up';
}

/**
 * Speech-bubble box beside an anchor point, clamped inside `bounds`.
 * `toward` is the direction from the anchor to the panel. The tail points back at the anchor.
 */
export function placeBaoAsk(
  anchor: PeekOffset,
  toward: 'left' | 'right' | 'up' | 'down',
  bounds: { width: number; height: number },
  panel: { width: number; height: number } = baoAskPanel,
): AskPlace {
  const gap = 28;
  const margin = 8;
  let left = anchor.x - panel.width / 2;
  let top = anchor.y - panel.height / 2;
  let tail: AskTail = 'bottom';
  if (toward === 'right') {
    left = anchor.x + gap;
    top = anchor.y - panel.height / 2;
    tail = 'left';
  } else if (toward === 'left') {
    left = anchor.x - gap - panel.width;
    top = anchor.y - panel.height / 2;
    tail = 'right';
  } else if (toward === 'down') {
    left = anchor.x - panel.width / 2;
    top = anchor.y + gap;
    tail = 'top';
  } else {
    left = anchor.x - panel.width / 2;
    top = anchor.y - gap - panel.height;
    tail = 'bottom';
  }
  const maxLeft = Math.max(margin, bounds.width - panel.width - margin);
  const maxTop = Math.max(margin, bounds.height - panel.height - margin);
  return {
    left: Math.min(maxLeft, Math.max(margin, left)),
    top: Math.min(maxTop, Math.max(margin, top)),
    tail,
  };
}

/**
 * How far to slide the ask box up when Party pulse grows.
 * A bottom tail stays pointed at Bao. Other tails move only enough to stay inside the column.
 */
export function askShiftForGrowth(
  place: AskPlace,
  bounds: { height: number },
  extra: number,
  panel: { height: number } = baoAskPanel,
): number {
  if (!Number.isFinite(extra) || extra <= 0) return 0;
  const margin = 8;
  const roomAbove = Math.max(0, place.top - margin);
  if (place.tail === 'bottom') return Math.min(extra, roomAbove);
  const overflow = place.top + panel.height + extra - (bounds.height - margin);
  if (overflow <= 0) return 0;
  return Math.min(overflow, roomAbove);
}

const SESSION_KEY = 'bojio.peekChoice';

export type PeekChoice = { side: PeekSide; along?: number };

let sessionChoice: PeekChoice | undefined;

export function peekEdgeInset(span: number) {
  if (span <= 0) return 0;
  return Math.min(48, Math.max(0, span / 2 - 8));
}

/** Closest screen edge to a point in column coordinates. Outside points still pick the edge they passed. */
export function nearestPeekEdge(point: PeekOffset, column: { width: number; height: number }): PeekSide {
  const options: { side: PeekSide; distance: number }[] = [
    { side: 'left', distance: point.x },
    { side: 'right', distance: column.width - point.x },
    { side: 'top', distance: point.y },
    { side: 'bottom', distance: column.height - point.y },
  ];
  options.sort((a, b) => a.distance - b.distance);
  return options[0]!.side;
}

/** 0 at the start of the edge, 1 at the end, clamped so the face stays on screen. */
export function alongForDrop(side: PeekSide, drop: PeekOffset, column: { width: number; height: number }) {
  const vertical = side === 'left' || side === 'right';
  const span = vertical ? column.height : column.width;
  const value = vertical ? drop.y : drop.x;
  const inset = peekEdgeInset(span);
  const travel = span - inset * 2;
  if (travel <= 0) return 0.5;
  return Math.min(1, Math.max(0, (value - inset) / travel));
}

/**
 * Pose for a parked choice.
 * A saved `along` is never replaced by the default corner. Until the column has a real size, the caller keeps the previous pose (or waits) instead of flashing `peekLayout`.
 */
export function resolvePeekLayout(choice: PeekChoice, column: { width: number; height: number }): PeekLayout | undefined {
  if (choice.along == null) return peekLayout(choice.side);
  if (column.width < 2 || column.height < 2) return;
  return peekLayoutPlaced(choice.side, choice.along, column);
}

/**
 * Same pose as `peekLayout`, slid along the edge.
 * `along` 0 sits toward the start of that edge (top for sides, left for top/bottom).
 */
export function peekLayoutPlaced(side: PeekSide, along: number, column: { width: number; height: number }): PeekLayout {
  const base = peekLayout(side);
  const t = Math.min(1, Math.max(0, along));
  const { width, height } = baoPeekArt;
  const rad = base.settleRotate * Math.PI / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = baoPeekMarks.face.x - width / 2;
  const dy = baoPeekMarks.face.y - height / 2;
  const rx = dx * cos - dy * sin;
  const ry = dx * sin + dy * cos;
  if (side === 'left' || side === 'right') {
    const inset = peekEdgeInset(column.height);
    const faceY = inset + t * Math.max(0, column.height - inset * 2);
    const originY = faceY - height / 2 - ry;
    if (side === 'left') return { ...base, anchor: { left: base.anchor.left, top: originY } };
    return { ...base, anchor: { right: base.anchor.right, bottom: column.height - height - originY } };
  }
  const inset = peekEdgeInset(column.width);
  const faceX = inset + t * Math.max(0, column.width - inset * 2);
  const originX = faceX - width / 2 - rx;
  const right = column.width - width - originX;
  if (side === 'top') return { ...base, anchor: { top: base.anchor.top, right } };
  return { ...base, anchor: { bottom: base.anchor.bottom, right } };
}

/** Art-box top-left so the face sits on `faceAt` after the side's settled rotation. */
export function peekDragFrame(side: PeekSide, faceAt: PeekOffset) {
  const layout = peekLayout(side);
  const rad = layout.settleRotate * Math.PI / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = baoPeekMarks.face.x - baoPeekArt.width / 2;
  const dy = baoPeekMarks.face.y - baoPeekArt.height / 2;
  const rx = dx * cos - dy * sin;
  const ry = dx * sin + dy * cos;
  return {
    left: faceAt.x - baoPeekArt.width / 2 - rx,
    top: faceAt.y - baoPeekArt.height / 2 - ry,
    rotate: layout.settleRotate,
  };
}

export function peekChoiceFromStorage(raw: string | null | undefined): PeekChoice | undefined {
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw) as { side?: unknown; along?: unknown };
    if (typeof parsed.side !== 'string' || !isPeekSide(parsed.side)) return;
    const along = typeof parsed.along === 'number' && Number.isFinite(parsed.along) ? Math.min(1, Math.max(0, parsed.along)) : undefined;
    return along == null ? { side: parsed.side } : { side: parsed.side, along };
  } catch {
    return;
  }
}

function readSessionRaw() {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

/** User-chosen edge for this tab session. Absent until they drop Bao on an edge. */
export function readPeekChoice(): PeekChoice | undefined {
  if (sessionChoice) return sessionChoice;
  sessionChoice = peekChoiceFromStorage(readSessionRaw());
  return sessionChoice;
}

export function writePeekChoice(choice: PeekChoice) {
  const along = choice.along == null || !Number.isFinite(choice.along) ? undefined : Math.min(1, Math.max(0, choice.along));
  sessionChoice = along == null ? { side: choice.side } : { side: choice.side, along };
  try {
    sessionStorage?.setItem(SESSION_KEY, JSON.stringify(sessionChoice));
  } catch { /* private mode still keeps the in-memory choice */ }
}

export function resetPeekChoice() {
  sessionChoice = undefined;
  try {
    sessionStorage?.removeItem(SESSION_KEY);
  } catch { /* ignore */ }
}

/**
 * True from the moment Bao is grabbed until the pointer gesture finishes.
 * The Meet deck checks this synchronously so a drag cannot fall through as swipes.
 * Release clears on a microtask so the deck's own pointer-up still sees the grab.
 */
let baoDragBlocksDeck = false;
let baoDragEpoch = 0;

export function isBaoDragBlocking() {
  return baoDragBlocksDeck;
}

export function setBaoDragBlocking(active: boolean) {
  if (active) {
    baoDragEpoch += 1;
    baoDragBlocksDeck = true;
    return;
  }
  const epoch = baoDragEpoch;
  queueMicrotask(() => {
    if (baoDragEpoch === epoch) baoDragBlocksDeck = false;
  });
}

export function clearBaoDragBlocking() {
  baoDragBlocksDeck = false;
}

/** A previous drop wins over `?peek=` and over a fresh random side. */
export function initialPeekChoice(forced?: PeekSide): PeekChoice {
  return readPeekChoice() ?? { side: forced ?? pickPeekSide() };
}

/** Clockwise rotation in screen space, then the pose shift. Matches the view transform. */
export function projectPeekPoint(layout: PeekLayout, column: { width: number; height: number }, local: PeekOffset, phase: 'hidden' | 'look' | 'settle'): PeekOffset {
  const { width, height } = baoPeekArt;
  const rotation = (phase === 'hidden' ? layout.hiddenRotate : phase === 'look' ? layout.lookRotate : layout.settleRotate) * Math.PI / 180;
  const shift = phase === 'hidden' ? layout.hiddenShift : phase === 'look' ? layout.lookShift : layout.settleShift;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const dx = local.x - width / 2;
  const dy = local.y - height / 2;
  const rx = dx * cos - dy * sin;
  const ry = dx * sin + dy * cos;
  let x = layout.anchor.left ?? 0;
  let y = layout.anchor.top ?? 0;
  if (layout.anchor.right != null) x = column.width - width - layout.anchor.right;
  if (layout.anchor.bottom != null) y = column.height - height - layout.anchor.bottom;
  if (layout.shiftAxis === 'x') x += shift;
  else y += shift;
  return { x: x + width / 2 + rx, y: y + height / 2 + ry };
}

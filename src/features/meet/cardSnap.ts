/** How far a scroll should move to settle the swipe card, or 0 to leave it alone. */
export function cardSnapAdjustment(cardTop: number, portTop: number, portHeight: number, travel = 0): number {
  if (!Number.isFinite(cardTop) || !Number.isFinite(portTop) || !(portHeight > 0)) return 0;
  const offset = cardTop - portTop;
  const reach = Math.min(140, portHeight * 0.22);
  if (Number.isFinite(travel) && Math.abs(travel) > reach) return 0;
  if (Math.abs(offset) < 4 || Math.abs(offset) > reach) return 0;
  return offset;
}

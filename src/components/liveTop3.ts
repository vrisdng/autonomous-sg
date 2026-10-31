export type LiveRankRow = { id: string; name: string; likes: number };

export type LiveTop3Snapshot = {
  rows: LiveRankRow[];
  voters: number;
  open: () => void;
};

let current: LiveTop3Snapshot | null = null;
const listeners = new Set<() => void>();

export function publishLiveTop3(next: LiveTop3Snapshot | null) {
  current = next;
  listeners.forEach((listener) => listener());
}

export function subscribeLiveTop3(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function readLiveTop3() {
  return current;
}

/** Share of the group that liked this place. Drives the live bar width. */
export function likeShare(likes: number, voters: number) {
  if (voters <= 0 || likes <= 0) return 0;
  return Math.min(1, likes / voters);
}

/**
 * Quiet podium tones for the floating Top 3. Three oat steps —
 * distinct enough to rank, with no gold bar or coral chip.
 */
export const RANK_METALS = [
  { place: 'gold', fill: '#EFE3D6', ink: '#5C463C', ring: '#E4D4C4', bar: '#C4A88C' },
  { place: 'silver', fill: '#FAF4ED', ink: '#6A564A', ring: '#E7D9CC', bar: '#B7A494' },
  { place: 'bronze', fill: '#DCCBB8', ink: '#2B211C', ring: '#CDB89F', bar: '#8D7362' },
] as const;

export type RankMetal = (typeof RANK_METALS)[number];

export function rankMetal(index: number): RankMetal {
  const place = Math.min(RANK_METALS.length - 1, Math.max(0, index));
  return RANK_METALS[place]!;
}

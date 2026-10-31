import { describe, expect, it } from 'vitest';
import { RANK_METALS, likeShare, rankMetal } from './liveTop3Store';

describe('live top 3 bars', () => {
  it('grows with likes and shrinks when a like is no longer a share of the group', () => {
    expect(likeShare(0, 4)).toBe(0);
    expect(likeShare(1, 4)).toBe(0.25);
    expect(likeShare(4, 4)).toBe(1);
    expect(likeShare(2, 4)).toBeLessThan(likeShare(3, 4));
    expect(likeShare(3, 0)).toBe(0);
    expect(likeShare(5, 2)).toBe(1);
  });
});

describe('live top 3 podium', () => {
  it('gives 1st, 2nd, and 3rd their own metal', () => {
    expect(RANK_METALS.map((metal) => metal.place)).toEqual(['gold', 'silver', 'bronze']);
    expect(new Set(RANK_METALS.map((metal) => metal.fill)).size).toBe(3);
    expect(new Set(RANK_METALS.map((metal) => metal.ink)).size).toBe(3);
    expect(new Set(RANK_METALS.map((metal) => metal.bar)).size).toBe(3);
    expect(rankMetal(0).place).toBe('gold');
    expect(rankMetal(1).place).toBe('silver');
    expect(rankMetal(2).place).toBe('bronze');
    expect(rankMetal(-1)).toEqual(rankMetal(0));
    expect(rankMetal(9)).toEqual(rankMetal(2));
  });
});

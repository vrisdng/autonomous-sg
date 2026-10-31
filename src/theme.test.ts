import { describe, expect, it } from 'vitest';
import { colors } from './theme';

describe('Mix B palette', () => {
  it('is the live default', () => {
    expect(colors.paper).toBe('#F3EBE3');
    expect(colors.card).toBe('#FAF4ED');
    expect(colors.bambooSoft).toBe('#D4B79A');
    expect(colors.lime).toBe('#D4B79A');
    expect(colors.ink).toBe('#2B211C');
    expect(colors.coral).toBe('#FF9D84');
    expect(colors.blush).toBe('#F7D6DC');
    expect(colors.mint).toBe('#9FCFC0');
  });
});

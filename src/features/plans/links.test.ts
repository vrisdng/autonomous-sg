import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPlanInviteMessage, createPlanShareUrl, getPlanCodeFromUrl, isPlanCode, normalizePlanCode } from './links';

describe('plan links', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('normalizes ambiguous and punctuation characters out of a code', () => {
    expect(normalizePlanCode(' ab-c0i234 ')).toBe('ABC234');
    expect(isPlanCode('abc234')).toBe(true);
    expect(isPlanCode('ABC20I')).toBe(false);
  });

  it('reads web query links and native path links', () => {
    expect(getPlanCodeFromUrl('https://bojio.example/?plan=abc234')).toBe('ABC234');
    expect(getPlanCodeFromUrl('bojio://plan/XYZ789')).toBe('XYZ789');
    expect(getPlanCodeFromUrl('https://bojio.example/plan/JKM567')).toBe('JKM567');
    expect(getPlanCodeFromUrl('not a url')).toBeNull();
  });

  it('uses the configured public origin for share links', () => {
    vi.stubEnv('EXPO_PUBLIC_APP_URL', 'https://bojio.example/');
    expect(createPlanShareUrl('abc234')).toBe('https://bojio.example/plan/ABC234');
  });

  it('builds a pasteable invite from the existing share link', () => {
    vi.stubEnv('EXPO_PUBLIC_APP_URL', 'https://bojio.pages.dev/');
    expect(createPlanInviteMessage('abc234')).toBe('Apple67 · Join our supper party: https://bojio.pages.dev/plan/ABC234\nCode: ABC234');
  });
});

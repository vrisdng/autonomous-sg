const PLAN_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{6}$/;

export function normalizePlanCode(value: string) {
  return value.toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g, '').slice(0, 6);
}

export function isPlanCode(value: string) {
  return PLAN_CODE_PATTERN.test(normalizePlanCode(value));
}

export function getPlanCodeFromUrl(url: string) {
  try {
    const parsed = new URL(url);
    const queryCode = parsed.searchParams.get('plan');
    if (queryCode && isPlanCode(queryCode)) return normalizePlanCode(queryCode);

    const segments = parsed.pathname.split('/').filter(Boolean);
    if (parsed.protocol === 'bojio:' && parsed.hostname.toLowerCase() === 'plan') {
      const nativeCode = segments[0];
      return nativeCode && isPlanCode(nativeCode) ? normalizePlanCode(nativeCode) : null;
    }
    const planIndex = segments.findIndex((segment) => segment.toLowerCase() === 'plan');
    const pathCode = planIndex >= 0 ? segments[planIndex + 1] : undefined;
    return pathCode && isPlanCode(pathCode) ? normalizePlanCode(pathCode) : null;
  } catch {
    return null;
  }
}

export function createPlanShareUrl(code: string) {
  const normalized = normalizePlanCode(code);
  const configuredOrigin = process.env.EXPO_PUBLIC_APP_URL?.trim().replace(/\/$/, '');
  if (configuredOrigin) return `${configuredOrigin}/plan/${normalized}`;
  if (typeof window !== 'undefined' && window.location?.origin) return `${window.location.origin}/?plan=${normalized}`;
  return `bojio://plan/${normalized}`;
}

/** Ready-to-paste chat message. The link comes from the existing share URL. */
export function createPlanInviteMessage(code: string) {
  const normalized = normalizePlanCode(code);
  return `Apple67 · Join our supper party: ${createPlanShareUrl(normalized)}\nCode: ${normalized}`;
}

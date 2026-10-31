export type JoinAttempt = { token: string; name: string };

/** Legacy values are a bare token for whoever this browser already joined. They must not bind a newly typed name. */
export function parseJoinAttempt(raw: string | null): JoinAttempt | undefined {
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw) as { token?: unknown; name?: unknown };
    if (typeof parsed.token === 'string' && parsed.token.length >= 32 && typeof parsed.name === 'string' && parsed.name.trim()) {
      return { token: parsed.token, name: parsed.name.trim() };
    }
  } catch { /* legacy raw token */ }
  if (raw.length >= 32 && !raw.startsWith('{')) return { token: raw, name: '' };
}

/**
 * Retrying the same typed name reuses its token so a lost response cannot create a second person.
 * A different name, or a legacy token with no name, always starts a fresh token.
 */
export function tokenForTypedName(stored: JoinAttempt | undefined, typedName: string, fresh: string): JoinAttempt {
  const name = typedName.trim();
  if (stored?.token && stored.name && stored.name.toLocaleLowerCase() === name.toLocaleLowerCase()) {
    return { token: stored.token, name: stored.name };
  }
  return { token: fresh, name };
}

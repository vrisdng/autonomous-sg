import { describe, expect, it } from 'vitest';
import { parseJoinAttempt, tokenForTypedName } from './partyJoin';

describe('change name token', () => {
  const legacy = 'a'.repeat(64);
  const ada = 'b'.repeat(64);

  it('does not reuse a remembered token for a different typed name', () => {
    expect(parseJoinAttempt(legacy)).toEqual({ token: legacy, name: '' });
    expect(tokenForTypedName(parseJoinAttempt(legacy), 'Ada', ada)).toEqual({ token: ada, name: 'Ada' });
    const saved = tokenForTypedName(undefined, 'Ada', ada);
    expect(tokenForTypedName(saved, 'ada', 'c'.repeat(64))).toEqual(saved);
    expect(tokenForTypedName(saved, 'Lex', 'd'.repeat(64)).token).toBe('d'.repeat(64));
  });

  it('ignores a token that is not a join attempt', () => {
    expect(parseJoinAttempt(null)).toBeUndefined();
    expect(parseJoinAttempt('short')).toBeUndefined();
    expect(parseJoinAttempt('{"token":"x","name":"Ada"}')).toBeUndefined();
  });
});

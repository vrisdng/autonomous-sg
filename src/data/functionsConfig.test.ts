import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { functionsConfig } from './functionsConfig';

describe('functions config', () => {
  beforeEach(() => {
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://database.supabase.co/');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'database-key');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL', '');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_FUNCTIONS_KEY', '');
  });
  afterEach(() => vi.unstubAllEnvs());

  it('uses the database project by default', () => {
    expect(functionsConfig()).toEqual({ url: 'https://database.supabase.co', key: 'database-key' });
  });
  it('uses the functions project when both overrides are set', () => {
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL', 'https://functions.supabase.co/');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_FUNCTIONS_KEY', 'functions-key');
    expect(functionsConfig()).toEqual({ url: 'https://functions.supabase.co', key: 'functions-key' });
  });
  it('never pairs a functions URL with the database key', () => {
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL', 'https://functions.supabase.co');
    expect(functionsConfig()).toEqual({ url: 'https://database.supabase.co', key: 'database-key' });
  });
});

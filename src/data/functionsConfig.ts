// Edge Functions can live on a different project from the database. Set both overrides
// or neither: a publishable key only works on its own project.
export function functionsConfig() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL?.trim();
  const key = process.env.EXPO_PUBLIC_SUPABASE_FUNCTIONS_KEY?.trim();
  if (url && key) return { url: url.replace(/\/$/, ''), key };
  return {
    url: process.env.EXPO_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, ''),
    key: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim(),
  };
}

const readEnv = (value: string | undefined): string => (value ?? '').trim();

/**
 * Single source of truth for Vite environment variables. Values are read at
 * build/start time from `.env`, `.env.local`, or the shell environment.
 */
export const ENV = {
  CLERK_PUBLISHABLE_KEY: readEnv(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY),
  CLERK_AFTER_SIGN_OUT_URL: readEnv(import.meta.env.VITE_CLERK_AFTER_SIGN_OUT_URL),
  SUPABASE_URL: readEnv(import.meta.env.VITE_SUPABASE_URL),
  // Newer Supabase projects expose a publishable key instead of an anon key.
  SUPABASE_ANON_KEY: readEnv(
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  ),
} as const;

export function validateEnvironment(): { isValid: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!ENV.CLERK_PUBLISHABLE_KEY) missing.push('VITE_CLERK_PUBLISHABLE_KEY');
  if (!ENV.SUPABASE_URL) missing.push('VITE_SUPABASE_URL');
  if (!ENV.SUPABASE_ANON_KEY) missing.push('VITE_SUPABASE_ANON_KEY');

  return {
    isValid: missing.length === 0,
    missing,
  };
}

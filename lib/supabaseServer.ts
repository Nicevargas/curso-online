import { createClient } from '@supabase/supabase-js';

// Helper to find any env var regardless of exact casing, underscores, or prefix
function getEnvVal(possibleNames: string[]): string | undefined {
  if (typeof process === 'undefined' || !process.env) return undefined;
  
  // 1. Exact match first
  for (const name of possibleNames) {
    if (process.env[name]) return process.env[name];
  }

  // 2. Normalized match (ignore case and underscores)
  const envKeys = Object.keys(process.env);
  for (const target of possibleNames) {
    const cleanTarget = target.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const foundKey = envKeys.find(k => k.toUpperCase().replace(/[^A-Z0-9]/g, '') === cleanTarget);
    if (foundKey && process.env[foundKey]) {
      return process.env[foundKey];
    }
  }

  return undefined;
}

// Server-only Supabase client with Service Role key (for KB indexing, admin auth, and RAG queries)
export function getSupabaseAdmin() {
  const supabaseUrl = getEnvVal([
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_URL_KEY',
    'SUPABASE_PROJECT_URL',
  ]);

  const serviceRoleKey = getEnvVal([
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_SERVICE_ROLE',
    'SUPABASE_SERVICE_KEY',
    'SERVICE_ROLE_KEY',
    'MP_service_role',
    'SUPABASE_SECRET_KEY',
    'SERVICE_ROLE',
  ]);

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase URL ou SUPABASE_SERVICE_ROLE_KEY não configurados no servidor.');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

// Client for server-side read/write using anon key when service role is not available
export function getSupabaseServerClient() {
  const supabaseUrl = getEnvVal([
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_URL',
    'SUPABASE_PROJECT_URL',
  ]);

  const anonKey = getEnvVal([
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_ANON_KEY',
    'SUPABASE_KEY',
    'ANON_KEY',
  ]);

  if (!supabaseUrl || !anonKey) {
    throw new Error('Supabase URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY não configurados no servidor.');
  }

  return createClient(supabaseUrl, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}



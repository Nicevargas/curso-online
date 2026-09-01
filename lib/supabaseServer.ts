import { createClient } from '@supabase/supabase-js';

// Server-only Supabase client with Service Role key (for KB indexing, admin auth, and RAG queries)
export function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = 
    process.env.SUPABASE_SERVICE_ROLE_KEY || 
    process.env.SUPABASE_SERVICE_ROLE || 
    process.env.SUPABASE_SERVICE_KEY || 
    process.env.SERVICE_ROLE_KEY || 
    process.env.MP_service_role ||
    process.env.SUPABASE_SECRET_KEY;

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
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

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


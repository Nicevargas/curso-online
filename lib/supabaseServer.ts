import { createClient } from '@supabase/supabase-js';

// Server-only Supabase client with Service Role key (for KB indexing and RAG queries)
export function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.MP_service_role;

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

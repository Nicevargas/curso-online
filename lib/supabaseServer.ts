import { createClient } from '@supabase/supabase-js';

// Variáveis oficiais do projeto (mesmos nomes cadastrados na Vercel):
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

// Cliente server-only com Service Role (ignora RLS). Usado em /api/auth/cadastro,
// indexação da base de conhecimento e webhook do Mercado Pago.
export function getSupabaseAdmin() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados no servidor.');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Cliente server-side com Anon Key (respeita RLS), usado quando a Service Role não está disponível.
export function getSupabaseServerClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    throw new Error('SUPABASE_URL ou SUPABASE_ANON_KEY não configurados no servidor.');
  }

  return createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

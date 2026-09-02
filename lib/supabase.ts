import { createClient } from '@supabase/supabase-js';

// Variáveis do projeto: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
// A URL e a chave anônima chegam ao navegador pelo bloco `env` do next.config.ts.
// A Vercel grava esses valores durante o build: alterou a variável, refaça o deploy.
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

/** false quando as variáveis não chegaram ao navegador (build feito sem elas). */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured && typeof window !== 'undefined') {
  console.error(
    'SUPABASE_URL / SUPABASE_ANON_KEY não chegaram ao navegador. ' +
      'Confira as variáveis na Vercel e refaça o deploy — elas são gravadas durante o build.'
  );
}

// Placeholder só para o build não quebrar; em runtime o aviso acima já foi emitido.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'mistika-auth-token',
    },
  }
);

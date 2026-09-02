import { createClient } from '@supabase/supabase-js';

// SUPABASE_URL e SUPABASE_ANON_KEY chegam ao navegador via `env` em next.config.ts.
// (Sem esse mapeamento o Next.js não expõe variáveis sem prefixo NEXT_PUBLIC_.)
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  const msg =
    'SUPABASE_URL e SUPABASE_ANON_KEY (ou as versões com NEXT_PUBLIC_) não estão definidas. ' +
    'Login e cadastro não vão funcionar até configurá-las (Vercel: Environment Variables; local: .env.local).';
  if (typeof window !== 'undefined') {
    console.error(msg);
  }
}

// Placeholder apenas para não quebrar o build; em runtime o erro acima já foi logado.
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

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

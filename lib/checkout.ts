import { supabase } from './supabase';

export interface CheckoutResult {
  ok: boolean;
  error?: string;
}

/**
 * Inicia o checkout do Mercado Pago.
 * O token da sessão vai no header Authorization — a rota /api/checkout roda no
 * servidor e não enxerga a sessão do navegador de outra forma.
 */
export async function startCheckout(): Promise<CheckoutResult> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      return { ok: false, error: 'Sessão expirada. Faça login novamente.' };
    }

    const response = await fetch('/api/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.init_point) {
      return { ok: false, error: data.error || 'Não foi possível iniciar o pagamento.' };
    }

    window.location.href = data.init_point;
    return { ok: true };
  } catch (err: any) {
    console.error('Erro ao iniciar checkout:', err);
    return { ok: false, error: 'Erro de conexão com o servidor.' };
  }
}

/** Headers com o token da sessão, para chamar rotas de API autenticadas. */
export async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token
    ? { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }
    : { 'Content-Type': 'application/json' };
}

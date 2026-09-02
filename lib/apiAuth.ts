import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';

export interface AuthedUser {
  id: string;
  email?: string;
  role?: string;
}

/**
 * Resolve o usuário logado a partir do header `Authorization: Bearer <access_token>`.
 *
 * IMPORTANTE: não use o cliente de `lib/supabase.ts` em rotas de API — ele é o cliente
 * de navegador (persistSession/storageKey) e no servidor `auth.getUser()` sempre devolve
 * null, o que fazia toda rota protegida responder 401.
 */
export async function getUserFromRequest(req: NextRequest | Request): Promise<AuthedUser | null> {
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;

  const supabaseUrl = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return null;

  try {
    const client = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data, error } = await client.auth.getUser(token);
    if (error || !data?.user) return null;

    return { id: data.user.id, email: data.user.email || undefined };
  } catch {
    return null;
  }
}

/** Limite de uso simples, em memória, por usuário/IP (protege as rotas de IA). */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit = 20, windowMs = 60_000): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    return { ok: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  return { ok: true, retryAfter: 0 };
}

export function clientKey(req: NextRequest | Request, userId?: string | null): string {
  if (userId) return `u:${userId}`;
  const fwd = req.headers.get('x-forwarded-for') || '';
  return `ip:${fwd.split(',')[0].trim() || 'unknown'}`;
}

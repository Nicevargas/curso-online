/**
 * Checagem de papel/acesso centralizada.
 * Antes o código comparava contra 'admim master' (com typo) em 3 lugares diferentes e
 * usava `email.includes('admin')`, o que dava painel de admin para qualquer e-mail
 * contendo "admin".
 */
const ADMIN_ROLES = ['admin', 'admin master', 'administrador'];

export function isAdminRole(role?: string | null): boolean {
  if (!role) return false;
  return ADMIN_ROLES.includes(role.trim().toLowerCase());
}

/** A aluna tem acesso liberado ao conteúdo pago? */
export function hasPaidAccess(profile?: {
  is_paid?: boolean | null;
  status?: string | null;
  role?: string | null;
  plan?: string | null;
} | null): boolean {
  if (!profile) return false;
  if (profile.is_paid) return true;
  if (profile.status === 'Pago') return true;
  if (isAdminRole(profile.role)) return true;
  if (profile.plan === 'no_charge') return true;
  return false;
}

export function planLabel(plan?: string | null): string {
  switch (plan) {
    case '7_days_free':
      return '7 dias grátis';
    case '30_days_free':
      return '30 dias grátis';
    case 'no_charge':
      return 'Cortesia';
    case 'custom':
      return 'Assinatura ativa';
    default:
      return plan || 'Gratuito';
  }
}

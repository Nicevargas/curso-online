'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Lock, CreditCard, ExternalLink, LogOut, Loader2, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import MistikaLogo from '@/components/Logo';
import { usePathname } from 'next/navigation';
import { useSession } from '@/lib/SessionContext';
import { useToast } from '@/components/ToastProvider';
import { startCheckout } from '@/lib/checkout';
import { useTheme } from '@/lib/ThemeContext';

const PUBLIC_PATHS = ['/login', '/cadastro', '/privacidade'];

/**
 * Bloqueia o acesso quando o teste expira — mas sem o spinner de tela cheia a cada
 * navegação: a sessão e o perfil agora vêm do SessionProvider (uma leitura só) e o
 * conteúdo renderiza de forma otimista enquanto o perfil carrega.
 */
export default function SubscriptionGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, profile, loading, hasAccess } = useSession();
  const { theme } = useTheme();
  const toast = useToast();

  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [dismissedBanner, setDismissedBanner] = useState(false);
  // Momento fixo da montagem: Date.now() dentro do render é impuro e pode oscilar
  const [now] = useState(() => Date.now());

  const isPublic = PUBLIC_PATHS.includes(pathname);

  const { blocked, daysRemaining } = useMemo(() => {
    if (isPublic || !user || hasAccess) return { blocked: false, daysRemaining: null as number | null };

    const trialDays = profile?.plan === '30_days_free' ? 30 : 7;

    // plan_expires_at tem prioridade sobre a data de criação da conta
    const expiresAt = profile?.plan_expires_at ? new Date(profile.plan_expires_at) : null;
    const reference = expiresAt
      ? expiresAt.getTime()
      : new Date(user.created_at || now).getTime() + trialDays * 86_400_000;

    const remaining = Math.ceil((reference - now) / 86_400_000);
    return { blocked: remaining <= 0, daysRemaining: remaining };
  }, [isPublic, user, profile, hasAccess, now]);

  // Aviso amigável na reta final do teste
  useEffect(() => {
    if (blocked || dismissedBanner) return;
    if (daysRemaining !== null && daysRemaining > 0 && daysRemaining <= 3) {
      toast.toast(`Faltam ${daysRemaining} ${daysRemaining === 1 ? 'dia' : 'dias'} do seu acesso gratuito`, {
        kind: 'info',
        detail: 'Assine para continuar com todos os cursos liberados.',
        duration: 7000,
      });
      setDismissedBanner(true);
    }
  }, [daysRemaining, blocked, dismissedBanner, toast]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  const handleCheckout = async () => {
    setCheckoutLoading(true);
    const result = await startCheckout();
    if (!result.ok) toast.error(result.error || 'Erro ao iniciar o pagamento.');
    setCheckoutLoading(false);
  };

  // Enquanto a sessão carrega, deixa a página renderizar (cada página tem seu skeleton).
  if (loading || isPublic || !blocked) {
    return <>{children}</>;
  }

  const isDark = theme === 'dark';

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden ${isDark ? 'bg-[#000000]' : 'bg-[#f7f6f8]'}`}>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-[600px] bg-primary/10 blur-[120px] rounded-full -z-10" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`w-full max-w-md rounded-3xl p-8 backdrop-blur-xl text-center shadow-2xl border ${
          isDark ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'
        }`}
      >
        <div className="mb-8 flex justify-center">
          <MistikaLogo size="xl" />
        </div>

        <div className="size-16 bg-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Lock className="size-8 text-primary" />
        </div>

        <h2 className={`text-2xl font-bold mb-3 font-display ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
          Seu período de teste terminou
        </h2>
        <p className={`mb-8 text-sm leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
          Continue de onde parou: assine para manter acesso a todos os cursos, à mentoria com a comunidade e às
          ferramentas de IA da plataforma.
        </p>

        <div className="space-y-3">
          <button
            onClick={handleCheckout}
            disabled={checkoutLoading}
            className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 cursor-pointer"
          >
            {checkoutLoading ? <Loader2 className="size-5 animate-spin" /> : <CreditCard className="size-5" />}
            {checkoutLoading ? 'Iniciando...' : 'Assinar agora'}
            {!checkoutLoading && <ExternalLink className="size-4" />}
          </button>

          <button
            onClick={handleLogout}
            className={`w-full font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all border cursor-pointer ${
              isDark ? 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10' : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
            }`}
          >
            <LogOut className="size-5" />
            Sair da conta
          </button>
        </div>

        <p className="mt-8 text-xs text-slate-500 flex items-center justify-center gap-1.5">
          <Clock className="size-3.5" />
          O acesso é liberado automaticamente após o pagamento.
        </p>
      </motion.div>
    </div>
  );
}

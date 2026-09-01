'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, CreditCard, ExternalLink, LogOut, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import MistikaLogo from '@/components/Logo';
import { usePathname } from 'next/navigation';

interface SubscriptionGuardProps {
  children: React.ReactNode;
}

export default function SubscriptionGuard({ children }: SubscriptionGuardProps) {
  const [profile, setProfile] = useState<any>(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    async function checkSubscription() {
      // Don't block login or register pages
      if (pathname === '/login' || pathname === '/cadastro') {
        setLoading(false);
        return;
      }

      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          setLoading(false);
          return;
        }

        // Fetch profile to check role and payment status using maybeSingle to prevent PGRST116 error if row doesn't exist yet
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        if (profileError) {
          console.warn('Notice fetching profile in SubscriptionGuard:', profileError.message || profileError);
        }

        // If profile doesn't exist yet, construct fallback profile and attempt self-heal upsert
        const effectiveProfile = profileData || {
          id: user.id,
          name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Aluno',
          email: user.email || '',
          role: 'usuario',
          level: 1,
          status: 'Ativo',
          points: 0,
          streak: 0,
          plan: '7_days_free',
          is_paid: false,
        };

        setProfile(effectiveProfile);

        // If profile was missing from database, self-heal in background
        if (!profileData && user.id) {
          (async () => {
            try {
              const { error: upsertErr } = await supabase
                .from('profiles')
                .upsert(effectiveProfile, { onConflict: 'id' });
              if (upsertErr) {
                console.warn('Could not self-heal profile:', upsertErr.message);
              }
            } catch (e: any) {
              console.warn('Self-heal profile error:', e?.message);
            }
          })();
        }

        // Admins and Admin Masters are never blocked
        const role = (effectiveProfile?.role || '').toLowerCase();
        const userEmail = user.email?.toLowerCase() || '';
        const isSuperAdmin = userEmail === 'eunicelvargas@gmail.com';
        const isAdmin = role === 'admin' || role === 'admin master' || role === 'admim master' || isSuperAdmin;
        
        console.log('SubscriptionGuard Check:', {
          email: userEmail,
          role: role,
          isSuperAdmin,
          isAdmin,
          plan: effectiveProfile?.plan,
          status: effectiveProfile?.status,
          is_paid: effectiveProfile?.is_paid
        });

        if (isAdmin || effectiveProfile?.plan === 'no_charge') {
          console.log('User is admin or super admin, allowing access.');
          setIsBlocked(false);
          setLoading(false);
          return;
        }

        // If user is already marked as paid, don't block
        if (effectiveProfile?.status === 'Pago' || effectiveProfile?.is_paid === true) {
          console.log('User has paid status, allowing access.');
          setIsBlocked(false);
          setLoading(false);
          return;
        }

        const createdAt = new Date(user.created_at || Date.now());
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - createdAt.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        // Determine trial days based on plan
        const trialDays = effectiveProfile?.plan === '30_days_free' ? 30 : 7;
        const remaining = trialDays - Math.floor(diffTime / (1000 * 60 * 60 * 24));
        setDaysRemaining(remaining > 0 ? remaining : 0);

        if (diffDays > trialDays) {
          console.log(`User trial expired (${diffDays} > ${trialDays}). Blocking.`);
          setIsBlocked(true);
        } else {
          console.log(`User within trial period (${diffDays} <= ${trialDays}). Allowing access.`);
        }
      } catch (error) {
        console.error('Error checking subscription:', error);
      } finally {
        setLoading(false);
      }
    }

    checkSubscription();
  }, [pathname]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  const handleCheckout = async () => {
    try {
      setCheckoutLoading(true);
      const response = await fetch('/api/checkout', {
        method: 'POST',
      });
      
      const data = await response.json();
      
      if (data.init_point) {
        window.location.href = data.init_point;
      } else {
        console.error('Failed to get checkout URL:', data);
        const errorMsg = data.error || data.details || 'Erro ao iniciar o pagamento.';
        alert(`${errorMsg} Tente novamente mais tarde.`);
      }
    } catch (error: any) {
      console.error('Error initiating checkout:', error);
      alert(`Erro ao iniciar o pagamento: ${error.message || 'Verifique sua conexão.'}`);
    } finally {
      setCheckoutLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background-dark flex items-center justify-center">
        <div className="size-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (isBlocked) {
    return (
      <div className="min-h-screen bg-background-dark flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Background Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-[600px] bg-primary/10 blur-[120px] rounded-full -z-10" />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-xl text-center shadow-2xl"
        >
          <div className="mb-8 flex justify-center">
            <MistikaLogo size="xl" />
          </div>

          <div className="size-16 bg-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Lock className="size-8 text-primary" />
          </div>

          <h2 className="text-2xl font-bold text-slate-100 mb-4 font-display">Seu período de teste expirou</h2>
          <p className="text-slate-400 mb-8">
            Seu período gratuito do curso Canva com IA - O Desafio chegou ao fim. Para continuar acessando todas as aulas, mentorias, ferramentas e desafios, realize o pagamento da sua assinatura.
          </p>

          <div className="space-y-4">
            <button 
              onClick={handleCheckout}
              disabled={checkoutLoading}
              className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {checkoutLoading ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <CreditCard className="size-5" />
              )}
              {checkoutLoading ? 'Iniciando...' : 'Pagar Assinatura'}
              {!checkoutLoading && <ExternalLink className="size-4" />}
            </button>

            <button 
              onClick={handleLogout}
              className="w-full bg-white/5 hover:bg-white/10 text-slate-300 font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all border border-white/10"
            >
              <LogOut className="size-5" />
              Sair da conta
            </button>
          </div>

          <p className="mt-8 text-xs text-slate-500">
            Após o pagamento, seu acesso será liberado automaticamente em alguns instantes.
          </p>
        </motion.div>
      </div>
    );
  }

  return <>{children}</>;
}

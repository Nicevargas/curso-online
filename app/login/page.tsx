'use client';

import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Mail, Lock, ArrowRight, Sparkles, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import MistikaLogo from '@/components/Logo';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    async function checkUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        window.location.href = '/';
      }
    }
    checkUser();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setStatus('Verificando credenciais...');

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message === 'Email not confirmed') {
          setError('Seu e-mail ainda não foi confirmado. Verifique sua caixa de entrada.');
        } else {
          throw error;
        }
        return;
      }

      if (data.user) {
        setStatus('Sucesso! Redirecionando...');
        window.location.href = '/';
      }
    } catch (err: any) {
      if (err.message?.includes('rate limit exceeded')) {
        setError('Muitas tentativas de login. Por favor, aguarde alguns minutos.');
      } else {
        setError(err.message || 'Erro ao fazer login. Verifique suas credenciais.');
      }
    } finally {
      setLoading(false);
      if (!error) setStatus(null);
    }
  };

  return (
    <main className="min-h-screen bg-background-dark flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 size-[500px] bg-primary/20 blur-[120px] rounded-full -z-10" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-10">
          <motion.div 
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            className="inline-flex items-center justify-center mb-6"
          >
            <MistikaLogo size="xl" />
          </motion.div>
          <h1 className="text-3xl font-bold text-slate-100 font-display mb-2">Bem-vinda de volta</h1>
          <p className="text-slate-400">Continue sua jornada de despertar</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          {error && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3 text-red-400 text-sm"
            >
              <AlertCircle className="size-5 shrink-0" />
              <p>{error}</p>
            </motion.div>
          )}

          {status && !error && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="p-4 rounded-xl bg-primary/10 border border-primary/20 flex items-center gap-3 text-primary text-sm"
            >
              <Sparkles className="size-5 shrink-0 animate-pulse" />
              <p>{status}</p>
            </motion.div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">E-mail</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-slate-500" />
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-slate-100 focus:outline-none focus:border-primary/50 transition-colors"
                placeholder="seu@email.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Senha</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-slate-500" />
              <input 
                type="password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-slate-100 focus:outline-none focus:border-primary/50 transition-colors"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-primary/20"
          >
            {loading ? 'Entrando...' : (
              <>
                Entrar
                <ArrowRight className="size-5" />
              </>
            )}
          </button>

          <div className="text-center mt-6 space-y-3">
            <p className="text-slate-400 text-sm">
              Não tem uma conta?{' '}
              <Link href="/cadastro" className="text-primary font-bold hover:underline">
                Cadastre-se aqui
              </Link>
            </p>
            <p className="text-xs text-slate-500">
              <Link href="/privacidade" className="hover:text-slate-400 underline underline-offset-2 transition-colors">
                Política de Privacidade
              </Link>
            </p>
          </div>
        </form>
      </motion.div>
    </main>
  );
}

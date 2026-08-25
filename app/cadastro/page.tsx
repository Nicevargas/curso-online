'use client';

import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Mail, Lock, ArrowRight, Sparkles, AlertCircle, User } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import MistikaLogo from '@/components/Logo';

export default function CadastroPage() {
  const [name, setName] = useState('');
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

  const handleCadastro = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setStatus('Criando sua conta...');

    try {
      // 1. First, call our server-side registration API endpoint (auto-confirms & safely creates profile)
      const res = await fetch('/api/auth/cadastro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        // If server API reported an error, check if fallback to standard signUp is useful
        if (data.isDatabaseTriggerError) {
          throw new Error(data.error);
        }
        throw new Error(data.error || 'Erro ao criar conta.');
      }

      setStatus('Conta criada com sucesso! Autenticando...');

      // 2. Sign in the user immediately
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        console.warn('Erro no login automático:', signInError);
        setStatus('Conta criada com sucesso!');
        router.push('/login?cadastrado=true');
        return;
      }

      setStatus('Pronto! Redirecionando...');
      window.location.href = '/';
    } catch (err: any) {
      console.error('Erro no cadastro:', err);
      if (err.message?.includes('rate limit exceeded')) {
        setError('Muitas tentativas em pouco tempo. Por favor, aguarde alguns instantes antes de tentar novamente.');
      } else {
        setError(err.message || 'Erro ao criar conta. Tente novamente.');
      }
    } finally {
      setLoading(false);
      if (!error) setStatus(null);
    }
  };

  return (
    <main className="min-h-screen bg-background-dark flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute bottom-1/4 right-1/2 translate-x-1/2 size-[500px] bg-primary/20 blur-[120px] rounded-full -z-10" />
      
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
          <h1 className="text-3xl font-bold text-slate-100 font-display mb-2">Crie sua conta</h1>
          <p className="text-slate-400">Comece sua jornada no workshop Canva com IA</p>
        </div>

        <form onSubmit={handleCadastro} className="space-y-4">
          {error && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3 text-red-400 text-sm"
            >
              <AlertCircle className="size-5 shrink-0 mt-0.5" />
              <p className="leading-relaxed">{error}</p>
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
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Nome Completo</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-slate-500" />
              <input 
                type="text" 
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-slate-100 focus:outline-none focus:border-primary/50 transition-colors"
                placeholder="Seu nome"
              />
            </div>
          </div>

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
                placeholder="Mínimo 6 caracteres"
                minLength={6}
              />
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-primary/20"
          >
            {loading ? 'Criando conta...' : (
              <>
                Criar Conta
                <ArrowRight className="size-5" />
              </>
            )}
          </button>

          <div className="text-center mt-8 space-y-3">
            <p className="text-slate-500 text-sm">
              Já tem uma conta?{' '}
              <Link href="/login" className="text-primary font-bold hover:underline">
                Entre aqui
              </Link>
            </p>
            <p className="text-xs text-slate-500">
              Ao se cadastrar, você concorda com a nossa{' '}
              <Link href="/privacidade" className="text-slate-400 hover:text-white underline underline-offset-2 transition-colors">
                Política de Privacidade
              </Link>
              .
            </p>
          </div>
        </form>

      </motion.div>
    </main>
  );
}

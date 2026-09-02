'use client';

import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { motion } from 'motion/react';
import { User, Award, Settings, LogOut, Star, TrendingUp, Shield, ArrowRight, CheckCircle2, AlertCircle, X, CreditCard, LayoutDashboard, Sun, Moon, ClipboardList } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { startCheckout } from '@/lib/checkout';
import { isAdminRole, hasPaidAccess, planLabel } from '@/lib/roles';
import { DEFAULT_JOURNEY_ID } from '@/lib/courses';
import { evaluateAchievements, levelFromPoints, EMPTY_STATS, type AchievementStats } from '@/lib/achievements';
import { useSession } from '@/lib/SessionContext';
import { useToast } from '@/components/ToastProvider';
import Image from 'next/image';
import { getDirectDriveLink } from '@/lib/utils';
import { useTheme } from '@/lib/ThemeContext';

interface UserProfile {
  id: string;
  name: string;
  avatar_url: string | null;
  level: number;
  role: string;
  status: string;
  points: number;
  streak: number;
  email?: string;
  bio?: string;
  created_at?: string;
  plan?: string;
  plan_expires_at?: string;
  is_paid?: boolean;
  journey_id?: string;
}

export default function PerfilPage() {
  const { theme, setTheme } = useTheme();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [userEmail, setUserEmail] = useState<string>('');
  const [stats, setStats] = useState<AchievementStats>(EMPTY_STATS);
  const [achievementsCount, setAchievementsCount] = useState(0);
  const [achievements, setAchievements] = useState<{ id: string, title: string }[]>([]);
  const [showAchievements, setShowAchievements] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [editPlan, setEditPlan] = useState('');
  const [editJourneyId, setEditJourneyId] = useState('');
  const [journeyTitle, setJourneyTitle] = useState<string | null>(null);
  const [availableJourneys, setAvailableJourneys] = useState<{ id: string, title: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    let isMounted = true;
    
    // Check for status in URL
    const params = new URLSearchParams(window.location.search);
    const status = params.get('status');
    if (status === 'success') {
      setMessage({ type: 'success', text: 'Pagamento confirmado! Sua assinatura está ativa.' });
      // Remove query param without reload
      window.history.replaceState({}, '', window.location.pathname);
    }

    async function fetchData() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          if (isMounted) setUserEmail(user.email || '');
          // Fetch profile
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .maybeSingle();
          
          if (isMounted && profileData && !profileError) {
            setProfile(profileData);
            setEditName(profileData.name || '');
            setEditBio(profileData.bio || '');
            setEditAvatar(profileData.avatar_url || '');
            setEditPlan(profileData.plan || '7_days_free');
            setEditJourneyId(profileData.journey_id || DEFAULT_JOURNEY_ID);

            // Fetch journey title
            const journeyId = profileData.journey_id || DEFAULT_JOURNEY_ID;
            const { data: journeyData } = await supabase
              .from('journeys')
              .select('title')
              .eq('id', journeyId)
              .single();
            
            if (journeyData) {
              setJourneyTitle(journeyData.title);
            }

            // Fetch all available journeys for selection
            const { data: allJourneys } = await supabase
              .from('journeys')
              .select('id, title');
            
            if (allJourneys) {
              setAvailableJourneys(allJourneys);
            }

            // Estatísticas para as conquistas (buscas em paralelo)
            const [progressRes, postsRes, diaryRes, sheetRes] = await Promise.all([
              supabase.from('lesson_progress').select('lesson_id').eq('user_id', user.id).eq('completed', true),
              supabase.from('community_posts').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
              supabase.from('diary_entries').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
              supabase.from('canva_business_sheets').select('business_name').eq('user_id', user.id).maybeSingle(),
            ]);

            const completedIds = (progressRes.data || []).map((p: any) => p.lesson_id);
            setAchievementsCount(completedIds.length);

            // As aulas ficam em `lessons` — antes os títulos eram buscados em `content`,
            // então a contagem e a lista de conquistas não batiam.
            if (completedIds.length > 0) {
              const [{ data: lessonRows }, { data: contentRows }] = await Promise.all([
                supabase.from('lessons').select('id, titulo').in('id', completedIds),
                supabase.from('content').select('id, title').in('id', completedIds),
              ]);
              const titles = [
                ...(lessonRows || []).map((l: any) => ({ id: l.id, title: l.titulo })),
                ...(contentRows || []).map((c: any) => ({ id: c.id, title: c.title })),
              ];
              setAchievements(titles);
            }

            // Cursos concluídos
            const { data: lessonsAll } = await supabase.from('lessons').select('id, journey_id');
            const byJourney = new Map<string, { total: number; done: number }>();
            (lessonsAll || []).forEach((l: any) => {
              if (!l.journey_id) return;
              const entry = byJourney.get(l.journey_id) || { total: 0, done: 0 };
              entry.total += 1;
              if (completedIds.includes(l.id)) entry.done += 1;
              byJourney.set(l.journey_id, entry);
            });
            const coursesCompleted = Array.from(byJourney.values()).filter(
              (v) => v.total > 0 && v.done >= v.total
            ).length;

            setStats({
              lessonsCompleted: completedIds.length,
              streak: profileData.streak || 0,
              points: profileData.points || 0,
              level: profileData.level || 1,
              coursesCompleted,
              posts: postsRes.count || 0,
              diaryEntries: diaryRes.count || 0,
              sheetCompleted: Boolean(sheetRes.data?.business_name),
            });
          }
        } else {
          // If no user, redirect to login
          if (isMounted) window.location.href = '/login';
        }
      } catch (err) {
        console.error('Error fetching data:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    fetchData();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        window.location.href = '/login';
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      window.location.href = '/login';
    } catch (err) {
      console.error('Error signing out:', err);
    }
  };

  const handleCheckout = async () => {
    setCheckoutLoading(true);
    const result = await startCheckout();
    if (!result.ok) {
      setMessage({ type: 'error', text: result.error || 'Erro ao iniciar o pagamento.' });
    }
    setCheckoutLoading(false);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    
    setSaving(true);
    setMessage(null);
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          name: editName,
          bio: editBio,
          avatar_url: editAvatar,
        })
        .eq('id', profile.id);

      if (error) throw error;

      setProfile({
        ...profile,
        name: editName,
        bio: editBio,
        avatar_url: editAvatar,
      });
      
      setIsEditing(false);
      setMessage({ type: 'success', text: 'Perfil atualizado com sucesso!' });
      
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      console.error('Error updating profile:', err);
      setMessage({ type: 'error', text: 'Erro ao atualizar perfil.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="size-8 border-2 border-primary border-t-transparent rounded-full"
        />
      </main>
    );
  }

  const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.name || 'Aluno')}&background=7311d4&color=fff&bold=true`;
  const displayAvatar = (!avatarError && profile?.avatar_url && profile.avatar_url.trim() !== '') 
    ? getDirectDriveLink(profile.avatar_url) 
    : defaultAvatar;

  return (
    <main className="min-h-screen bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 relative pb-24 transition-colors duration-200">
      <Header />
      
      {/* Background Elements */}
      <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-primary/10 to-transparent -z-10" />
      <div className="absolute top-20 right-0 size-64 bg-accent-gold/5 blur-[100px] rounded-full -z-10" />

      <div className="max-w-4xl mx-auto px-4 py-8">
        {message && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mb-6 p-4 rounded-2xl border ${
              message.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400'
            } text-sm flex items-center gap-3`}
          >
            {message.type === 'success' ? <CheckCircle2 className="size-5" /> : <AlertCircle className="size-5" />}
            {message.text}
          </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Profile Info Column */}
          <div className="lg:col-span-5 flex flex-col items-center lg:items-start text-center lg:text-left">
            <div className="relative group mb-6">
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="relative size-40 rounded-full overflow-hidden border-4 border-primary/30 shadow-2xl shadow-primary/20"
              >
                <Image 
                  src={displayAvatar} 
                  alt={profile?.name || 'Usuário'} 
                  fill 
                  className="object-cover"
                  referrerPolicy="no-referrer"
                  onError={() => setAvatarError(true)}
                  unoptimized={displayAvatar.includes('googleusercontent.com') || displayAvatar.includes('drive.google.com')}
                />
              </motion.div>
              {!isEditing && (
                <button 
                  onClick={() => setIsEditing(true)}
                  className="absolute bottom-4 right-0 size-10 bg-primary rounded-full flex items-center justify-center border-4 border-background-light dark:border-background-dark text-white shadow-lg hover:scale-110 transition-transform cursor-pointer"
                >
                  <Settings className="size-5" />
                </button>
              )}
            </div>

            {!isEditing ? (
              <div className="space-y-4">
                <div>
                  <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 font-display mb-2">
                    {profile?.name || 'Buscador Mistika'}
                  </h1>
                  {profile?.bio && (
                    <p className="text-base text-slate-600 dark:text-slate-400 italic leading-relaxed max-w-sm">
                      &quot;{profile.bio}&quot;
                    </p>
                  )}
                </div>
                
                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2">
                  {isAdminRole(profile?.role) ? (
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/20 border border-red-500/30">
                      <Shield className="size-3 text-red-400" />
                      <p className="text-[10px] text-red-400 font-bold uppercase tracking-widest">
                        Administrador
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/20 border border-primary/30">
                      <Shield className="size-3 text-primary" />
                      <p className="text-[10px] text-primary font-bold uppercase tracking-widest">
                        {profile?.role || 'Iniciada'} • Nível {profile?.level || 1}
                      </p>
                    </div>
                  )}
                  
                  {profile?.plan && (
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent-gold/20 border border-accent-gold/30">
                      <Star className="size-3 text-accent-gold" />
                      <p className="text-[10px] text-accent-gold font-bold uppercase tracking-widest">
                        {profile.plan === '7_days_free' ? '7 dias grátis' : 
                         profile.plan === '30_days_free' ? '30 dias grátis' : 
                         profile.plan === 'no_charge' ? 'Sem cobrança' : profile.plan}
                      </p>
                    </div>
                  )}

                  {journeyTitle && (
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30">
                      <TrendingUp className="size-3 text-emerald-400" />
                      <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">
                        Jornada: {journeyTitle}
                      </p>
                    </div>
                  )}
                  
                  {!hasPaidAccess(profile) && (
                    <button 
                      onClick={handleCheckout}
                      disabled={checkoutLoading}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
                    >
                      {checkoutLoading ? (
                        <div className="size-3 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <CreditCard className="size-3 text-emerald-400" />
                      )}
                      <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">
                        {checkoutLoading ? 'Iniciando...' : 'Assinar Agora'}
                      </p>
                    </button>
                  )}
                </div>

                {profile?.created_at && (
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest">
                    Membro desde {new Date(profile.created_at).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                  </p>
                )}
              </div>
            ) : (
              <form onSubmit={handleUpdateProfile} className="w-full space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Nome</label>
                  <input 
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-slate-200 focus:outline-none focus:border-primary/50"
                    placeholder="Seu nome"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Mantra / Bio</label>
                  <textarea 
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-slate-200 focus:outline-none focus:border-primary/50 min-h-[80px]"
                    placeholder="Seu mantra pessoal..."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">URL do Avatar</label>
                  <input 
                    type="text"
                    value={editAvatar}
                    onChange={(e) => setEditAvatar(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-slate-200 focus:outline-none focus:border-primary/50"
                    placeholder="Link da imagem"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <button 
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="flex-1 py-3 rounded-xl bg-white/5 text-slate-400 font-bold text-sm hover:bg-white/10 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    disabled={saving}
                    className="flex-1 py-3 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {saving ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Stats and Shortcuts Column */}
          <div className="lg:col-span-7 space-y-8">
            {!isEditing && (
              <>
                {profile?.role === 'admin' && (
                  <div className="p-6 rounded-3xl bg-red-500/5 border border-red-500/10">
                    <h2 className="text-xs font-bold text-red-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <Settings className="size-4" />
                      Painel Administrativo
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button className="text-left p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors text-sm text-slate-200 flex items-center justify-between group">
                        <span>Gerenciar Membros</span>
                        <ArrowRight className="size-4 text-slate-500 group-hover:translate-x-1 transition-transform" />
                      </button>
                      <button className="text-left p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors text-sm text-slate-200 flex items-center justify-between group">
                        <span>Publicar Conteúdo</span>
                        <ArrowRight className="size-4 text-slate-500 group-hover:translate-x-1 transition-transform" />
                      </button>
                    </div>
                  </div>
                )}



                <div className="space-y-4">
                  <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Acesso Rápido</h3>
                  
                  <div className="grid grid-cols-1 gap-3">
                    {!hasPaidAccess(profile) && (
                      <button 
                        onClick={handleCheckout}
                        disabled={checkoutLoading}
                        className="flex items-center justify-between p-5 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all hover:pl-6 group disabled:opacity-50"
                      >
                        <div className="flex items-center gap-4">
                          <div className="size-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                            {checkoutLoading ? (
                              <div className="size-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <CreditCard className="size-6 text-emerald-400" />
                            )}
                          </div>
                          <div className="text-left">
                            <p className="text-base font-bold text-emerald-400">Assinar Agora</p>
                            <p className="text-[10px] text-emerald-500/70 uppercase tracking-widest">Libere acesso total ao sistema</p>
                          </div>
                        </div>
                        <ArrowRight className="size-5 text-emerald-500/30 group-hover:translate-x-1 transition-transform" />
                      </button>
                    )}

                    {(profile?.role === 'admin' || userEmail?.includes('admin') || userEmail?.includes('eunicelvargas@gmail.com')) && (
                      <Link 
                        href="/admin"
                        className="flex items-center justify-between p-5 rounded-3xl bg-primary/10 border border-primary/30 hover:bg-primary/20 transition-all hover:pl-6 group"
                      >
                        <div className="flex items-center gap-4">
                          <div className="size-12 rounded-2xl bg-primary/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <LayoutDashboard className="size-6 text-primary" />
                          </div>
                          <div className="text-left">
                            <p className="text-base font-bold text-slate-100">Painel do Administrador</p>
                            <p className="text-[10px] text-primary/80 uppercase tracking-widest">Gestão de Aulas & Conteúdos (CRUD)</p>
                          </div>
                        </div>
                        <ArrowRight className="size-5 text-primary group-hover:translate-x-1 transition-transform" />
                      </Link>
                    )}

                    {/* A Ficha do Meu Negócio - Curso Canva */}
                    <Link 
                      href="/ficha"
                      className="flex items-center justify-between p-5 rounded-3xl bg-primary/10 border border-primary/30 hover:bg-primary/20 transition-all hover:pl-6 group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="size-12 rounded-2xl bg-primary/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <ClipboardList className="size-6 text-primary" />
                        </div>
                        <div className="text-left">
                          <p className="text-base font-bold text-slate-100">Ficha do Negócio (Curso de Canva)</p>
                          <p className="text-[10px] text-primary/80 uppercase tracking-widest">Módulo 1 · Base de dados e prompts do Canva</p>
                        </div>
                      </div>
                      <ArrowRight className="size-5 text-primary group-hover:translate-x-1 transition-transform" />
                    </Link>

                    {/* Theme Selector (Dark / Light) */}
                    <div className="p-5 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`size-12 rounded-2xl flex items-center justify-center ${theme === 'light' ? 'bg-amber-500/20 text-amber-500' : 'bg-primary/20 text-primary'}`}>
                          {theme === 'light' ? <Sun className="size-6" /> : <Moon className="size-6" />}
                        </div>
                        <div className="text-left">
                          <p className="text-base font-bold text-slate-100">Tema do Aplicativo</p>
                          <p className="text-[10px] text-slate-400 uppercase tracking-widest">
                            {theme === 'dark' ? 'Modo Escuro (Padrão)' : 'Modo Claro'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center p-1 rounded-2xl bg-black/40 border border-white/10">
                        <button
                          type="button"
                          onClick={() => setTheme('dark')}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                            theme === 'dark'
                              ? 'bg-primary text-white shadow-md shadow-primary/30'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          <Moon className="size-3.5" />
                          <span>Dark</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setTheme('light')}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                            theme === 'light'
                              ? 'bg-accent-gold text-black font-bold shadow-md shadow-accent-gold/20'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          <Sun className="size-3.5" />
                          <span>Light</span>
                        </button>
                      </div>
                    </div>

                    {/* Gamificação: pontos, sequência e nível existiam no banco e não apareciam */}
                    <div className="p-5 rounded-3xl bg-white/5 border border-white/10">
                      <div className="grid grid-cols-3 gap-3 mb-4">
                        <div className="text-center">
                          <p className="text-2xl font-bold font-display text-primary leading-none">{stats.points}</p>
                          <p className="text-[10px] uppercase tracking-widest text-slate-500 mt-1">Pontos</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold font-display text-orange-400 leading-none">{stats.streak}</p>
                          <p className="text-[10px] uppercase tracking-widest text-slate-500 mt-1">Sequência</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold font-display text-accent-gold leading-none">
                            {levelFromPoints(stats.points).level}
                          </p>
                          <p className="text-[10px] uppercase tracking-widest text-slate-500 mt-1">Nível</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] font-bold mb-1.5">
                        <span className="text-slate-500">
                          Nível {levelFromPoints(stats.points).level}
                        </span>
                        <span className="text-primary font-mono">
                          {levelFromPoints(stats.points).current}/{levelFromPoints(stats.points).needed} XP
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${levelFromPoints(stats.points).percent}%` }}
                          transition={{ duration: 0.7, ease: 'easeOut' }}
                          className="h-full rounded-full bg-gradient-to-r from-primary to-accent-gold"
                        />
                      </div>
                    </div>

                    <button 
                      onClick={() => setShowAchievements(true)}
                      className="flex items-center justify-between p-5 rounded-3xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all hover:pl-6 group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="size-12 rounded-2xl bg-accent-gold/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Award className="size-6 text-accent-gold" />
                        </div>
                        <div className="text-left">
                          <p className="text-base font-bold text-slate-200">Minhas Conquistas</p>
                          <p className="text-[10px] text-slate-500 uppercase tracking-widest">
                            {evaluateAchievements(stats).filter((a) => a.unlocked).length} de {evaluateAchievements(stats).length} desbloqueadas
                          </p>
                        </div>
                      </div>
                      <ArrowRight className="size-5 text-slate-600 group-hover:translate-x-1 transition-transform" />
                    </button>

                    <button 
                      onClick={handleSignOut}
                      className="flex items-center justify-between p-5 rounded-3xl bg-red-500/5 border border-red-500/10 hover:bg-red-500/10 transition-all hover:pl-6 group text-red-400"
                    >
                      <div className="flex items-center gap-4">
                        <div className="size-12 rounded-2xl bg-red-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <LogOut className="size-6" />
                        </div>
                        <div className="text-left">
                          <p className="text-base font-bold">Sair da Conta</p>
                          <p className="text-[10px] text-red-400/50 uppercase tracking-widest">Encerrar sessão atual</p>
                        </div>
                      </div>
                      <ArrowRight className="size-5 text-red-500/30 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <BottomNav />

      {/* Achievements Modal */}
      {showAchievements && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative w-full max-w-md bg-background-dark border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
          >
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-accent-gold/10 flex items-center justify-center">
                  <Award className="size-5 text-accent-gold" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-100">Minhas Conquistas</h3>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest">Lições Concluídas</p>
                </div>
              </div>
              <button 
                onClick={() => setShowAchievements(false)}
                className="p-2 rounded-full hover:bg-white/5 text-slate-400 transition-colors"
              >
                <X className="size-5" />
              </button>
            </div>
            
            <div className="p-6 max-h-[60vh] overflow-y-auto space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {evaluateAchievements(stats).map((a) => (
                  <motion.div
                    key={a.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-4 rounded-2xl border flex items-start gap-3 transition-all ${
                      a.unlocked
                        ? 'bg-accent-gold/10 border-accent-gold/30'
                        : 'bg-white/5 border-white/10 opacity-60'
                    }`}
                  >
                    <span className={`text-2xl leading-none ${a.unlocked ? '' : 'grayscale'}`}>{a.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-bold ${a.unlocked ? 'text-accent-gold' : 'text-slate-300'}`}>
                        {a.title}
                      </p>
                      <p className="text-[11px] text-slate-500 leading-snug">{a.description}</p>
                      {!a.unlocked && (
                        <div className="w-full h-1 rounded-full bg-white/10 overflow-hidden mt-2">
                          <div
                            className="h-full rounded-full bg-primary/60"
                            style={{ width: `${Math.round(a.progressValue * 100)}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>

              {achievements.length > 0 && (
                <div className="pt-4 mt-2 border-t border-white/10">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                    Aulas concluídas ({achievements.length})
                  </p>
                  <div className="space-y-1.5">
                    {achievements.slice(0, 20).map((achievement) => (
                      <div key={achievement.id} className="flex items-center gap-2 text-xs text-slate-300">
                        <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                        <span className="truncate">{achievement.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-6 bg-white/5 border-t border-white/10">
              <button 
                onClick={() => setShowAchievements(false)}
                className="w-full py-3 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary/90 transition-colors"
              >
                Fechar
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </main>
  );
}

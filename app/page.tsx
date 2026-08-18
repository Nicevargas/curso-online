'use client';

import Header from '@/components/Header';
import FeaturedLesson from '@/components/FeaturedLesson';
import EvolutionDiary from '@/components/EvolutionDiary';
import BottomNav from '@/components/BottomNav';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, Play, X, Sparkles, Clock, Users, MessageSquare, Users2, CheckSquare, Lightbulb, ArrowRight, Layers, Wand2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { getDirectDriveLink, getEmbedVideoUrl } from '@/lib/utils';
import { useTheme } from '@/lib/ThemeContext';

interface JourneyItem {
  id: string;
  title: string;
  archetype: string;
  image_url: string | null;
  duration: string;
  steps: number;
  user_id?: string;
}

interface LessonData {
  id: string;
  titulo: string;
  descricao: string;
  video_url: string;
  capa_url: string;
  pdf_url: string;
  duracao?: string;
  categoria?: string;
  dia?: string | number;
}

export default function Page() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [featuredJourneys, setFeaturedJourneys] = useState<JourneyItem[]>([]);
  const [featuredLesson, setFeaturedLesson] = useState<LessonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lessonLoading, setLessonLoading] = useState(true);
  const [activeVideo, setActiveVideo] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function checkAuthAndFetchData() {
      console.log('Iniciando busca de dados...');
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        if (isMounted) window.location.href = '/login';
        return;
      }

      try {
        // Fetch user profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, level, journey_id')
          .eq('id', user.id)
          .maybeSingle();

        const journeyId = profile?.journey_id || 'fa512a52-9742-410f-a71b-0bd4013bec8d';

        // Fetch user progress
        const { data: progressData } = await supabase
          .from('lesson_progress')
          .select('lesson_id')
          .eq('user_id', user.id)
          .eq('completed', true);
        
        const completedIds = new Set(progressData?.map(p => p.lesson_id) || []);

        // Fetch Welcome Lesson
        setLessonLoading(true);
        let welcomeData: LessonData | null = null;

        // 1. Try lessons table for Boas-vindas
        const { data: lessonWelcome } = await supabase
          .from('lessons')
          .select('*')
          .or('categoria.eq.Boas-vindas,categoria.eq.Boas Vindas,categoria.eq.boas-vindas')
          .limit(1)
          .maybeSingle();
        
        if (lessonWelcome) {
          welcomeData = lessonWelcome;
        } else {
          // 2. Try content table - more robust search
          const { data: allContent } = await supabase
            .from('content')
            .select('*');
          
          if (allContent) {
            const welcomeItem = allContent.find(item => {
              const arch = (item.arquetipo || item.archetype || '').toLowerCase();
              return arch === 'boas-vindas' || arch === 'boas vindas';
            });

            if (welcomeItem) {
              welcomeData = {
                id: welcomeItem.id,
                titulo: welcomeItem.titulo || welcomeItem.title || 'Boas-vindas',
                descricao: welcomeItem.descricao || welcomeItem.description || '',
                video_url: welcomeItem.media_url || welcomeItem.video_url || '',
                capa_url: welcomeItem.thumbnail_url || welcomeItem.capa_url || welcomeItem.image_url || '',
                pdf_url: welcomeItem.pdf_url || '',
                categoria: 'Boas-vindas'
              };
            }
          }
        }
        
        // Logic: If no progress, show welcome. If progress, show next lesson.
        if (completedIds.size === 0 && welcomeData) {
          setFeaturedLesson(welcomeData);
        } else {
          // Fetch all lessons for the user's journey to find the next one
          const { data: allLessons } = await supabase
            .from('lessons')
            .select('*')
            .eq('journey_id', journeyId)
            .order('dia', { ascending: true })
            .order('created_at', { ascending: true });

          let nextLesson = allLessons?.find(l => !completedIds.has(l.id));

          // If no lessons found for this journey, try all lessons as fallback
          if (!nextLesson && (!allLessons || allLessons.length === 0)) {
            const { data: fallbackLessons } = await supabase
              .from('lessons')
              .select('*')
              .order('dia', { ascending: true })
              .order('created_at', { ascending: true });
            
            nextLesson = fallbackLessons?.find(l => !completedIds.has(l.id));
          }

          if (nextLesson) {
            setFeaturedLesson(nextLesson);
          } else if (welcomeData) {
            setFeaturedLesson(welcomeData);
          } else if (allLessons && allLessons.length > 0) {
            setFeaturedLesson(allLessons[0]);
          }
        }
        setLessonLoading(false);

        // Fetch Recommended Journeys
        const { data: journeysData } = await supabase
          .from('journeys')
          .select('*')
          .limit(6);

        if (isMounted && journeysData) {
          setFeaturedJourneys(journeysData);
        }
      } catch (err) {
        console.error('Error fetching home data:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    checkAuthAndFetchData();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        window.location.href = '/login';
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <main className={`min-h-screen relative pb-24 transition-colors duration-200 ${
      isDark ? 'bg-[#000000] text-slate-100' : 'bg-[#f7f6f8] text-slate-900'
    }`}>
      <Header />
      <div className="max-w-5xl mx-auto px-0 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:pt-8">
          {/* Main Content Column */}
          <div className="lg:col-span-8 space-y-8">
            <FeaturedLesson lesson={featuredLesson} loading={lessonLoading} />

            {/* Action Cards Section */}
            <section className="px-4 sm:px-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 1. Conselheira & Consultora de IA */}
                <Link href="/lyra">
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    whileHover={{ y: -4 }}
                    className={`relative overflow-hidden rounded-3xl p-6 h-full group transition-all ${
                      isDark 
                        ? 'bg-gradient-to-br from-primary/25 to-accent-purple/20 border border-primary/30 hover:border-primary/60' 
                        : 'bg-white border border-primary/20 shadow-sm hover:shadow-md hover:border-primary/40'
                    }`}
                  >
                    <div className="absolute top-0 right-0 -mt-4 -mr-4 size-32 bg-primary/10 rounded-full blur-3xl group-hover:bg-primary/20 transition-colors" />
                    <div className="relative z-10">
                      <div className="size-12 rounded-2xl bg-primary/20 flex items-center justify-center mb-4 border border-primary/30">
                        <MessageSquare className="size-6 text-primary" />
                      </div>
                      <h3 className={`text-xl font-bold mb-2 font-display ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                        Conselheira & Consultora IA
                      </h3>
                      <p className={`text-sm leading-relaxed mb-4 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                        Pesquise sobre as aulas do curso, tire dúvidas de Canva, crie prompts de imagens e receba consultoria estratégica.
                      </p>
                      <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-widest group-hover:text-primary transition-colors">
                        Consultar Agora
                        <Sparkles className="size-3" />
                      </div>
                    </div>
                  </motion.div>
                </Link>

                {/* 2. Mentoria & Comunidade */}
                <Link href="/comunidade">
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    whileHover={{ y: -4 }}
                    className={`relative overflow-hidden rounded-3xl p-6 h-full group transition-all ${
                      isDark 
                        ? 'bg-white/5 border border-white/10 hover:border-primary/30 hover:bg-white/[0.07]' 
                        : 'bg-white border border-slate-200 shadow-sm hover:shadow-md hover:border-primary/30'
                    }`}
                  >
                    <div className="relative z-10">
                      <div className={`size-12 rounded-2xl flex items-center justify-center mb-4 border ${
                        isDark ? 'bg-white/10 border-white/10' : 'bg-slate-100 border-slate-200'
                      }`}>
                        <Users2 className={`size-6 ${isDark ? 'text-slate-300' : 'text-slate-700'}`} />
                      </div>
                      <h3 className={`text-xl font-bold mb-2 font-display ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                        Mentoria & Comunidade
                      </h3>
                      <p className={`text-sm leading-relaxed mb-4 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                        Espaço de mentoria para compartilhar suas artes, tirar dúvidas práticas e interagir com os outros alunos.
                      </p>
                      <div className={`flex items-center gap-2 text-xs font-bold uppercase tracking-widest group-hover:text-primary transition-colors ${
                        isDark ? 'text-slate-300' : 'text-slate-700'
                      }`}>
                        Acessar Mentoria
                        <ArrowRight className="size-3" />
                      </div>
                    </div>
                  </motion.div>
                </Link>

                {/* 3. Planner de Tarefas */}
                <Link href="/planner">
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    whileHover={{ y: -4 }}
                    className={`relative overflow-hidden rounded-3xl p-6 h-full group transition-all ${
                      isDark 
                        ? 'bg-gradient-to-br from-indigo-500/20 to-primary/20 border border-indigo-500/20 hover:border-indigo-500/50' 
                        : 'bg-white border border-indigo-200 shadow-sm hover:shadow-md hover:border-indigo-300'
                    }`}
                  >
                    <div className="absolute top-0 right-0 -mt-4 -mr-4 size-32 bg-indigo-500/10 rounded-full blur-3xl group-hover:bg-indigo-500/20 transition-colors" />
                    <div className="relative z-10">
                      <div className="size-12 rounded-2xl bg-indigo-500/20 flex items-center justify-center mb-4 border border-indigo-500/30">
                        <CheckSquare className="size-6 text-indigo-500" />
                      </div>
                      <h3 className={`text-xl font-bold mb-2 font-display ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                        Planner de Tarefas
                      </h3>
                      <p className={`text-sm leading-relaxed mb-4 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                        Organize seu fluxo de trabalho, prazos de postagens, criação de carrosséis e checklist de metas no Canva.
                      </p>
                      <div className="flex items-center gap-2 text-xs font-bold text-indigo-500 uppercase tracking-widest group-hover:text-indigo-600 transition-colors">
                        Abrir Planner
                        <ArrowRight className="size-3" />
                      </div>
                    </div>
                  </motion.div>
                </Link>

                {/* 4. Dicas de Conteúdo */}
                <Link href="/dicas">
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    whileHover={{ y: -4 }}
                    className={`relative overflow-hidden rounded-3xl p-6 h-full group transition-all ${
                      isDark 
                        ? 'bg-gradient-to-br from-accent-gold/20 to-amber-500/20 border border-accent-gold/20 hover:border-accent-gold/50' 
                        : 'bg-white border border-amber-200 shadow-sm hover:shadow-md hover:border-amber-300'
                    }`}
                  >
                    <div className="absolute top-0 right-0 -mt-4 -mr-4 size-32 bg-accent-gold/10 rounded-full blur-3xl group-hover:bg-accent-gold/20 transition-colors" />
                    <div className="relative z-10">
                      <div className="size-12 rounded-2xl bg-accent-gold/20 flex items-center justify-center mb-4 border border-accent-gold/30">
                        <Lightbulb className="size-6 text-accent-gold" />
                      </div>
                      <h3 className={`text-xl font-bold mb-2 font-display ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                        Dicas de Conteúdo
                      </h3>
                      <p className={`text-sm leading-relaxed mb-4 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                        Prompts prontos para Canva IA, fórmulas de carrossel, ganchos magnéticos e paletas de cores profissionais.
                      </p>
                      <div className="flex items-center gap-2 text-xs font-bold text-accent-gold uppercase tracking-widest group-hover:text-amber-600 transition-colors">
                        Ver Dicas & Prompts
                        <Sparkles className="size-3" />
                      </div>
                    </div>
                  </motion.div>
                </Link>
              </div>
            </section>
          </div>
          
          {/* Sidebar Column on Desktop */}
          <div className="lg:col-span-4 space-y-6 px-4 lg:px-0">
            <div className="sticky top-24 space-y-6">
              <EvolutionDiary />
            </div>
          </div>
        </div>
      </div>
      <BottomNav />

      {/* Video Modal */}
      <AnimatePresence>
        {activeVideo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm"
            onClick={() => setActiveVideo(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-4xl aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <iframe
                src={getEmbedVideoUrl(activeVideo) || ''}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
              <button
                onClick={() => setActiveVideo(null)}
                className="absolute top-4 right-4 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
              >
                <X className="size-6" />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

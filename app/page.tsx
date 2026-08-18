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
    <main className="min-h-screen bg-background-dark relative pb-24">
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
                    className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/25 to-accent-purple/20 border border-primary/30 p-6 h-full group transition-all hover:border-primary/60"
                  >
                    <div className="absolute top-0 right-0 -mt-4 -mr-4 size-32 bg-primary/10 rounded-full blur-3xl group-hover:bg-primary/20 transition-colors" />
                    <div className="relative z-10">
                      <div className="size-12 rounded-2xl bg-primary/20 flex items-center justify-center mb-4 border border-primary/30">
                        <MessageSquare className="size-6 text-primary" />
                      </div>
                      <h3 className="text-xl font-bold text-slate-100 mb-2 font-display">Conselheira & Consultora IA</h3>
                      <p className="text-sm text-slate-400 leading-relaxed mb-4">
                        Pesquise sobre as aulas do curso, tire dúvidas de Canva, crie prompts de imagens e receba consultoria estratégica.
                      </p>
                      <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-widest group-hover:text-white transition-colors">
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
                    className="relative overflow-hidden rounded-3xl bg-white/5 border border-white/10 p-6 h-full group hover:border-primary/30 transition-all hover:bg-white/[0.07]"
                  >
                    <div className="relative z-10">
                      <div className="size-12 rounded-2xl bg-white/10 flex items-center justify-center mb-4 border border-white/10">
                        <Users2 className="size-6 text-slate-300" />
                      </div>
                      <h3 className="text-xl font-bold text-slate-100 mb-2 font-display">Mentoria & Comunidade</h3>
                      <p className="text-sm text-slate-400 leading-relaxed mb-4">
                        Espaço de mentoria para compartilhar suas artes, tirar dúvidas práticas e interagir com os outros alunos.
                      </p>
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-widest group-hover:text-primary transition-colors">
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
                    className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-500/20 to-primary/20 border border-indigo-500/20 p-6 h-full group hover:border-indigo-500/50 transition-all"
                  >
                    <div className="absolute top-0 right-0 -mt-4 -mr-4 size-32 bg-indigo-500/10 rounded-full blur-3xl group-hover:bg-indigo-500/20 transition-colors" />
                    <div className="relative z-10">
                      <div className="size-12 rounded-2xl bg-indigo-500/20 flex items-center justify-center mb-4 border border-indigo-500/30">
                        <CheckSquare className="size-6 text-indigo-400" />
                      </div>
                      <h3 className="text-xl font-bold text-slate-100 mb-2 font-display">Planner de Tarefas</h3>
                      <p className="text-sm text-slate-400 leading-relaxed mb-4">
                        Organize seu fluxo de trabalho, prazos de postagens, criação de carrosséis e checklist de metas no Canva.
                      </p>
                      <div className="flex items-center gap-2 text-xs font-bold text-indigo-400 uppercase tracking-widest group-hover:text-white transition-colors">
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
                    className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-accent-gold/20 to-amber-500/20 border border-accent-gold/20 p-6 h-full group hover:border-accent-gold/50 transition-all"
                  >
                    <div className="absolute top-0 right-0 -mt-4 -mr-4 size-32 bg-accent-gold/10 rounded-full blur-3xl group-hover:bg-accent-gold/20 transition-colors" />
                    <div className="relative z-10">
                      <div className="size-12 rounded-2xl bg-accent-gold/20 flex items-center justify-center mb-4 border border-accent-gold/30">
                        <Lightbulb className="size-6 text-accent-gold" />
                      </div>
                      <h3 className="text-xl font-bold text-slate-100 mb-2 font-display">Dicas de Conteúdo</h3>
                      <p className="text-sm text-slate-400 leading-relaxed mb-4">
                        Prompts prontos para Canva IA, fórmulas de carrossel, ganchos magnéticos e paletas de cores profissionais.
                      </p>
                      <div className="flex items-center gap-2 text-xs font-bold text-accent-gold uppercase tracking-widest group-hover:text-white transition-colors">
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

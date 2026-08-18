'use client';

import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { useEffect, useState, use } from 'react';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Clock, Users, BookOpen, ChevronRight, Sparkles, X, FileText, CheckCircle2 } from 'lucide-react';
import Image from 'next/image';
import { getDirectDriveLink, getEmbedVideoUrl } from '@/lib/utils';
import { updateUserGamification } from '@/lib/gamification';

interface Journey {
  id: string;
  title: string;
  description?: string;
  steps: number;
  duration: string;
  participants: number;
  archetype: string;
  image_url: string | null;
  user_id?: string;
}

interface Lesson {
  id: string;
  titulo: string;
  descricao: string;
  video_url: string;
  capa_url: string;
  pdf_url: string;
  duracao?: string;
  dia?: string | number;
}

interface Progress {
  lesson_id: string;
  completed: boolean;
}

export default function JourneyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [journey, setJourney] = useState<Journey | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [completedLessons, setCompletedLessons] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [activeVideo, setActiveVideo] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchJourneyData() {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser) setUser(authUser);

        // Fetch journey details
        const { data: journeyData, error: journeyError } = await supabase
          .from('journeys')
          .select('*')
          .eq('id', id)
          .single();

        if (isMounted && journeyData && !journeyError) {
          setJourney(journeyData);
        }

        // Fetch lessons for this journey
        const { data: lessonsData, error: lessonsError } = await supabase
          .from('lessons')
          .select('*')
          .eq('journey_id', id)
          .order('dia', { ascending: true });

        if (isMounted && lessonsData && !lessonsError) {
          setLessons(lessonsData);
          
          // Fetch progress if user is logged in
          if (authUser) {
            const { data: progressData } = await supabase
              .from('lesson_progress')
              .select('lesson_id')
              .eq('user_id', authUser.id)
              .eq('completed', true);
            
            if (progressData) {
              setCompletedLessons(new Set(progressData.map(p => p.lesson_id)));
            }
          }
        } else if (isMounted && !lessonsData) {
          const { data: fallbackLessons } = await supabase
            .from('lessons')
            .select('*')
            .limit(5);
          if (fallbackLessons) setLessons(fallbackLessons);
        }
      } catch (err) {
        console.error('Error fetching journey details:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchJourneyData();

    return () => {
      isMounted = false;
    };
  }, [id]);

  const toggleLessonCompletion = async (lessonId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;

    const isCompleted = completedLessons.has(lessonId);
    const newCompleted = new Set(completedLessons);
    
    if (isCompleted) {
      newCompleted.delete(lessonId);
    } else {
      newCompleted.add(lessonId);
    }
    
    setCompletedLessons(newCompleted);

    try {
      if (isCompleted) {
        const { error: deleteError } = await supabase
          .from('lesson_progress')
          .delete()
          .eq('user_id', user.id)
          .eq('lesson_id', lessonId);
        
        if (deleteError) throw deleteError;
        
        // Remove pontos
        await updateUserGamification(user.id, false);
      } else {
        const { error: upsertError } = await supabase
          .from('lesson_progress')
          .upsert({
            user_id: user.id,
            lesson_id: lessonId,
            completed: true
          });
        
        if (upsertError) throw upsertError;
        
        // Adiciona pontos e atualiza sequência
        await updateUserGamification(user.id, true);
      }
    } catch (err) {
      console.error('Error toggling lesson completion:', err);
      // Rollback on error
      setCompletedLessons(completedLessons);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-background-dark flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="size-8 border-2 border-primary border-t-transparent rounded-full"
        />
      </main>
    );
  }

  if (!journey) {
    return (
      <main className="min-h-screen bg-background-dark relative pb-24">
        <Header />
        <div className="max-w-md mx-auto px-4 py-20 text-center">
          <p className="text-slate-500 italic">Jornada não encontrada.</p>
        </div>
        <BottomNav />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background-dark relative pb-24">
      <Header />
      
      {/* Hero Section */}
      <div className="relative h-80 w-full overflow-hidden">
        <Image 
          src={getDirectDriveLink(journey.image_url) || `https://picsum.photos/seed/${journey.id}/1280/720`}
          alt={journey.title}
          fill
          className="object-cover opacity-40"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background-dark via-background-dark/60 to-transparent" />
        
        <div className="absolute bottom-0 left-0 right-0 p-6 max-w-md mx-auto">
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="space-y-4"
          >
            <span className="px-3 py-1 rounded-full bg-primary/80 text-[10px] font-bold uppercase tracking-widest text-white backdrop-blur-md">
              {journey.archetype}
            </span>
            <h1 className="text-3xl font-bold text-slate-100 font-display leading-tight">{journey.title}</h1>
            
            <div className="flex items-center gap-4 text-slate-300">
              <div className="flex items-center gap-1.5">
                <Clock className="size-4 text-primary" />
                <span className="text-xs font-medium">{journey.duration}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Users className="size-4 text-primary" />
                <span className="text-xs font-medium">{journey.participants} inscritos</span>
              </div>
              <div className="flex items-center gap-1.5">
                <BookOpen className="size-4 text-primary" />
                <span className="text-xs font-medium">{journey.steps} passos</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-8">
        {/* Description */}
        {journey.description && (
          <div className="mb-10">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Sobre esta Jornada</h2>
            <p className="text-slate-300 text-sm leading-relaxed">
              {journey.description}
            </p>
          </div>
        )}

        {/* Lessons List */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Conteúdo da Jornada</h2>
            <span className="text-[10px] text-primary font-bold">{lessons.length} Aulas</span>
          </div>

          <div className="space-y-4">
            {lessons.map((lesson, index) => (
              <motion.div
                key={lesson.id}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: index * 0.05 }}
                className={`group bg-white/5 border rounded-2xl p-4 transition-all cursor-pointer ${
                  completedLessons.has(lesson.id) 
                    ? 'border-emerald-500/30 bg-emerald-500/5' 
                    : 'border-white/10 hover:border-primary/30'
                }`}
                onClick={() => lesson.video_url && setActiveVideo(lesson.video_url)}
              >
                <div className="flex gap-4">
                  <div className="relative size-20 shrink-0 rounded-xl overflow-hidden border border-white/10">
                    <Image 
                      src={getDirectDriveLink(lesson.capa_url) || `https://picsum.photos/seed/${lesson.id}/200/200`}
                      alt={lesson.titulo}
                      fill
                      className="object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className={`size-8 rounded-full flex items-center justify-center shadow-lg ${
                        completedLessons.has(lesson.id) ? 'bg-emerald-500' : 'bg-primary/90'
                      }`}>
                        {completedLessons.has(lesson.id) ? (
                          <CheckCircle2 className="size-4 text-white" />
                        ) : (
                          <Play className="size-4 fill-current ml-0.5 text-white" />
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col justify-center flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[9px] font-bold uppercase tracking-tighter ${
                        completedLessons.has(lesson.id) ? 'text-emerald-500' : 'text-primary'
                      }`}>
                        {completedLessons.has(lesson.id) ? 'Concluída' : `Aula ${index + 1}`}
                      </span>
                      {lesson.duracao && (
                        <span className="text-[9px] text-slate-500 uppercase tracking-tighter">• {lesson.duracao}</span>
                      )}
                    </div>
                    <h3 className={`text-sm font-bold line-clamp-1 mb-1 ${
                      completedLessons.has(lesson.id) ? 'text-slate-300' : 'text-slate-100'
                    }`}>{lesson.titulo}</h3>
                    <p className="text-[10px] text-slate-400 line-clamp-2 leading-relaxed mb-3">
                      {lesson.descricao}
                    </p>
                    {/* Check-in button removed per user request */}
                  </div>
                  
                  <div className="flex flex-col items-center justify-center py-1">
                    <ChevronRight className="size-4 text-slate-600 group-hover:text-primary transition-colors" />
                  </div>
                </div>
                
                {lesson.pdf_url && (
                  <div className="mt-3 pt-3 border-t border-white/5 flex justify-end">
                    <a 
                      href={lesson.pdf_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 hover:text-primary transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <FileText className="size-3" />
                      Material Complementar
                    </a>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>

        {lessons.length === 0 && (
          <div className="py-12 text-center rounded-3xl bg-white/5 border border-dashed border-white/10">
            <Sparkles className="size-10 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-500 text-sm italic">Em breve, novas aulas para esta jornada.</p>
          </div>
        )}
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

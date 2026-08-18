'use client';

import { Play, FileText, Sparkles, Clock, X, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { getDirectDriveLink, getEmbedVideoUrl } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { updateUserGamification } from '@/lib/gamification';

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

interface FeaturedLessonProps {
  lesson: LessonData | null;
  loading: boolean;
}

export default function FeaturedLesson({ lesson, loading }: FeaturedLessonProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [checkingProgress, setCheckingProgress] = useState(true);

  useEffect(() => {
    async function checkProgress() {
      if (!lesson) return;
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setCheckingProgress(false);
        return;
      }

      const { data } = await supabase
        .from('lesson_progress')
        .select('completed')
        .eq('user_id', user.id)
        .eq('lesson_id', lesson.id)
        .single();

      if (data?.completed) {
        setIsCompleted(true);
      }
      setCheckingProgress(false);
    }

    checkProgress();
  }, [lesson]);

  const handleToggleComplete = async () => {
    if (!lesson) return;
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      window.location.href = '/login';
      return;
    }

    const newStatus = !isCompleted;
    setIsCompleted(newStatus);

    try {
      if (newStatus) {
        const { error: upsertError } = await supabase
          .from('lesson_progress')
          .upsert({
            user_id: user.id,
            lesson_id: lesson.id,
            completed: true
          });
        
        if (upsertError) throw upsertError;
        
        // Atualiza pontos e sequência
        await updateUserGamification(user.id, true);
      } else {
        const { error: deleteError } = await supabase
          .from('lesson_progress')
          .delete()
          .eq('user_id', user.id)
          .eq('lesson_id', lesson.id);
        
        if (deleteError) throw deleteError;
        
        // Remove pontos se desmarcar
        await updateUserGamification(user.id, false);
      }
    } catch (err) {
      console.error('Error toggling lesson completion:', err);
      setIsCompleted(!newStatus);
    }
  };

  if (loading) {
    return (
      <div className="px-4 sm:px-0">
        <div className="w-full aspect-video bg-white/5 rounded-[32px] animate-pulse border border-white/10" />
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="px-4 sm:px-0">
        <div className="p-12 rounded-[32px] bg-white/5 border border-dashed border-white/10 flex flex-col items-center justify-center text-center">
          <Sparkles className="size-12 text-slate-700 mb-4" />
          <p className="text-slate-500 font-medium">Nenhum conteúdo em destaque para hoje.</p>
        </div>
      </div>
    );
  }

  return (
    <section className="px-4 py-6 sm:px-0">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-primary/20 text-primary text-[10px] font-bold uppercase tracking-widest border border-primary/10">
              {lesson.categoria === 'Boas-vindas' ? 'Comece por aqui' : (lesson.categoria || 'Aula do Dia')}
            </span>
            {lesson.duracao && (
              <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1">
                <Clock className="size-3" />
                {lesson.duracao}
              </span>
            )}
          </div>
        </div>
        
        {lesson.pdf_url && (
          <motion.a
            href={lesson.pdf_url}
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ y: -2 }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 transition-all"
          >
            <FileText className="size-4 text-primary" />
            <span className="text-xs font-bold">Material de Apoio</span>
          </motion.a>
        )}
      </div>

      <div className="relative group">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="relative aspect-video rounded-2xl overflow-hidden border border-white/10 bg-black/20"
        >
          <AnimatePresence mode="wait">
            {!isPlaying ? (
              <motion.div
                key="thumbnail"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0"
              >
                <Image 
                  src={getDirectDriveLink(lesson.capa_url) || "https://picsum.photos/seed/mistika/1280/720"}
                  alt={lesson.titulo}
                  fill
                  className="object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-500"
                  referrerPolicy="no-referrer"
                />
                
                {/* Play Button */}
                <div className="absolute inset-0 flex items-center justify-center">
                  {lesson.video_url ? (
                    <motion.button 
                      onClick={() => setIsPlaying(true)}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      className="size-16 rounded-full bg-primary text-white flex items-center justify-center shadow-xl"
                    >
                      <Play className="size-8 fill-current ml-1" />
                    </motion.button>
                  ) : (
                    <motion.button 
                      className="size-16 rounded-full bg-primary text-white flex items-center justify-center shadow-xl opacity-50 cursor-not-allowed"
                    >
                      <Play className="size-8 fill-current ml-1" />
                    </motion.button>
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="player"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black"
              >
                <iframe
                  src={getEmbedVideoUrl(lesson.video_url) || ''}
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
                <button 
                  onClick={() => setIsPlaying(false)}
                  className="absolute top-4 right-4 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors z-10"
                >
                  <X className="size-5" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      <div className="mt-4">
        <p className="text-slate-400 text-sm leading-relaxed line-clamp-3">
          {lesson.descricao}
        </p>
      </div>
    </section>
  );
}

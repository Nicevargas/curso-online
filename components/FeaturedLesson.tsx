'use client';

import { Play, FileText, Sparkles, Clock, X, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { getDirectDriveLink, getEmbedVideoUrl } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { updateUserGamification } from '@/lib/gamification';
import { useTheme } from '@/lib/ThemeContext';

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
  courseTitle?: string;
}

export default function FeaturedLesson({ lesson, loading, courseTitle }: FeaturedLessonProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [isPlaying, setIsPlaying] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [checkingProgress, setCheckingProgress] = useState(true);
  const [thumbnailError, setThumbnailError] = useState(false);

  // Reset error when lesson changes
  useEffect(() => {
    setThumbnailError(false);
  }, [lesson?.id, lesson?.capa_url]);

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
        <div className={`w-full aspect-video rounded-[32px] animate-pulse border ${
          isDark ? 'bg-white/5 border-white/10' : 'bg-black/5 border-black/10'
        }`} />
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="px-4 sm:px-0">
        <div className={`p-12 rounded-[32px] border border-dashed flex flex-col items-center justify-center text-center ${
          isDark ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'
        }`}>
          <Sparkles className={`size-12 mb-4 ${isDark ? 'text-slate-700' : 'text-slate-400'}`} />
          <p className={`font-medium ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>
            Nenhum conteúdo em destaque para hoje.
          </p>
        </div>
      </div>
    );
  }

  return (
    <section className="px-4 py-6 sm:px-0">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
        <div className="space-y-1">
          <div className="flex items-center flex-wrap gap-2">
            {courseTitle && (
              <span className="px-2.5 py-0.5 rounded-full bg-accent-purple/20 text-accent-purple text-[10px] font-extrabold uppercase tracking-widest border border-accent-purple/30 font-mono">
                {courseTitle}
              </span>
            )}
            <span className="px-2 py-0.5 rounded bg-primary/20 text-primary text-[10px] font-bold uppercase tracking-widest border border-primary/10">
              {lesson.categoria === 'Boas-vindas' ? 'Comece por aqui' : (lesson.categoria || 'Aula do Dia')}
            </span>
            {lesson.duracao && (
              <span className={`text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 ${
                isDark ? 'text-slate-500' : 'text-slate-500'
              }`}>
                <Clock className="size-3" />
                {lesson.duracao}
              </span>
            )}
          </div>
          <h2 className={`text-2xl font-bold font-display tracking-tight ${
            isDark ? 'text-slate-100' : 'text-slate-900'
          }`}>
            {lesson.titulo}
          </h2>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          {lesson.pdf_url && (
            <motion.a
              href={lesson.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ y: -2 }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all ${
                isDark 
                  ? 'bg-white/5 border-white/10 text-slate-300 hover:text-white hover:bg-white/10' 
                  : 'bg-white border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-50 shadow-sm'
              }`}
            >
              <FileText className="size-4 text-primary" />
              <span className="text-xs font-bold">Material de Apoio</span>
            </motion.a>
          )}
        </div>
      </div>

      <div className="relative group">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`relative aspect-video rounded-2xl overflow-hidden border ${
            isDark ? 'border-white/10 bg-black/20' : 'border-slate-200 bg-slate-100 shadow-md'
          }`}
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
                  src={
                    thumbnailError || !lesson.capa_url 
                      ? "https://picsum.photos/seed/canva_ia/1280/720"
                      : getDirectDriveLink(lesson.capa_url)
                  }
                  alt={lesson.titulo}
                  fill
                  className="object-cover opacity-90 group-hover:opacity-100 transition-opacity duration-500"
                  referrerPolicy="no-referrer"
                  onError={() => setThumbnailError(true)}
                  unoptimized={lesson.capa_url?.includes('drive.google.com') || lesson.capa_url?.includes('googleusercontent.com')}
                />
                
                {/* Play Button */}
                <div className="absolute inset-0 flex items-center justify-center">
                  {lesson.video_url ? (
                    <motion.button 
                      onClick={() => setIsPlaying(true)}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      className="size-16 rounded-full bg-primary text-white flex items-center justify-center shadow-xl hover:bg-primary/90 transition-all cursor-pointer"
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
                className="absolute inset-0 bg-black select-none"
                data-protected-video="true"
                onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
              >
                <iframe
                  src={getEmbedVideoUrl(lesson.video_url) || ''}
                  className="w-full h-full border-0 pointer-events-auto select-none"
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

      <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <p className={`text-sm leading-relaxed line-clamp-3 ${
          isDark ? 'text-slate-400' : 'text-slate-600'
        }`}>
          {lesson.descricao}
        </p>

        <button
          onClick={handleToggleComplete}
          disabled={checkingProgress}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-bold transition-all shrink-0 ${
            isCompleted
              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
              : isDark
                ? 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm'
          }`}
        >
          <CheckCircle2 className={`size-4 ${isCompleted ? 'text-emerald-400' : 'text-slate-400'}`} />
          <span>{isCompleted ? 'Concluída' : 'Marcar como Concluída'}</span>
        </button>
      </div>
    </section>
  );
}

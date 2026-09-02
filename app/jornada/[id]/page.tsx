'use client';

import { use, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'motion/react';
import { BookOpen, Check, CheckCircle2, ChevronLeft, ChevronRight, Clock, FileText, Play, Users } from 'lucide-react';

import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { supabase } from '@/lib/supabase';
import { getDirectDriveLink, getEmbedVideoUrl } from '@/lib/utils';
import { useTheme } from '@/lib/ThemeContext';
import { useSession } from '@/lib/SessionContext';
import { useToast } from '@/components/ToastProvider';
import { toggleLessonCompletion } from '@/lib/gamification';
import { getCourseLessons, type CourseLesson } from '@/lib/courses';

interface Journey {
  id: string;
  title: string;
  archetype: string;
  description: string | null;
  image_url: string | null;
  duration: string | null;
  steps: number | null;
  participants: number | null;
}

/**
 * Página de um curso específico (/jornada/<id>).
 *
 * Antes era código órfão: nada linkava para cá, não havia botão de concluir aula
 * (a função existia e nunca era chamada), o tema claro era ignorado e um fallback
 * mostrava aulas de OUTROS cursos quando a consulta falhava.
 */
export default function JourneyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { theme } = useTheme();
  const { user, loading: sessionLoading } = useSession();
  const toast = useToast();
  const isDark = theme === 'dark';

  const [journey, setJourney] = useState<Journey | null>(null);
  const [lessons, setLessons] = useState<CourseLesson[]>([]);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [activeVideo, setActiveVideo] = useState<CourseLesson | null>(null);

  const load = useCallback(async (userId: string) => {
    setLoading(true);
    try {
      const { data: journeyData } = await supabase
        .from('journeys')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      setJourney((journeyData as Journey) || null);

      const [lessonData, { data: progress }] = await Promise.all([
        getCourseLessons({ id, archetype: journeyData?.archetype }),
        supabase.from('lesson_progress').select('lesson_id').eq('user_id', userId).eq('completed', true),
      ]);

      setLessons(lessonData);
      setCompleted(new Set((progress || []).map((p: any) => p.lesson_id)));
    } catch (err) {
      console.error('Erro ao carregar o curso:', err);
      toast.error('Não foi possível carregar este curso.');
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    if (sessionLoading) return;
    if (!user) {
      window.location.href = '/login';
      return;
    }
    load(user.id);
  }, [sessionLoading, user, load]);

  const handleToggle = async (lessonId: string) => {
    if (!user) return;
    const wasCompleted = completed.has(lessonId);
    const next = new Set(completed);
    if (wasCompleted) next.delete(lessonId);
    else next.add(lessonId);
    setCompleted(next);

    const result = await toggleLessonCompletion(user.id, lessonId, !wasCompleted);
    if (!result) {
      setCompleted(completed);
      toast.error('Não foi possível salvar seu progresso.');
      return;
    }

    if (!wasCompleted) {
      toast.celebrate();
      toast.reward(`+${result.pointsDelta} pontos!`, `${next.size} de ${lessons.length} aulas concluídas`);
    }
  };

  const completedCount = useMemo(() => lessons.filter((l) => completed.has(l.id)).length, [lessons, completed]);
  const percent = lessons.length > 0 ? Math.round((completedCount / lessons.length) * 100) : 0;

  const card = isDark ? 'bg-white/[0.03] border-white/10' : 'bg-white border-slate-200 shadow-sm';
  const soft = isDark ? 'text-slate-400' : 'text-slate-600';

  if (loading) {
    return (
      <main className={`min-h-screen ${isDark ? 'bg-[#000000]' : 'bg-[#f7f6f8]'}`}>
        <Header />
        <div className="max-w-4xl mx-auto px-4 py-8 space-y-4">
          <div className={`h-52 rounded-3xl border animate-pulse ${card}`} />
          {[0, 1, 2].map((i) => (
            <div key={i} className={`h-20 rounded-3xl border animate-pulse ${card}`} />
          ))}
        </div>
        <BottomNav />
      </main>
    );
  }

  if (!journey) {
    return (
      <main
        className={`min-h-screen flex flex-col ${isDark ? 'bg-[#000000] text-slate-100' : 'bg-[#f7f6f8] text-slate-900'}`}
      >
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <BookOpen className="size-12 text-slate-400 mb-4" />
          <h1 className="text-xl font-bold font-display mb-2">Curso não encontrado</h1>
          <p className={`text-sm mb-6 ${soft}`}>Este curso pode ter sido removido ou o link está incorreto.</p>
          <Link href="/jornada" className="px-5 py-3 rounded-2xl bg-primary text-white font-bold text-sm">
            Ver meus cursos
          </Link>
        </div>
        <BottomNav />
      </main>
    );
  }

  return (
    <main
      className={`min-h-screen relative pb-28 transition-colors duration-200 ${
        isDark ? 'bg-[#000000] text-slate-100' : 'bg-[#f7f6f8] text-slate-900'
      }`}
    >
      <Header />

      {/* Capa */}
      <div className="relative h-56 sm:h-72 w-full">
        <Image
          src={getDirectDriveLink(journey.image_url) || `https://picsum.photos/seed/${journey.id}/1280/720`}
          alt={journey.title}
          fill
          className="object-cover"
          referrerPolicy="no-referrer"
          unoptimized
        />
        <div
          className={`absolute inset-0 ${
            isDark ? 'bg-gradient-to-t from-black via-black/70 to-black/20' : 'bg-gradient-to-t from-[#f7f6f8] via-[#f7f6f8]/70 to-black/10'
          }`}
        />
        <div className="absolute bottom-0 left-0 right-0 max-w-4xl mx-auto px-4 pb-5">
          <span className="px-2.5 py-0.5 rounded-full bg-primary text-white text-[10px] font-extrabold uppercase tracking-widest">
            {journey.archetype || 'Curso'}
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold font-display leading-tight mt-2">{journey.title}</h1>
          <div className={`flex flex-wrap items-center gap-4 mt-2 text-xs font-semibold ${soft}`}>
            {journey.duration && (
              <span className="flex items-center gap-1.5">
                <Clock className="size-3.5" /> {journey.duration}
              </span>
            )}
            {journey.participants ? (
              <span className="flex items-center gap-1.5">
                <Users className="size-3.5" /> {journey.participants} inscritos
              </span>
            ) : null}
            <span className="flex items-center gap-1.5">
              <BookOpen className="size-3.5" /> {lessons.length} aulas
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {journey.description && (
          <div className={`rounded-3xl border p-5 ${card}`}>
            <p className={`text-sm leading-relaxed whitespace-pre-line ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              {journey.description}
            </p>
          </div>
        )}

        {/* Progresso */}
        {lessons.length > 0 && (
          <div className={`rounded-3xl border p-5 ${card}`}>
            <div className="flex items-center justify-between text-xs font-bold mb-2">
              <span className={soft}>
                {completedCount} de {lessons.length} aulas concluídas
              </span>
              <span className="text-primary font-mono">{percent}%</span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-white/10 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${percent}%` }}
                transition={{ duration: 0.7, ease: 'easeOut' }}
                className="h-full rounded-full bg-gradient-to-r from-primary to-accent-purple"
              />
            </div>
            <Link
              href={`/jornada?curso=${journey.id}`}
              className="mt-4 w-full py-3 rounded-2xl bg-primary text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors"
            >
              <Play className="size-4 fill-current" />
              {percent > 0 ? 'Continuar na trilha' : 'Começar o curso'}
              <ChevronRight className="size-4" />
            </Link>
          </div>
        )}

        {/* Aulas */}
        <section className={`rounded-3xl border p-5 ${card}`}>
          <h2 className="text-sm font-bold font-display mb-4">Aulas deste curso</h2>

          {lessons.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">
              As aulas deste curso ainda estão sendo preparadas.
            </p>
          ) : (
            <div className="space-y-2">
              {lessons.map((lesson, index) => {
                const done = completed.has(lesson.id);
                return (
                  <div
                    key={lesson.id}
                    className={`flex items-center gap-3 p-3 rounded-2xl border transition-colors ${
                      done
                        ? 'border-emerald-500/30 bg-emerald-500/5'
                        : isDark
                          ? 'border-white/10 hover:bg-white/5'
                          : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <button
                      onClick={() => handleToggle(lesson.id)}
                      aria-label={done ? 'Marcar como não concluída' : 'Marcar como concluída'}
                      className={`size-9 rounded-full flex items-center justify-center text-xs font-bold border-2 shrink-0 transition-all cursor-pointer ${
                        done
                          ? 'bg-emerald-500 border-emerald-500 text-white'
                          : isDark
                            ? 'border-white/15 text-slate-400 hover:border-primary'
                            : 'border-slate-300 text-slate-500 hover:border-primary'
                      }`}
                    >
                      {done ? <Check className="size-4" /> : index + 1}
                    </button>

                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold leading-snug ${done ? 'line-through opacity-60' : ''}`}>
                        {lesson.title}
                      </p>
                      {lesson.duracao && <span className={`text-[10px] font-bold ${soft}`}>{lesson.duracao}</span>}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {lesson.pdf_url && (
                        <a
                          href={lesson.pdf_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="Material da aula"
                          className={`p-2 rounded-xl transition-colors ${
                            isDark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
                          }`}
                        >
                          <FileText className="size-4" />
                        </a>
                      )}
                      {(lesson.media_url || lesson.url) && (
                        <button
                          onClick={() => setActiveVideo(lesson)}
                          aria-label="Assistir aula"
                          className="p-2 rounded-xl bg-primary/15 text-primary hover:bg-primary/25 transition-colors cursor-pointer"
                        >
                          <Play className="size-4 fill-current" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <Link
          href="/jornada"
          className={`inline-flex items-center gap-1.5 text-xs font-bold transition-colors ${soft} hover:text-primary`}
        >
          <ChevronLeft className="size-4" /> Voltar para meus cursos
        </Link>
      </div>

      {/* Vídeo */}
      {activeVideo && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm"
          onClick={() => setActiveVideo(null)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-4xl"
          >
            <div className="aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl">
              <iframe
                src={getEmbedVideoUrl(activeVideo.media_url || activeVideo.url) || ''}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
            <div className="flex items-center justify-between gap-3 mt-4">
              <p className="text-sm font-bold text-white truncate">{activeVideo.title}</p>
              {!completed.has(activeVideo.id) && (
                <button
                  onClick={() => {
                    handleToggle(activeVideo.id);
                    setActiveVideo(null);
                  }}
                  className="shrink-0 px-4 py-2.5 rounded-xl bg-primary text-white text-xs font-bold flex items-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 className="size-4" /> Concluí esta aula
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}

      <BottomNav />
    </main>
  );
}

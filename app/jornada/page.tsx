'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { AnimatePresence, motion } from 'motion/react';
import {
  BookOpen,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileText,
  Lock,
  Play,
  Search,
  Sparkles,
  Trophy,
  X,
  Zap,
} from 'lucide-react';

import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import EvolutionDiary from '@/components/EvolutionDiary';
import BusinessSheetModal from '@/components/BusinessSheetModal';
import { supabase } from '@/lib/supabase';
import { getDirectDriveLink } from '@/lib/utils';
import SecureVideoPlayer from '@/components/SecureVideoPlayer';
import { useTheme } from '@/lib/ThemeContext';
import { useSession } from '@/lib/SessionContext';
import { useToast } from '@/components/ToastProvider';
import { toggleLessonCompletion } from '@/lib/gamification';
import {
  CourseWithAccess,
  CourseLesson,
  getCoursesWithUserAccess,
  getCourseLessons,
  switchActiveCourse,
  enrollUser,
  DEFAULT_JOURNEY_ID,
} from '@/lib/courses';

function LessonSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex gap-4 animate-pulse">
          <div className="size-10 rounded-full bg-slate-500/20 shrink-0" />
          <div className="flex-1 h-20 rounded-2xl bg-slate-500/10" />
        </div>
      ))}
    </div>
  );
}

function JornadaPageInner() {
  const searchParams = useSearchParams();
  const cursoParam = searchParams.get('curso');
  const { theme } = useTheme();
  const { user, profile, loading: sessionLoading } = useSession();
  const toast = useToast();
  const isDark = theme === 'dark';

  const [allCourses, setAllCourses] = useState<CourseWithAccess[]>([]);
  const [enrolledCourses, setEnrolledCourses] = useState<CourseWithAccess[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<CourseWithAccess | null>(null);

  const [lessons, setLessons] = useState<CourseLesson[]>([]);
  const [completedItems, setCompletedItems] = useState<Set<string>>(new Set());
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [lessonsLoading, setLessonsLoading] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [search, setSearch] = useState('');
  const [activeVideo, setActiveVideo] = useState<CourseLesson | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [courseDoneOpen, setCourseDoneOpen] = useState(false);

  // ---------- Carregar aulas do curso ----------
  const loadLessons = useCallback(
    async (userId: string, course: CourseWithAccess) => {
      setLessonsLoading(true);
      try {
        const [lessonData, { data: progress }] = await Promise.all([
          getCourseLessons(course),
          supabase.from('lesson_progress').select('lesson_id').eq('user_id', userId).eq('completed', true),
        ]);

        const completed = new Set<string>((progress || []).map((p: any) => p.lesson_id));
        setCompletedItems(completed);
        setLessons(lessonData);

        const next = lessonData.find((l) => !completed.has(l.id)) || lessonData[0];
        setSelectedLessonId(next?.id || null);
      } catch (err) {
        console.error('Erro ao carregar aulas:', err);
        setLessons([]);
      } finally {
        setLessonsLoading(false);
      }
    },
    []
  );

  // ---------- Inicialização (uma vez; antes rodava duas vezes) ----------
  useEffect(() => {
    if (sessionLoading) return;
    if (!user) {
      window.location.href = '/login';
      return;
    }

    let active = true;

    (async () => {
      const { allCourses: courses, enrolledCourses: enrolled } = await getCoursesWithUserAccess(user.id);
      if (!active) return;

      setAllCourses(courses);
      setEnrolledCourses(enrolled);

      const stored = typeof window !== 'undefined' ? localStorage.getItem('active_journey_id') : null;
      const wantedId = cursoParam || stored || profile?.journey_id || DEFAULT_JOURNEY_ID;
      const current = courses.find((c) => c.id === wantedId) || enrolled[0] || courses[0] || null;

      setSelectedCourse(current);
      setLoading(false);

      if (current?.isEnrolled) {
        if (cursoParam && current.id === cursoParam) switchActiveCourse(user.id, current.id);
        await loadLessons(user.id, current);
      }
    })();

    return () => {
      active = false;
    };
  }, [sessionLoading, user, profile?.journey_id, cursoParam, loadLessons]);

  // ---------- Ações ----------
  const handleSelectCourse = async (course: CourseWithAccess) => {
    if (!user) return;
    setSelectedCourse(course);
    setSearch('');
    if (course.isEnrolled) {
      switchActiveCourse(user.id, course.id);
      await loadLessons(user.id, course);
    } else {
      setLessons([]);
    }
  };

  const handleEnroll = async () => {
    if (!user || !selectedCourse) return;
    setEnrolling(true);
    const ok = await enrollUser(user.id, selectedCourse.id);
    if (ok) {
      const { allCourses: courses, enrolledCourses: enrolled } = await getCoursesWithUserAccess(user.id);
      setAllCourses(courses);
      setEnrolledCourses(enrolled);
      const updated = courses.find((c) => c.id === selectedCourse.id);
      if (updated) {
        setSelectedCourse(updated);
        await loadLessons(user.id, updated);
      }
      toast.success('Acesso liberado!', 'Bons estudos.');
    } else {
      toast.error(
        'Não foi possível liberar o acesso automaticamente.',
        'Fale com a administração para ativar este curso na sua conta.'
      );
    }
    setEnrolling(false);
  };

  const handleToggleComplete = async (lessonId: string) => {
    if (!user) return;

    const wasCompleted = completedItems.has(lessonId);
    const next = new Set(completedItems);
    if (wasCompleted) next.delete(lessonId);
    else next.add(lessonId);
    setCompletedItems(next); // atualização otimista

    const result = await toggleLessonCompletion(user.id, lessonId, !wasCompleted);

    if (!result) {
      setCompletedItems(completedItems); // desfaz
      toast.error('Não foi possível salvar seu progresso.');
      return;
    }

    if (!wasCompleted) {
      const finishedCourse = lessons.length > 0 && next.size >= lessons.length;

      if (finishedCourse) {
        toast.celebrate('big');
        setCourseDoneOpen(true);
      } else {
        toast.celebrate();
        toast.reward(
          result.pointsDelta > 0 ? `+${result.pointsDelta} pontos!` : 'Aula concluída!',
          result.leveledUp
            ? `Você chegou ao nível ${result.level}! 🎉`
            : `${next.size} de ${lessons.length} aulas concluídas`
        );

        // Avança automaticamente para a próxima aula não concluída
        const idx = lessons.findIndex((l) => l.id === lessonId);
        const following = lessons.slice(idx + 1).find((l) => !next.has(l.id));
        if (following) setSelectedLessonId(following.id);
      }
    }
  };

  // ---------- Derivados ----------
  const currentLesson = useMemo(
    () => lessons.find((l) => l.id === selectedLessonId) || lessons[0] || null,
    [lessons, selectedLessonId]
  );

  const currentIndex = useMemo(
    () => lessons.findIndex((l) => l.id === currentLesson?.id),
    [lessons, currentLesson?.id]
  );

  const filteredLessons = useMemo(() => {
    if (!search.trim()) return lessons;
    const q = search.toLowerCase();
    return lessons.filter(
      (l) => l.title.toLowerCase().includes(q) || (l.description || '').toLowerCase().includes(q)
    );
  }, [lessons, search]);

  const completedCount = useMemo(
    () => lessons.filter((l) => completedItems.has(l.id)).length,
    [lessons, completedItems]
  );
  const progressPercent = lessons.length > 0 ? Math.round((completedCount / lessons.length) * 100) : 0;

  const isCanvaCourse =
    selectedCourse?.archetype === 'Jornada' || Boolean(selectedCourse?.title?.toLowerCase().includes('canva'));

  const card = isDark ? 'bg-white/[0.03] border-white/10' : 'bg-white border-slate-200 shadow-sm';
  const soft = isDark ? 'text-slate-400' : 'text-slate-600';

  // ---------- Render ----------
  return (
    <main
      className={`min-h-screen relative pb-28 transition-colors duration-200 ${
        isDark ? 'bg-[#000000] text-slate-100' : 'bg-[#f7f6f8] text-slate-900'
      }`}
    >
      <Header />

      <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8">
        {/* Cabeçalho + progresso do curso */}
        <section className={`rounded-3xl border p-5 sm:p-6 mb-6 ${card}`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
            <div className="min-w-0">
              <span className="px-2.5 py-0.5 rounded-full bg-primary/20 text-primary text-[10px] font-extrabold uppercase tracking-widest font-mono">
                Jornada de estudos
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight mt-2 truncate">
                {selectedCourse?.title || 'Seus módulos'}
              </h1>
              {selectedCourse?.isEnrolled && lessons.length > 0 && (
                <p className={`text-sm mt-1 ${soft}`}>
                  {progressPercent === 100
                    ? 'Você concluiu todas as aulas deste curso. Parabéns! 🎉'
                    : `Continue de onde parou — faltam ${lessons.length - completedCount} aulas.`}
                </p>
              )}
            </div>
            <Link href="/" className="text-xs font-bold text-primary hover:underline flex items-center gap-1 shrink-0">
              Painel geral <ChevronRight className="size-4" />
            </Link>
          </div>

          {/* Barra de progresso — o dado existia e nunca era mostrado */}
          {selectedCourse?.isEnrolled && lessons.length > 0 && (
            <div className="mb-5">
              <div className="flex items-center justify-between text-xs font-bold mb-2">
                <span className={soft}>
                  {completedCount} de {lessons.length} aulas concluídas
                </span>
                <span className="text-primary font-mono">{progressPercent}%</span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-white/10 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.7, ease: 'easeOut' }}
                  className="h-full rounded-full bg-gradient-to-r from-primary to-accent-purple"
                />
              </div>
            </div>
          )}

          {/* Abas de curso */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {allCourses.map((c) => {
              const isSelected = c.id === selectedCourse?.id;
              return (
                <button
                  key={c.id}
                  onClick={() => handleSelectCourse(c)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all shrink-0 border cursor-pointer ${
                    isSelected
                      ? 'bg-primary text-white border-primary shadow-md shadow-primary/20'
                      : isDark
                        ? 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {c.isEnrolled ? <BookOpen className="size-3.5" /> : <Lock className="size-3.5 text-amber-400" />}
                  <span className="truncate max-w-[180px]">{c.title}</span>
                  {c.isEnrolled && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-md ${
                        isSelected ? 'bg-white/20' : 'bg-black/10 dark:bg-white/10 text-slate-400'
                      }`}
                    >
                      {c.progressPercent}%
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {loading ? (
          <div className={`rounded-3xl border p-6 ${card}`}>
            <LessonSkeleton />
          </div>
        ) : selectedCourse && !selectedCourse.isEnrolled ? (
          <div className={`p-8 sm:p-12 rounded-3xl border text-center max-w-2xl mx-auto my-8 ${card}`}>
            <div className="size-16 rounded-3xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-5">
              <Lock className="size-8" />
            </div>
            <h2 className="text-2xl font-bold font-display mb-3">
              Você ainda não tem acesso a “{selectedCourse.title}”
            </h2>
            <p className={`text-sm leading-relaxed mb-6 ${soft}`}>
              {selectedCourse.description ||
                'Este curso tem módulos práticos, desafios passo a passo e materiais exclusivos.'}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={handleEnroll}
                disabled={enrolling}
                className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-gradient-to-r from-primary to-accent-purple text-white font-bold text-sm shadow-lg shadow-primary/20 hover:opacity-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                <Zap className="size-4 fill-current" />
                {enrolling ? 'Processando...' : 'Liberar acesso'}
              </button>
              {enrolledCourses.length > 0 && (
                <button
                  onClick={() => handleSelectCourse(enrolledCourses[0])}
                  className={`w-full sm:w-auto px-6 py-3.5 rounded-2xl font-bold text-sm border cursor-pointer ${
                    isDark
                      ? 'border-white/10 text-slate-300 hover:bg-white/5'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Voltar ao meu curso
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Coluna principal */}
            <div className="lg:col-span-8 space-y-6">
              {isCanvaCourse && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-4 rounded-3xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                    isDark
                      ? 'bg-gradient-to-r from-primary/20 via-purple-900/10 to-transparent border-primary/30'
                      : 'bg-gradient-to-r from-primary/10 via-purple-50 to-white border-primary/20'
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <div className="size-11 rounded-2xl bg-primary/20 flex items-center justify-center text-primary shrink-0 border border-primary/30">
                      <ClipboardList className="size-6" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold font-display">Ficha do Negócio</h3>
                      <p className={`text-xs ${soft}`}>Os dados da sua marca para usar nos prompts das aulas.</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsSheetOpen(true)}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-primary/20 transition-all cursor-pointer"
                  >
                    <ClipboardList className="size-4" /> Abrir ficha
                  </button>
                </motion.div>
              )}

              {/* Aula atual */}
              {lessonsLoading ? (
                <div className={`rounded-3xl border p-6 ${card}`}>
                  <LessonSkeleton />
                </div>
              ) : lessons.length === 0 ? (
                <div className={`p-12 rounded-3xl border text-center ${card}`}>
                  <Sparkles className="size-10 text-slate-500 mx-auto mb-3" />
                  <h3 className="text-lg font-bold mb-1">Nenhuma aula cadastrada ainda</h3>
                  <p className="text-xs text-slate-500">
                    As aulas deste curso estão sendo preparadas. Volte em breve!
                  </p>
                </div>
              ) : currentLesson ? (
                <motion.section
                  key={currentLesson.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`rounded-3xl border overflow-hidden ${
                    completedItems.has(currentLesson.id)
                      ? 'border-emerald-500/30'
                      : isDark
                        ? 'border-white/10'
                        : 'border-slate-200 shadow-sm'
                  } ${isDark ? 'bg-white/[0.03]' : 'bg-white'}`}
                >
                  <div className="relative aspect-video">
                    <Image
                      src={
                        getDirectDriveLink(currentLesson.thumbnail_url) ||
                        `https://picsum.photos/seed/${currentLesson.id}/1200/675`
                      }
                      alt={currentLesson.title}
                      fill
                      className="object-cover"
                      referrerPolicy="no-referrer"
                      unoptimized
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />

                    {(currentLesson.media_url || currentLesson.url) && (
                      <button
                        onClick={() => setActiveVideo(currentLesson)}
                        aria-label="Assistir aula"
                        className="absolute inset-0 flex items-center justify-center group cursor-pointer"
                      >
                        <span
                          className={`size-20 rounded-full flex items-center justify-center shadow-2xl transition-transform group-hover:scale-110 ${
                            completedItems.has(currentLesson.id) ? 'bg-emerald-500' : 'bg-primary'
                          }`}
                        >
                          <Play className="size-9 fill-current ml-1 text-white" />
                        </span>
                      </button>
                    )}

                    <div className="absolute bottom-4 left-5 right-5">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="px-2.5 py-0.5 rounded-full bg-primary text-white text-[10px] font-bold uppercase tracking-widest">
                          Aula {currentIndex + 1} de {lessons.length}
                        </span>
                        {currentLesson.duracao && (
                          <span className="px-2.5 py-0.5 rounded-full bg-black/50 text-white/90 text-[10px] font-bold">
                            {currentLesson.duracao}
                          </span>
                        )}
                        {completedItems.has(currentLesson.id) && (
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold uppercase tracking-widest flex items-center gap-1">
                            <CheckCircle2 className="size-3" /> Concluída
                          </span>
                        )}
                      </div>
                      <h2 className="text-xl sm:text-2xl font-bold font-display text-white leading-tight">
                        {currentLesson.title}
                      </h2>
                    </div>
                  </div>

                  <div className="p-5 sm:p-6 space-y-5">
                    {currentLesson.description && (
                      <p
                        className={`text-sm leading-relaxed whitespace-pre-line ${
                          isDark ? 'text-slate-300' : 'text-slate-700'
                        }`}
                      >
                        {currentLesson.description}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        onClick={() => handleToggleComplete(currentLesson.id)}
                        className={`flex-1 min-w-[200px] py-3 px-4 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                          completedItems.has(currentLesson.id)
                            ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30'
                            : 'bg-primary text-white shadow-lg shadow-primary/25 hover:bg-primary/90'
                        }`}
                      >
                        {completedItems.has(currentLesson.id) ? (
                          <>
                            <CheckCircle2 className="size-4" /> Aula concluída
                          </>
                        ) : (
                          <>
                            <Check className="size-4" /> Marcar como concluída
                          </>
                        )}
                      </button>

                      {currentLesson.pdf_url && (
                        <a
                          href={currentLesson.pdf_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`py-3 px-4 rounded-2xl text-sm font-bold flex items-center gap-2 border transition-colors ${
                            isDark
                              ? 'border-white/10 hover:bg-white/5 text-slate-300'
                              : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <FileText className="size-4" /> Material
                        </a>
                      )}
                    </div>

                    {/* Navegação entre aulas */}
                    <div className="flex items-center justify-between gap-3 pt-4 border-t border-white/5">
                      <button
                        disabled={currentIndex <= 0}
                        onClick={() => setSelectedLessonId(lessons[currentIndex - 1]?.id || null)}
                        className={`flex items-center gap-1.5 text-xs font-bold transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer ${soft} hover:text-primary`}
                      >
                        <ChevronLeft className="size-4" /> Aula anterior
                      </button>
                      <button
                        disabled={currentIndex >= lessons.length - 1}
                        onClick={() => setSelectedLessonId(lessons[currentIndex + 1]?.id || null)}
                        className={`flex items-center gap-1.5 text-xs font-bold transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer ${soft} hover:text-primary`}
                      >
                        Próxima aula <ChevronRight className="size-4" />
                      </button>
                    </div>
                  </div>
                </motion.section>
              ) : null}

              {/* Trilha (timeline) */}
              {lessons.length > 0 && (
                <section className={`rounded-3xl border p-5 ${card}`}>
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <h2 className="text-sm font-bold font-display flex items-center gap-2">
                      <Sparkles className="size-4 text-primary" /> Trilha do curso
                    </h2>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
                      <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Buscar aula..."
                        className={`pl-8 pr-3 py-2 rounded-xl text-xs w-40 sm:w-56 outline-none border focus:border-primary/50 ${
                          isDark ? 'bg-white/5 border-white/10 text-slate-100' : 'bg-white border-slate-200'
                        }`}
                      />
                    </div>
                  </div>

                  {filteredLessons.length === 0 ? (
                    <div className="py-8 text-center">
                      <p className="text-sm text-slate-500 mb-2">Nenhuma aula encontrada para “{search}”.</p>
                      <button
                        onClick={() => setSearch('')}
                        className="text-xs font-bold text-primary hover:underline cursor-pointer"
                      >
                        Limpar busca
                      </button>
                    </div>
                  ) : (
                    <ol className="relative space-y-1">
                      {filteredLessons.map((lesson) => {
                        // Numeração pela posição real na trilha (antes usava o índice da lista filtrada)
                        const realIndex = lessons.findIndex((l) => l.id === lesson.id);
                        const done = completedItems.has(lesson.id);
                        const isCurrent = lesson.id === currentLesson?.id;

                        return (
                          <li key={lesson.id} className="relative flex gap-3 group">
                            <div className="flex flex-col items-center shrink-0">
                              <button
                                onClick={() => handleToggleComplete(lesson.id)}
                                aria-label={done ? 'Marcar como não concluída' : 'Marcar como concluída'}
                                className={`size-9 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all cursor-pointer z-10 ${
                                  done
                                    ? 'bg-emerald-500 border-emerald-500 text-white'
                                    : isCurrent
                                      ? 'border-primary text-primary bg-primary/10'
                                      : isDark
                                        ? 'border-white/15 text-slate-400 hover:border-primary/50'
                                        : 'border-slate-300 text-slate-500 hover:border-primary/50'
                                }`}
                              >
                                {done ? <Check className="size-4" /> : realIndex + 1}
                              </button>
                              {realIndex < lessons.length - 1 && (
                                <div
                                  className={`w-0.5 flex-1 min-h-[18px] ${
                                    done ? 'bg-emerald-500/40' : isDark ? 'bg-white/10' : 'bg-slate-200'
                                  }`}
                                />
                              )}
                            </div>

                            <button
                              onClick={() => setSelectedLessonId(lesson.id)}
                              className={`flex-1 text-left mb-2 p-3 rounded-2xl border transition-all cursor-pointer ${
                                isCurrent
                                  ? 'border-primary/50 bg-primary/5'
                                  : isDark
                                    ? 'border-transparent hover:bg-white/5'
                                    : 'border-transparent hover:bg-slate-50'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className={`text-sm font-bold leading-snug ${done ? 'line-through opacity-60' : ''}`}>
                                    {lesson.title}
                                  </p>
                                  {lesson.description && (
                                    <p className={`text-xs mt-0.5 line-clamp-1 ${soft}`}>{lesson.description}</p>
                                  )}
                                </div>
                                {lesson.duracao && (
                                  <span className={`text-[10px] font-bold shrink-0 ${soft}`}>{lesson.duracao}</span>
                                )}
                              </div>
                            </button>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </section>
              )}
            </div>

            {/* Lateral */}
            <div className="lg:col-span-4">
              <div className="sticky top-24 space-y-6">
                <EvolutionDiary />
              </div>
            </div>
          </div>
        )}
      </div>

      <BottomNav />

      {/* Modal de vídeo */}
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
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-4xl"
            >
              <div className="aspect-video rounded-2xl overflow-hidden shadow-2xl">
                <SecureVideoPlayer url={activeVideo.media_url || activeVideo.url} title={activeVideo.title} />
              </div>

              <div className="flex items-center justify-between gap-3 mt-4">
                <p className="text-sm font-bold text-white truncate">{activeVideo.title}</p>
                {!completedItems.has(activeVideo.id) && (
                  <button
                    onClick={() => {
                      handleToggleComplete(activeVideo.id);
                      setActiveVideo(null);
                    }}
                    className="shrink-0 px-4 py-2.5 rounded-xl bg-primary text-white text-xs font-bold flex items-center gap-2 hover:bg-primary/90 transition-colors cursor-pointer"
                  >
                    <Check className="size-4" /> Concluí esta aula
                  </button>
                )}
              </div>

              <button
                onClick={() => setActiveVideo(null)}
                aria-label="Fechar vídeo"
                className="absolute -top-2 right-0 sm:-right-2 p-2 rounded-full bg-black/70 text-white hover:bg-black transition-colors cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Curso concluído */}
      <AnimatePresence>
        {courseDoneOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
            onClick={() => setCourseDoneOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-sm rounded-3xl p-8 text-center border shadow-2xl ${
                isDark ? 'bg-[#0f0b15] border-white/10' : 'bg-white border-slate-200'
              }`}
            >
              <motion.div
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.1 }}
                className="size-20 rounded-3xl bg-accent-gold/15 border border-accent-gold/30 text-accent-gold flex items-center justify-center mx-auto mb-5"
              >
                <Trophy className="size-10" />
              </motion.div>
              <h3 className="text-2xl font-bold font-display mb-2">Curso concluído! 🎉</h3>
              <p className={`text-sm leading-relaxed mb-6 ${soft}`}>
                Você finalizou todas as {lessons.length} aulas de {selectedCourse?.title}. Que tal compartilhar sua
                conquista com a turma?
              </p>
              <div className="space-y-2">
                <Link
                  href="/comunidade"
                  className="block w-full py-3 rounded-2xl bg-primary text-white font-bold text-sm hover:bg-primary/90 transition-colors"
                >
                  Contar para a comunidade
                </Link>
                <button
                  onClick={() => setCourseDoneOpen(false)}
                  className={`w-full py-3 rounded-2xl font-bold text-sm border cursor-pointer ${
                    isDark
                      ? 'border-white/10 text-slate-300 hover:bg-white/5'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  Continuar aqui
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <BusinessSheetModal isOpen={isSheetOpen} onClose={() => setIsSheetOpen(false)} />
    </main>
  );
}

export default function JornadaPage() {
  return (
    <Suspense fallback={null}>
      <JornadaPageInner />
    </Suspense>
  );
}

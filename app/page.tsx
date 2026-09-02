'use client';

import Header from '@/components/Header';
import FeaturedLesson from '@/components/FeaturedLesson';
import EvolutionDiary from '@/components/EvolutionDiary';
import BottomNav from '@/components/BottomNav';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import {
  BookOpen,
  Play,
  X,
  Sparkles,
  MessageSquare,
  Users2,
  CheckSquare,
  Lightbulb,
  ArrowRight,
  Lock,
  CheckCircle2,
  GraduationCap,
  Compass,
  ChevronRight,
  Zap,
  Flame,
  Trophy,
  Star,
  Clock,
  Layers,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { getDirectDriveLink } from '@/lib/utils';
import { useTheme } from '@/lib/ThemeContext';
import { useSession } from '@/lib/SessionContext';
import { useToast } from '@/components/ToastProvider';
import {
  CourseWithAccess,
  getCoursesWithUserAccess,
  switchActiveCourse,
  enrollUser,
  DEFAULT_JOURNEY_ID,
} from '@/lib/courses';

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

function courseCover(course: CourseWithAccess) {
  return getDirectDriveLink(course.image_url) || `https://picsum.photos/seed/${course.id}/800/450`;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

export default function Page() {
  const { theme } = useTheme();
  const { user, profile, loading: sessionLoading } = useSession();
  const toast = useToast();
  const isDark = theme === 'dark';
  const router = useRouter();

  const [allCourses, setAllCourses] = useState<CourseWithAccess[]>([]);
  const [enrolledCourses, setEnrolledCourses] = useState<CourseWithAccess[]>([]);
  const [activeCourseId, setActiveCourseId] = useState<string>(DEFAULT_JOURNEY_ID);
  const [activeCourse, setActiveCourse] = useState<CourseWithAccess | null>(null);

  const [featuredLesson, setFeaturedLesson] = useState<LessonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lessonLoading, setLessonLoading] = useState(true);

  const [selectedCourseModal, setSelectedCourseModal] = useState<CourseWithAccess | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollSuccess, setEnrollSuccess] = useState(false);

  // ---------- Aula em destaque do curso ativo ----------
  const fetchFeaturedLessonForCourse = useCallback(async (userId: string, courseId: string, archetype?: string) => {
    setLessonLoading(true);
    try {
      const { data: progressData } = await supabase
        .from('lesson_progress')
        .select('lesson_id')
        .eq('user_id', userId)
        .eq('completed', true);
      const completedIds = new Set(progressData?.map((p) => p.lesson_id) || []);

      const { data: courseLessons } = await supabase
        .from('lessons')
        .select('*')
        .eq('journey_id', courseId)
        .order('dia', { ascending: true })
        .order('created_at', { ascending: true });

      if (courseLessons && courseLessons.length > 0) {
        setFeaturedLesson(courseLessons.find((l) => !completedIds.has(l.id)) || courseLessons[0]);
        return;
      }

      const { data: contentLessons } = await supabase
        .from('content')
        .select('*')
        .eq('archetype', archetype || 'Jornada')
        .order('created_at', { ascending: true });

      if (contentLessons && contentLessons.length > 0) {
        const next = contentLessons.find((c) => !completedIds.has(c.id)) || contentLessons[0];
        setFeaturedLesson({
          id: next.id,
          titulo: next.title || 'Aula do Curso',
          descricao: next.description || '',
          video_url: next.media_url || next.url || '',
          capa_url: next.thumbnail_url || '',
          pdf_url: '',
          categoria: next.archetype || 'Módulo',
        });
        return;
      }

      const { data: fallback } = await supabase.from('lessons').select('*').limit(1).maybeSingle();
      setFeaturedLesson(fallback || null);
    } catch (err) {
      console.error('Erro ao buscar aula do curso:', err);
      setFeaturedLesson(null);
    } finally {
      setLessonLoading(false);
    }
  }, []);

  const loadCoursesAndLessons = useCallback(
    async (userId: string, currentActiveCourseId?: string) => {
      try {
        const { allCourses: courses, enrolledCourses: enrolled, activeCourseId: fetchedActiveId } =
          await getCoursesWithUserAccess(userId);

        const currentActiveId = currentActiveCourseId || fetchedActiveId || DEFAULT_JOURNEY_ID;
        setAllCourses(courses);
        setEnrolledCourses(enrolled);
        setActiveCourseId(currentActiveId);

        const active = courses.find((c) => c.id === currentActiveId) || enrolled[0] || courses[0];
        setActiveCourse(active || null);
        await fetchFeaturedLessonForCourse(userId, active?.id || currentActiveId, active?.archetype);
      } catch (err) {
        console.error('Erro ao carregar cursos e aulas:', err);
      }
    },
    [fetchFeaturedLessonForCourse]
  );

  useEffect(() => {
    if (sessionLoading) return;
    if (!user) {
      window.location.href = '/login';
      return;
    }

    let isMounted = true;
    (async () => {
      const storedJourneyId = typeof window !== 'undefined' ? localStorage.getItem('active_journey_id') : null;
      await loadCoursesAndLessons(user.id, storedJourneyId || profile?.journey_id || DEFAULT_JOURNEY_ID);
      if (isMounted) setLoading(false);
    })();

    return () => {
      isMounted = false;
    };
  }, [sessionLoading, user, profile?.journey_id, loadCoursesAndLessons]);

  // ---------- Navegação ----------
  // Abre a grade de aulas do curso. Antes só trocava o estado e nada acontecia na tela.
  const openCourse = async (course: CourseWithAccess) => {
    if (!user) return;
    if (!course.isEnrolled) {
      setSelectedCourseModal(course);
      return;
    }
    setActiveCourseId(course.id);
    setActiveCourse(course);
    switchActiveCourse(user.id, course.id); // grava localStorage + perfil (não precisa aguardar)
    router.push(`/jornada?curso=${course.id}`);
  };

  const handleEnrollInCourse = async (course: CourseWithAccess) => {
    if (!user) {
      window.location.href = '/login';
      return;
    }
    setEnrolling(true);
    const success = await enrollUser(user.id, course.id);
    if (success) {
      setEnrollSuccess(true);
      await loadCoursesAndLessons(user.id, course.id);
      setTimeout(() => {
        setEnrolling(false);
        setEnrollSuccess(false);
        setSelectedCourseModal(null);
        router.push(`/jornada?curso=${course.id}`);
      }, 1200);
    } else {
      setEnrolling(false);
      toast.error(
        'Não foi possível liberar o acesso automaticamente.',
        'Fale com a administração para ativar este curso na sua conta.'
      );
    }
  };

  const studentName = profile?.name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Aluno(a)';
  const firstName = String(studentName).split(' ')[0];

  const totals = useMemo(() => {
    const done = enrolledCourses.reduce((a, c) => a + c.completedLessonsCount, 0);
    const all = enrolledCourses.reduce((a, c) => a + c.totalLessonsCount, 0);
    return { done, all, pct: all > 0 ? Math.round((done / all) * 100) : 0 };
  }, [enrolledCourses]);

  const availableCourses = allCourses.filter((c) => !c.isEnrolled);

  const card = isDark ? 'bg-white/[0.03] border-white/10' : 'bg-white border-slate-200 shadow-sm';
  const soft = isDark ? 'text-slate-400' : 'text-slate-600';

  if (loading) {
    return (
      <main className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-[#000000]' : 'bg-[#f7f6f8]'}`}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
          className="size-8 border-2 border-primary border-t-transparent rounded-full"
        />
      </main>
    );
  }

  return (
    <main className={`min-h-screen relative pb-24 transition-colors duration-200 ${isDark ? 'bg-[#000000] text-slate-100' : 'bg-[#f7f6f8] text-slate-900'}`}>
      <Header />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8">
        {/* ===== HERO: continue de onde parou ===== */}
        <section
          className={`relative overflow-hidden rounded-[2rem] border mb-8 ${
            isDark ? 'border-white/10' : 'border-slate-200 shadow-sm'
          }`}
        >
          {activeCourse && (
            <div className="absolute inset-0">
              <Image src={courseCover(activeCourse)} alt="" fill className="object-cover" unoptimized referrerPolicy="no-referrer" />
              <div className={`absolute inset-0 ${isDark ? 'bg-gradient-to-r from-black via-black/85 to-black/40' : 'bg-gradient-to-r from-white via-white/90 to-white/50'}`} />
            </div>
          )}
          <div className="absolute -top-24 -right-24 size-72 bg-primary/30 blur-[100px] rounded-full pointer-events-none" />

          <div className="relative p-6 sm:p-8 lg:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-primary/20 text-primary text-[10px] font-extrabold uppercase tracking-widest font-mono">
                  Portal do Aluno
                </span>
                {profile?.role === 'admin' && (
                  <span className="px-2.5 py-0.5 rounded-full bg-accent-gold/20 text-accent-gold text-[10px] font-extrabold uppercase tracking-widest font-mono">
                    Administrador
                  </span>
                )}
              </div>

              <h1 className="text-3xl sm:text-4xl font-bold font-display tracking-tight leading-tight">
                {greeting()}, <span className="text-primary">{firstName}</span>!
              </h1>

              {activeCourse ? (
                <>
                  <p className={`text-sm sm:text-base ${soft}`}>
                    Você está em <span className="font-bold text-primary">{activeCourse.title}</span> —{' '}
                    {activeCourse.progressPercent === 0
                      ? 'que tal começar a primeira aula hoje?'
                      : activeCourse.progressPercent === 100
                        ? 'curso concluído, parabéns! 🎉'
                        : `faltam ${activeCourse.totalLessonsCount - activeCourse.completedLessonsCount} aulas para concluir.`}
                  </p>

                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <button
                      onClick={() => openCourse(activeCourse)}
                      className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-primary text-white font-bold text-sm shadow-lg shadow-primary/30 hover:bg-primary/90 hover:-translate-y-0.5 transition-all cursor-pointer"
                    >
                      <Play className="size-4 fill-current" />
                      {activeCourse.progressPercent > 0 ? 'Continuar de onde parei' : 'Começar agora'}
                    </button>
                    <Link
                      href="/comunidade"
                      className={`inline-flex items-center gap-2 px-5 py-3 rounded-2xl border font-bold text-sm transition-all hover:-translate-y-0.5 ${
                        isDark ? 'border-white/15 bg-white/5 hover:bg-white/10' : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <Users2 className="size-4" />
                      Falar com a turma
                    </Link>
                  </div>
                </>
              ) : (
                <p className={`text-sm ${soft}`}>Escolha um curso abaixo para começar sua jornada.</p>
              )}
            </div>

            {/* Stats */}
            <div className="lg:col-span-5 grid grid-cols-3 gap-3">
              {[
                { icon: Trophy, label: 'Nível', value: profile?.level || 1, color: 'text-accent-gold' },
                { icon: Star, label: 'Pontos', value: profile?.points || 0, color: 'text-primary' },
                { icon: Flame, label: 'Sequência', value: `${profile?.streak || 0}d`, color: 'text-orange-500' },
              ].map((s) => (
                <motion.div
                  key={s.label}
                  whileHover={{ y: -3 }}
                  className={`p-4 rounded-2xl border text-center backdrop-blur-sm ${isDark ? 'bg-black/40 border-white/10' : 'bg-white/80 border-slate-200'}`}
                >
                  <s.icon className={`size-5 mx-auto mb-1.5 ${s.color}`} />
                  <div className="text-xl font-bold font-display leading-none">{s.value}</div>
                  <div className={`text-[10px] uppercase tracking-wider font-bold mt-1 ${soft}`}>{s.label}</div>
                </motion.div>
              ))}
              <div className={`col-span-3 p-4 rounded-2xl border backdrop-blur-sm ${isDark ? 'bg-black/40 border-white/10' : 'bg-white/80 border-slate-200'}`}>
                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider mb-2">
                  <span className={soft}>Progresso geral</span>
                  <span className="text-primary font-mono">{totals.done}/{totals.all} aulas · {totals.pct}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${totals.pct}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className="h-full bg-gradient-to-r from-primary to-accent-purple rounded-full"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-10">
            {/* ===== MEUS CURSOS ===== */}
            <section>
              <div className="flex items-end justify-between mb-4 px-1">
                <div>
                  <h2 className="text-xl font-bold font-display tracking-tight flex items-center gap-2">
                    <GraduationCap className="size-5 text-primary" />
                    Meus Cursos
                  </h2>
                  <p className={`text-xs ${soft}`}>Clique em um curso para abrir a grade de aulas.</p>
                </div>
                <Link href="/jornada" className="flex items-center gap-1 text-xs font-bold text-primary hover:underline">
                  Ver grade completa <ChevronRight className="size-3.5" />
                </Link>
              </div>

              {enrolledCourses.length === 0 ? (
                <div className={`p-10 text-center rounded-3xl border border-dashed ${card}`}>
                  <BookOpen className="size-10 text-slate-400 mx-auto mb-3" />
                  <p className="text-sm text-slate-500">Você ainda não tem cursos liberados. Explore o catálogo abaixo.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {enrolledCourses.map((course, i) => {
                    const isActive = course.id === activeCourseId;
                    return (
                      <motion.button
                        key={course.id}
                        type="button"
                        onClick={() => openCourse(course)}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        whileHover={{ y: -4 }}
                        whileTap={{ scale: 0.99 }}
                        className={`group text-left relative overflow-hidden rounded-3xl border transition-all cursor-pointer ${
                          isActive ? 'border-primary/60 shadow-lg shadow-primary/10' : isDark ? 'border-white/10 hover:border-white/25' : 'border-slate-200 hover:border-primary/40 shadow-sm hover:shadow-md'
                        } ${isDark ? 'bg-white/[0.03]' : 'bg-white'}`}
                      >
                        {/* Capa */}
                        <div className="relative aspect-[16/9] overflow-hidden">
                          <Image
                            src={courseCover(course)}
                            alt={course.title}
                            fill
                            className="object-cover transition-transform duration-500 group-hover:scale-105"
                            unoptimized
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                          <div className="absolute top-3 left-3 flex gap-2">
                            {isActive && (
                              <span className="px-2.5 py-1 rounded-full bg-primary text-white text-[10px] font-bold uppercase tracking-wider shadow">
                                Em andamento
                              </span>
                            )}
                            {course.progressPercent === 100 && (
                              <span className="px-2.5 py-1 rounded-full bg-emerald-500 text-white text-[10px] font-bold uppercase tracking-wider shadow">
                                Concluído
                              </span>
                            )}
                          </div>
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="size-14 rounded-full bg-white/90 text-primary flex items-center justify-center shadow-xl">
                              <Play className="size-6 fill-current ml-0.5" />
                            </span>
                          </div>
                          <div className="absolute bottom-3 left-3 right-3">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-white/80">{course.archetype}</span>
                            <h3 className="text-base font-bold font-display text-white leading-tight line-clamp-2">{course.title}</h3>
                          </div>
                        </div>

                        {/* Rodapé */}
                        <div className="p-4 space-y-3">
                          <div className="flex items-center justify-between text-xs">
                            <span className={`flex items-center gap-1.5 ${soft}`}>
                              <Layers className="size-3.5" />
                              {course.completedLessonsCount}/{course.totalLessonsCount} aulas
                            </span>
                            <span className={`flex items-center gap-1.5 ${soft}`}>
                              <Clock className="size-3.5" />
                              {course.duration || `${course.steps || 10} módulos`}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                              <div className="h-full bg-gradient-to-r from-primary to-accent-purple rounded-full transition-all" style={{ width: `${course.progressPercent}%` }} />
                            </div>
                            <span className="text-xs font-bold text-primary font-mono w-10 text-right">{course.progressPercent}%</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs font-bold text-primary group-hover:translate-x-0.5 transition-transform">
                            {course.progressPercent > 0 ? 'Continuar curso' : 'Começar curso'}
                            <ArrowRight className="size-3.5" />
                          </div>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              )}
            </section>

            {/* ===== AULA EM DESTAQUE ===== */}
            {activeCourse && (
              <section>
                <div className="mb-4 px-1">
                  <h2 className="text-xl font-bold font-display tracking-tight flex items-center gap-2">
                    <Sparkles className="size-5 text-accent-gold" />
                    Sua próxima aula
                  </h2>
                  <p className={`text-xs ${soft}`}>A próxima aula não concluída de {activeCourse.title}.</p>
                </div>
                <FeaturedLesson lesson={featuredLesson} loading={lessonLoading} courseTitle={activeCourse.title} />
              </section>
            )}

            {/* ===== CATÁLOGO ===== */}
            {availableCourses.length > 0 && (
              <section>
                <div className="mb-4 px-1">
                  <h2 className="text-xl font-bold font-display tracking-tight flex items-center gap-2">
                    <Compass className="size-5 text-accent-purple" />
                    Descubra novos cursos
                  </h2>
                  <p className={`text-xs ${soft}`}>Trilhas disponíveis para liberar na sua conta.</p>
                </div>

                <div className="flex gap-4 overflow-x-auto pb-3 -mx-1 px-1 snap-x">
                  {availableCourses.map((course) => (
                    <motion.button
                      key={course.id}
                      type="button"
                      whileHover={{ y: -4 }}
                      onClick={() => setSelectedCourseModal(course)}
                      className={`group text-left snap-start shrink-0 w-[260px] rounded-3xl border overflow-hidden transition-all cursor-pointer ${
                        isDark ? 'bg-white/[0.02] border-white/10 hover:border-primary/40' : 'bg-white border-slate-200 hover:border-primary/40 shadow-sm hover:shadow-md'
                      }`}
                    >
                      <div className="relative aspect-[16/10] overflow-hidden">
                        <Image src={courseCover(course)} alt={course.title} fill className="object-cover transition-transform duration-500 group-hover:scale-105" unoptimized referrerPolicy="no-referrer" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                        <span className="absolute top-3 left-3 flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/90 text-white text-[10px] font-bold uppercase tracking-wider">
                          <Lock className="size-3" /> Disponível
                        </span>
                      </div>
                      <div className="p-4">
                        <h3 className="text-sm font-bold font-display mb-1 line-clamp-2 group-hover:text-primary transition-colors">{course.title}</h3>
                        <p className={`text-xs line-clamp-2 mb-3 ${soft}`}>
                          {course.description || 'Aprenda do zero ao avançado com metodologia prática.'}
                        </p>
                        <div className="flex items-center justify-between text-xs">
                          <span className={soft}>{course.steps || 10} módulos</span>
                          <span className="font-bold text-primary flex items-center gap-1">
                            Ver detalhes <ArrowRight className="size-3" />
                          </span>
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </section>
            )}

            {/* ===== HUB ===== */}
            <section>
              <div className="mb-4 px-1">
                <h2 className="text-xl font-bold font-display tracking-tight flex items-center gap-2">
                  <Zap className="size-5 text-accent-gold" />
                  Ferramentas do Aluno
                </h2>
                <p className={`text-xs ${soft}`}>Mentoria, comunidade e recursos de apoio aos seus cursos.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {[
                  { href: '/lyra', icon: MessageSquare, title: 'Mentora IA', desc: 'Tire dúvidas e crie prompts com a consultora.', accent: 'text-primary bg-primary/15 border-primary/30' },
                  { href: '/comunidade', icon: Users2, title: 'Comunidade', desc: 'Converse com quem está na mesma jornada.', accent: 'text-emerald-500 bg-emerald-500/15 border-emerald-500/30' },
                  { href: '/planner', icon: CheckSquare, title: 'Planner', desc: 'Metas, checklists e calendário de estudos.', accent: 'text-indigo-500 bg-indigo-500/15 border-indigo-500/30' },
                  { href: '/dicas', icon: Lightbulb, title: 'Prompts & Dicas', desc: 'Fórmulas prontas de carrosséis e ganchos.', accent: 'text-accent-gold bg-accent-gold/15 border-accent-gold/30' },
                ].map((t) => (
                  <Link key={t.href} href={t.href}>
                    <motion.div
                      whileHover={{ y: -3 }}
                      className={`h-full rounded-3xl p-5 border transition-all group ${isDark ? 'bg-white/[0.03] border-white/10 hover:border-white/25' : 'bg-white border-slate-200 shadow-sm hover:shadow-md'}`}
                    >
                      <div className={`size-11 rounded-2xl flex items-center justify-center mb-3 border ${t.accent}`}>
                        <t.icon className="size-5" />
                      </div>
                      <h3 className="text-sm font-bold font-display mb-1">{t.title}</h3>
                      <p className={`text-xs leading-relaxed ${soft}`}>{t.desc}</p>
                      <div className="mt-3 flex items-center gap-1 text-[11px] font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                        Abrir <ArrowRight className="size-3" />
                      </div>
                    </motion.div>
                  </Link>
                ))}
              </div>
            </section>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-4">
            <div className="sticky top-24 space-y-6">
              <EvolutionDiary />
            </div>
          </div>
        </div>

        <footer className="mt-16 pt-8 pb-12 border-t border-white/5 text-center text-xs text-slate-500">
          <div className="flex flex-wrap items-center justify-center gap-4 mb-2">
            <Link href="/privacidade" className="hover:text-slate-400 underline underline-offset-2 transition-colors">Política de Privacidade</Link>
            <span>•</span>
            <Link href="/perfil" className="hover:text-slate-400 underline underline-offset-2 transition-colors">Meus Cursos & Perfil</Link>
          </div>
          <p>© {new Date().getFullYear()} Plataforma de Cursos Online. Todos os direitos reservados.</p>
        </footer>
      </div>

      <BottomNav />

      {/* ===== MODAL: detalhes / matrícula ===== */}
      <AnimatePresence>
        {selectedCourseModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setSelectedCourseModal(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={`relative w-full max-w-lg rounded-3xl overflow-hidden border shadow-2xl ${isDark ? 'bg-[#0f0b15] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative aspect-[16/8]">
                <Image src={courseCover(selectedCourseModal)} alt={selectedCourseModal.title} fill className="object-cover" unoptimized referrerPolicy="no-referrer" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                <button
                  onClick={() => setSelectedCourseModal(null)}
                  className="absolute top-4 right-4 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors cursor-pointer"
                >
                  <X className="size-5" />
                </button>
                <div className="absolute bottom-4 left-5 right-5">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-primary text-white">
                    {selectedCourseModal.archetype || 'Curso online'}
                  </span>
                  <h3 className="text-xl font-bold font-display text-white mt-2 leading-tight">{selectedCourseModal.title}</h3>
                </div>
              </div>

              <div className="p-6 space-y-5">
                <p className={`text-sm leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  {selectedCourseModal.description || 'Curso prático passo a passo com aulas gravadas, desafios aplicados, materiais de apoio e suporte.'}
                </p>

                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    { label: 'Módulos', value: selectedCourseModal.steps || 10 },
                    { label: 'Duração', value: selectedCourseModal.duration || 'Imediato' },
                    { label: 'Status', value: selectedCourseModal.isEnrolled ? 'Liberado' : 'Disponível' },
                  ].map((s) => (
                    <div key={s.label} className={`p-3 rounded-2xl border ${isDark ? 'bg-black/40 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                      <div className="text-sm font-bold">{s.value}</div>
                      <div className={`text-[10px] uppercase tracking-wider font-bold ${soft}`}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {enrollSuccess ? (
                  <div className="p-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-center font-bold text-sm flex items-center justify-center gap-2">
                    <CheckCircle2 className="size-5" /> Matrícula ativada! Abrindo o curso...
                  </div>
                ) : selectedCourseModal.isEnrolled ? (
                  <div className="space-y-2">
                    <button
                      onClick={() => {
                        const c = selectedCourseModal;
                        setSelectedCourseModal(null);
                        openCourse(c);
                      }}
                      className="w-full py-3.5 rounded-2xl bg-primary text-white font-bold text-sm shadow-md hover:bg-primary/90 transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Play className="size-4 fill-current" /> Abrir curso
                    </button>
                    <Link
                      href={`/jornada/${selectedCourseModal.id}`}
                      onClick={() => setSelectedCourseModal(null)}
                      className={`block w-full py-3 rounded-2xl font-bold text-sm border text-center transition-colors ${
                        isDark ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      Ver detalhes e aulas
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <button
                      onClick={() => handleEnrollInCourse(selectedCourseModal)}
                      disabled={enrolling}
                      className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-primary to-accent-purple text-white font-bold text-sm shadow-lg shadow-primary/20 hover:opacity-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                    >
                      <Zap className="size-4 fill-current" />
                      {enrolling ? 'Liberando acesso...' : 'Liberar acesso agora'}
                    </button>
                    <p className="text-[11px] text-center text-slate-500">O curso será adicionado ao seu painel e aberto em seguida.</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

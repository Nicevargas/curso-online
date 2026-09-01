'use client';

import Header from '@/components/Header';
import FeaturedLesson from '@/components/FeaturedLesson';
import EvolutionDiary from '@/components/EvolutionDiary';
import BottomNav from '@/components/BottomNav';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BookOpen, 
  Play, 
  X, 
  Sparkles, 
  Clock, 
  Users, 
  MessageSquare, 
  Users2, 
  CheckSquare, 
  Lightbulb, 
  ArrowRight, 
  Layers, 
  Lock, 
  CheckCircle2, 
  GraduationCap, 
  Compass, 
  ChevronRight,
  ShieldAlert,
  Zap
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { getDirectDriveLink, getEmbedVideoUrl } from '@/lib/utils';
import { useTheme } from '@/lib/ThemeContext';
import { 
  CourseWithAccess, 
  getCoursesWithUserAccess, 
  switchActiveCourse, 
  enrollUser, 
  DEFAULT_JOURNEY_ID 
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

export default function Page() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  
  // Courses state
  const [allCourses, setAllCourses] = useState<CourseWithAccess[]>([]);
  const [enrolledCourses, setEnrolledCourses] = useState<CourseWithAccess[]>([]);
  const [activeCourseId, setActiveCourseId] = useState<string>(DEFAULT_JOURNEY_ID);
  const [activeCourse, setActiveCourse] = useState<CourseWithAccess | null>(null);

  // Lesson state
  const [featuredLesson, setFeaturedLesson] = useState<LessonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lessonLoading, setLessonLoading] = useState(true);
  const [activeVideo, setActiveVideo] = useState<string | null>(null);

  // Course Details / Enrollment Modal
  const [selectedCourseModal, setSelectedCourseModal] = useState<CourseWithAccess | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollSuccess, setEnrollSuccess] = useState(false);

  // Buscar a aula para o curso ativo
  const fetchFeaturedLessonForCourse = useCallback(async (userId: string, courseId: string, archetype?: string) => {
    setLessonLoading(true);
    try {
      // 1. Obter progresso do aluno
      const { data: progressData } = await supabase
        .from('lesson_progress')
        .select('lesson_id')
        .eq('user_id', userId)
        .eq('completed', true);
      
      const completedIds = new Set(progressData?.map(p => p.lesson_id) || []);

      // 2. Tentar buscar aulas da tabela 'lessons' associadas a esse curso
      const { data: courseLessons } = await supabase
        .from('lessons')
        .select('*')
        .eq('journey_id', courseId)
        .order('dia', { ascending: true })
        .order('created_at', { ascending: true });

      if (courseLessons && courseLessons.length > 0) {
        // Encontrar a primeira aula não concluída
        const next = courseLessons.find(l => !completedIds.has(l.id));
        if (next) {
          setFeaturedLesson(next);
          setLessonLoading(false);
          return;
        }
        // Se todas foram concluídas, exibe a última ou primeira
        setFeaturedLesson(courseLessons[0]);
        setLessonLoading(false);
        return;
      }

      // 3. Se não houver em 'lessons', buscar da tabela 'content' pelo archetype
      const searchArchetype = archetype || 'Jornada';
      const { data: contentLessons } = await supabase
        .from('content')
        .select('*')
        .eq('archetype', searchArchetype)
        .order('created_at', { ascending: true });

      if (contentLessons && contentLessons.length > 0) {
        const nextContent = contentLessons.find(c => !completedIds.has(c.id)) || contentLessons[0];
        setFeaturedLesson({
          id: nextContent.id,
          titulo: nextContent.title || 'Aula do Curso',
          descricao: nextContent.description || '',
          video_url: nextContent.media_url || nextContent.url || '',
          capa_url: nextContent.thumbnail_url || '',
          pdf_url: '',
          categoria: nextContent.archetype || 'Módulo'
        });
        setLessonLoading(false);
        return;
      }

      // 4. Fallback para aula de boas-vindas geral
      const { data: fallback } = await supabase
        .from('lessons')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (fallback) {
        setFeaturedLesson(fallback);
      } else {
        setFeaturedLesson(null);
      }
    } catch (err) {
      console.error('Erro ao buscar aula do curso:', err);
      setFeaturedLesson(null);
    } finally {
      setLessonLoading(false);
    }
  }, []);

  // Carregar dados e cursos
  const loadCoursesAndLessons = useCallback(async (userId: string, currentActiveCourseId?: string) => {
    try {
      const { allCourses: courses, enrolledCourses: enrolled, activeCourseId: fetchedActiveId } = 
        await getCoursesWithUserAccess(userId);
      
      const currentActiveId = currentActiveCourseId || fetchedActiveId || DEFAULT_JOURNEY_ID;
      
      setAllCourses(courses);
      setEnrolledCourses(enrolled);
      setActiveCourseId(currentActiveId);

      const active = courses.find(c => c.id === currentActiveId) || enrolled[0] || courses[0];
      setActiveCourse(active || null);

      // Buscar aula em destaque para o curso ativo
      await fetchFeaturedLessonForCourse(userId, active?.id || currentActiveId, active?.archetype);
    } catch (err) {
      console.error('Erro ao carregar cursos e aulas:', err);
    }
  }, [fetchFeaturedLessonForCourse]);

  useEffect(() => {
    let isMounted = true;

    async function init() {
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !authUser) {
        if (isMounted) window.location.href = '/login';
        return;
      }

      if (isMounted) setUser(authUser);

      // Fetch user profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (isMounted && profileData) {
        setProfile(profileData);
      }

      const storedJourneyId = typeof window !== 'undefined' ? localStorage.getItem('active_journey_id') : null;
      const initialActiveId = storedJourneyId || profileData?.journey_id || DEFAULT_JOURNEY_ID;

      await loadCoursesAndLessons(authUser.id, initialActiveId);
      if (isMounted) setLoading(false);
    }

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        window.location.href = '/login';
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [loadCoursesAndLessons]);

  // Trocar curso ativo
  const handleSelectActiveCourse = async (course: CourseWithAccess) => {
    if (!user) return;
    if (!course.isEnrolled) {
      setSelectedCourseModal(course);
      return;
    }
    setActiveCourseId(course.id);
    setActiveCourse(course);
    await switchActiveCourse(user.id, course.id);
    await fetchFeaturedLessonForCourse(user.id, course.id, course.archetype);
  };

  // Realizar matrícula / liberação
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
      }, 1500);
    } else {
      setEnrolling(false);
    }
  };

  const studentName = profile?.name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Aluno(a)';

  return (
    <main className={`min-h-screen relative pb-24 transition-colors duration-200 ${
      isDark ? 'bg-[#000000] text-slate-100' : 'bg-[#f7f6f8] text-slate-900'
    }`}>
      <Header />
      
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8">
        
        {/* Student Welcome & Course Switcher Bar */}
        <section className={`p-6 rounded-3xl border mb-8 transition-all ${
          isDark 
            ? 'bg-gradient-to-r from-white/[0.04] via-primary/10 to-transparent border-white/10' 
            : 'bg-white border-slate-200/80 shadow-sm'
        }`}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-primary/20 text-primary text-[10px] font-extrabold uppercase tracking-widest font-mono">
                  PORTAL DO ALUNO
                </span>
                {profile?.role === 'admin' && (
                  <span className="px-2.5 py-0.5 rounded-full bg-accent-gold/20 text-accent-gold text-[10px] font-extrabold uppercase tracking-widest font-mono">
                    ADMINISTRADOR
                  </span>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight">
                Olá, <span className="text-primary">{studentName}</span>! 👋
              </h1>
              <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                {enrolledCourses.length > 1 
                  ? `Você possui acesso a ${enrolledCourses.length} cursos online. Escolha abaixo qual deseja estudar hoje.`
                  : 'Continue seus estudos de onde parou ou explore outros cursos disponíveis na plataforma.'
                }
              </p>
            </div>

            {/* Active Course Quick Selector */}
            {enrolledCourses.length > 0 && (
              <div className={`p-3.5 rounded-2xl border shrink-0 min-w-[280px] ${
                isDark ? 'bg-black/40 border-white/10' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider mb-2">
                  <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Curso em Andamento</span>
                  <span className="text-primary font-mono">{activeCourse?.progressPercent || 0}% Concluído</span>
                </div>
                <div className="flex items-center gap-2 mb-2.5">
                  <GraduationCap className="size-4 text-primary shrink-0" />
                  <span className="text-sm font-bold truncate">
                    {activeCourse?.title || 'Selecione um curso'}
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-primary to-accent-purple rounded-full transition-all duration-500"
                    style={{ width: `${activeCourse?.progressPercent || 0}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Quick Enrolled Courses Tabs if user has multiple courses */}
          {enrolledCourses.length > 1 && (
            <div className="mt-6 pt-5 border-t border-white/5">
              <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mr-2 shrink-0">
                  Alternar Curso:
                </span>
                {enrolledCourses.map((c) => {
                  const isCurrent = c.id === activeCourseId;
                  return (
                    <button
                      key={c.id}
                      onClick={() => handleSelectActiveCourse(c)}
                      className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 border ${
                        isCurrent
                          ? 'bg-primary text-white border-primary shadow-sm shadow-primary/30'
                          : isDark
                            ? 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <BookOpen className="size-3.5" />
                      <span className="truncate max-w-[180px]">{c.title}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${
                        isCurrent ? 'bg-white/20 text-white' : 'bg-black/10 dark:bg-white/10 text-slate-400'
                      }`}>
                        {c.progressPercent}%
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* Main 2-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Main Left Column */}
          <div className="lg:col-span-8 space-y-10">
            
            {/* 1. Featured Lesson for Active Course */}
            <div>
              <FeaturedLesson 
                lesson={featuredLesson} 
                loading={lessonLoading}
                courseTitle={activeCourse?.title}
              />
            </div>

            {/* 2. Meus Cursos Matriculados */}
            <section>
              <div className="flex items-center justify-between mb-4 px-1">
                <div>
                  <h2 className="text-xl font-bold font-display tracking-tight flex items-center gap-2">
                    <GraduationCap className="size-5 text-primary" />
                    Meus Cursos com Acesso Liberado
                  </h2>
                  <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    Cursos online disponíveis na sua conta para assistir e praticar.
                  </p>
                </div>
                <Link 
                  href="/jornada" 
                  className="flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                >
                  <span>Ver Todos os Módulos</span>
                  <ChevronRight className="size-3.5" />
                </Link>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {enrolledCourses.map((course) => {
                  const isActive = course.id === activeCourseId;
                  return (
                    <motion.div
                      key={course.id}
                      whileHover={{ y: -3 }}
                      className={`relative overflow-hidden rounded-2xl p-5 border transition-all flex flex-col justify-between ${
                        isActive
                          ? isDark
                            ? 'bg-gradient-to-br from-primary/20 via-black to-black border-primary/50 shadow-md shadow-primary/10'
                            : 'bg-white border-primary/40 shadow-md'
                          : isDark
                            ? 'bg-white/[0.03] border-white/10 hover:border-white/20'
                            : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="size-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 text-primary">
                            <BookOpen className="size-6" />
                          </div>
                          <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[10px] font-bold uppercase tracking-wider">
                            <CheckCircle2 className="size-3" />
                            Acesso Liberado
                          </span>
                        </div>

                        <h3 className="text-base font-bold font-display mb-1.5 line-clamp-2">
                          {course.title}
                        </h3>
                        <p className={`text-xs mb-4 line-clamp-2 leading-relaxed ${
                          isDark ? 'text-slate-400' : 'text-slate-600'
                        }`}>
                          {course.description || 'Domine conceitos práticos, desafios reais e estratégias exclusivas neste curso.'}
                        </p>
                      </div>

                      <div className="space-y-3 pt-3 border-t border-white/5">
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>
                            {course.completedLessonsCount} de {course.totalLessonsCount} aulas concluídas
                          </span>
                          <span className="text-primary font-bold">{course.progressPercent}%</span>
                        </div>

                        <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                          <div 
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${course.progressPercent}%` }}
                          />
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          <button
                            onClick={() => handleSelectActiveCourse(course)}
                            className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                              isActive
                                ? 'bg-primary text-white shadow-sm hover:bg-primary/90'
                                : isDark
                                  ? 'bg-white/10 hover:bg-white/20 text-white'
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                            }`}
                          >
                            <Play className="size-3.5 fill-current" />
                            <span>{isActive ? 'Continuar Estudando' : 'Selecionar Curso'}</span>
                          </button>
                          <Link
                            href="/jornada"
                            onClick={() => handleSelectActiveCourse(course)}
                            className={`p-2.5 rounded-xl border flex items-center justify-center transition-all ${
                              isDark ? 'border-white/10 hover:bg-white/10 text-slate-300' : 'border-slate-200 hover:bg-slate-100 text-slate-700'
                            }`}
                            title="Ver Grade de Aulas"
                          >
                            <Layers className="size-4" />
                          </Link>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </section>

            {/* 3. Catálogo de Cursos Online (Todos os Cursos da Plataforma) */}
            {allCourses.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-4 px-1">
                  <div>
                    <h2 className="text-xl font-bold font-display tracking-tight flex items-center gap-2">
                      <Compass className="size-5 text-accent-purple" />
                      Catálogo de Cursos Online
                    </h2>
                    <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      Explore todos os cursos e trilhas de formação da nossa plataforma.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {allCourses.map((course) => {
                    const isEnrolled = course.isEnrolled;
                    return (
                      <div
                        key={course.id}
                        onClick={() => setSelectedCourseModal(course)}
                        className={`group cursor-pointer rounded-2xl p-5 border transition-all flex flex-col justify-between ${
                          isDark 
                            ? 'bg-white/[0.02] border-white/10 hover:border-primary/40 hover:bg-white/[0.04]' 
                            : 'bg-white border-slate-200 hover:border-primary/40 shadow-sm hover:shadow-md'
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2 mb-3">
                            <span className="px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              {course.duration || `${course.steps || 10} Módulos`}
                            </span>

                            {isEnrolled ? (
                              <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[10px] font-bold">
                                <CheckCircle2 className="size-3" />
                                Matriculado
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-bold">
                                <Lock className="size-3" />
                                Disponível
                              </span>
                            )}
                          </div>

                          <h3 className="text-base font-bold font-display mb-1.5 group-hover:text-primary transition-colors line-clamp-2">
                            {course.title}
                          </h3>
                          <p className={`text-xs mb-4 line-clamp-2 leading-relaxed ${
                            isDark ? 'text-slate-400' : 'text-slate-600'
                          }`}>
                            {course.description || 'Aprenda do zero ao avançado com metodologia prática e acompanhamento.'}
                          </p>
                        </div>

                        <div className="pt-3 border-t border-white/5 flex items-center justify-between text-xs">
                          <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>
                            {course.steps || 10} Módulos práticos
                          </span>
                          <span className="font-bold text-primary flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                            {isEnrolled ? 'Acessar' : 'Ver Detalhes'}
                            <ArrowRight className="size-3" />
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* 4. Action Cards Section (Hub de Ferramentas & Suporte) */}
            <section>
              <div className="mb-4 px-1">
                <h2 className="text-xl font-bold font-display tracking-tight flex items-center gap-2">
                  <Sparkles className="size-5 text-accent-gold" />
                  Hub do Aluno & Ferramentas Inteligentes
                </h2>
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Ferramentas, mentoria e recursos de apoio aos seus cursos.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 1. Conselheira & Consultora de IA */}
                <Link href="/lyra">
                  <motion.div 
                    whileHover={{ y: -3 }}
                    className={`relative overflow-hidden rounded-3xl p-6 h-full group transition-all ${
                      isDark 
                        ? 'bg-gradient-to-br from-primary/25 to-accent-purple/20 border border-primary/30 hover:border-primary/60' 
                        : 'bg-white border border-primary/20 shadow-sm hover:shadow-md hover:border-primary/40'
                    }`}
                  >
                    <div className="relative z-10">
                      <div className="size-12 rounded-2xl bg-primary/20 flex items-center justify-center mb-4 border border-primary/30 text-primary">
                        <MessageSquare className="size-6" />
                      </div>
                      <h3 className={`text-lg font-bold mb-1.5 font-display ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                        Conselheira & Consultora IA
                      </h3>
                      <p className={`text-xs leading-relaxed mb-4 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                        Tire dúvidas sobre as aulas, crie prompts inteligentes, ideias de campanhas e receba consultoria estratégica.
                      </p>
                      <div className="flex items-center gap-1.5 text-xs font-bold text-primary uppercase tracking-wider">
                        <span>Consultar Mentora IA</span>
                        <Sparkles className="size-3.5" />
                      </div>
                    </div>
                  </motion.div>
                </Link>

                {/* 2. Mentoria & Comunidade */}
                <Link href="/comunidade">
                  <motion.div 
                    whileHover={{ y: -3 }}
                    className={`relative overflow-hidden rounded-3xl p-6 h-full group transition-all ${
                      isDark 
                        ? 'bg-white/[0.03] border border-white/10 hover:border-primary/30 hover:bg-white/[0.06]' 
                        : 'bg-white border border-slate-200 shadow-sm hover:shadow-md hover:border-primary/30'
                    }`}
                  >
                    <div className="relative z-10">
                      <div className={`size-12 rounded-2xl flex items-center justify-center mb-4 border ${
                        isDark ? 'bg-white/10 border-white/10' : 'bg-slate-100 border-slate-200'
                      }`}>
                        <Users2 className={`size-6 ${isDark ? 'text-slate-300' : 'text-slate-700'}`} />
                      </div>
                      <h3 className={`text-lg font-bold mb-1.5 font-display ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                        Mentoria & Comunidade
                      </h3>
                      <p className={`text-xs leading-relaxed mb-4 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                        Espaço de mentoria para compartilhar suas criações, interagir com outros alunos e receber feedbacks.
                      </p>
                      <div className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider group-hover:text-primary transition-colors ${
                        isDark ? 'text-slate-300' : 'text-slate-700'
                      }`}>
                        <span>Acessar Comunidade</span>
                        <ArrowRight className="size-3.5" />
                      </div>
                    </div>
                  </motion.div>
                </Link>

                {/* 3. Planner de Estudos & Metas */}
                <Link href="/planner">
                  <motion.div 
                    whileHover={{ y: -3 }}
                    className={`relative overflow-hidden rounded-3xl p-6 h-full group transition-all ${
                      isDark 
                        ? 'bg-gradient-to-br from-indigo-500/20 to-primary/20 border border-indigo-500/20 hover:border-indigo-500/50' 
                        : 'bg-white border border-indigo-200 shadow-sm hover:shadow-md hover:border-indigo-300'
                    }`}
                  >
                    <div className="relative z-10">
                      <div className="size-12 rounded-2xl bg-indigo-500/20 flex items-center justify-center mb-4 border border-indigo-500/30 text-indigo-500">
                        <CheckSquare className="size-6" />
                      </div>
                      <h3 className={`text-lg font-bold mb-1.5 font-display ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                        Planner de Estudos & Metas
                      </h3>
                      <p className={`text-xs leading-relaxed mb-4 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                        Organize seu plano de estudos, checklists de tarefas, calendário de publicações e metas de conclusão.
                      </p>
                      <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-500 uppercase tracking-wider group-hover:text-indigo-400 transition-colors">
                        <span>Abrir Planner</span>
                        <ArrowRight className="size-3.5" />
                      </div>
                    </div>
                  </motion.div>
                </Link>

                {/* 4. Dicas & Fórmulas Prontas */}
                <Link href="/dicas">
                  <motion.div 
                    whileHover={{ y: -3 }}
                    className={`relative overflow-hidden rounded-3xl p-6 h-full group transition-all ${
                      isDark 
                        ? 'bg-gradient-to-br from-accent-gold/20 to-amber-500/20 border border-accent-gold/20 hover:border-accent-gold/50' 
                        : 'bg-white border border-amber-200 shadow-sm hover:shadow-md hover:border-amber-300'
                    }`}
                  >
                    <div className="relative z-10">
                      <div className="size-12 rounded-2xl bg-accent-gold/20 flex items-center justify-center mb-4 border border-accent-gold/30 text-accent-gold">
                        <Lightbulb className="size-6" />
                      </div>
                      <h3 className={`text-lg font-bold mb-1.5 font-display ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                        Prompts & Dicas Estratégicas
                      </h3>
                      <p className={`text-xs leading-relaxed mb-4 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                        Comandos prontos de IA, fórmulas de carrosséis de alta conversão, ganchos magnéticos e paletas visuais.
                      </p>
                      <div className="flex items-center gap-1.5 text-xs font-bold text-accent-gold uppercase tracking-wider group-hover:text-amber-400 transition-colors">
                        <span>Ver Banco de Prompts</span>
                        <Sparkles className="size-3.5" />
                      </div>
                    </div>
                  </motion.div>
                </Link>
              </div>
            </section>
          </div>
          
          {/* Sidebar Column on Desktop */}
          <div className="lg:col-span-4 space-y-6">
            <div className="sticky top-24 space-y-6">
              <EvolutionDiary />
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-16 pt-8 pb-12 border-t border-white/5 text-center text-xs text-slate-500">
          <div className="flex flex-wrap items-center justify-center gap-4 mb-2">
            <Link href="/privacidade" className="hover:text-slate-400 underline underline-offset-2 transition-colors">
              Política de Privacidade
            </Link>
            <span>•</span>
            <Link href="/perfil" className="hover:text-slate-400 underline underline-offset-2 transition-colors">
              Meus Cursos & Perfil
            </Link>
          </div>
          <p>© {new Date().getFullYear()} Plataforma de Cursos Online. Todos os direitos reservados.</p>
        </footer>
      </div>

      <BottomNav />

      {/* Course Details & Enrollment Modal */}
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
              className={`relative w-full max-w-lg rounded-3xl p-6 sm:p-8 border shadow-2xl ${
                isDark ? 'bg-[#0f0b15] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setSelectedCourseModal(null)}
                className="absolute top-5 right-5 p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
              >
                <X className="size-5" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="size-14 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary">
                  <GraduationCap className="size-8" />
                </div>
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-primary/20 text-primary">
                    CURSO ONLINE
                  </span>
                  <h3 className="text-xl font-bold font-display mt-1">
                    {selectedCourseModal.title}
                  </h3>
                </div>
              </div>

              <p className={`text-sm leading-relaxed mb-6 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                {selectedCourseModal.description || 'Curso prático passo a passo com aulas gravadas, desafios aplicados, materiais de apoio para download e suporte.'}
              </p>

              <div className={`p-4 rounded-2xl border mb-6 space-y-2 text-xs ${
                isDark ? 'bg-black/40 border-white/5' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Total de Módulos:</span>
                  <span className="font-bold">{selectedCourseModal.steps || 10} Módulos</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Duração / Formato:</span>
                  <span className="font-bold">{selectedCourseModal.duration || 'Acesso Imediato'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Status na sua conta:</span>
                  <span className={`font-bold ${selectedCourseModal.isEnrolled ? 'text-emerald-500' : 'text-amber-400'}`}>
                    {selectedCourseModal.isEnrolled ? 'Matriculado (Acesso Liberado)' : 'Disponível para Matrícula'}
                  </span>
                </div>
              </div>

              {enrollSuccess ? (
                <div className="p-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-center font-bold text-sm flex items-center justify-center gap-2">
                  <CheckCircle2 className="size-5" />
                  <span>Matrícula ativada com sucesso!</span>
                </div>
              ) : selectedCourseModal.isEnrolled ? (
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      handleSelectActiveCourse(selectedCourseModal);
                      setSelectedCourseModal(null);
                    }}
                    className="flex-1 py-3 px-4 rounded-xl bg-primary text-white font-bold text-sm shadow-md hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
                  >
                    <Play className="size-4 fill-current" />
                    <span>Continuar Assistindo</span>
                  </button>
                  <Link
                    href="/jornada"
                    onClick={() => {
                      handleSelectActiveCourse(selectedCourseModal);
                      setSelectedCourseModal(null);
                    }}
                    className={`py-3 px-4 rounded-xl font-bold text-sm border flex items-center justify-center gap-2 transition-all ${
                      isDark ? 'border-white/10 hover:bg-white/10' : 'border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span>Ver Grade</span>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  <button
                    onClick={() => handleEnrollInCourse(selectedCourseModal)}
                    disabled={enrolling}
                    className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-primary to-accent-purple text-white font-bold text-sm shadow-lg shadow-primary/20 hover:opacity-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Zap className="size-4 fill-current" />
                    <span>{enrolling ? 'Processando Matrícula...' : 'Liberar Acesso / Matricular-se Agora'}</span>
                  </button>
                  <p className="text-[11px] text-center text-slate-500">
                    O acesso a este curso será adicionado ao seu painel de estudos.
                  </p>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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

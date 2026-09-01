'use client';

import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import EvolutionDiary from '@/components/EvolutionDiary';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  CheckCircle2, 
  Circle, 
  Clock, 
  Users as UsersIcon, 
  Play, 
  FileText, 
  X, 
  Calendar, 
  ClipboardList, 
  BookOpen, 
  Lock, 
  ChevronRight, 
  GraduationCap,
  Layers,
  Zap
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Image from 'next/image';
import Link from 'next/link';
import { getDirectDriveLink, getEmbedVideoUrl } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { updateUserGamification } from '@/lib/gamification';
import { useTheme } from '@/lib/ThemeContext';
import BusinessSheetModal from '@/components/BusinessSheetModal';
import { 
  CourseWithAccess, 
  getCoursesWithUserAccess, 
  switchActiveCourse, 
  enrollUser, 
  DEFAULT_JOURNEY_ID 
} from '@/lib/courses';

interface Challenge {
  id: string;
  title: string;
  thumbnail_url: string | null;
  description: string | null;
  media_url: string | null;
  url: string | null;
  created_at: string;
}

interface DiaryEntry {
  id: string;
  content: string;
  mood: string;
  created_at: string;
}

export default function JornadaPage() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  
  // Courses state
  const [allCourses, setAllCourses] = useState<CourseWithAccess[]>([]);
  const [enrolledCourses, setEnrolledCourses] = useState<CourseWithAccess[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>(DEFAULT_JOURNEY_ID);
  const [selectedCourse, setSelectedCourse] = useState<CourseWithAccess | null>(null);

  // Content / Challenges state
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [diaryEntries, setDiaryEntries] = useState<DiaryEntry[]>([]);
  const [completedItems, setCompletedItems] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [challengesLoading, setChallengesLoading] = useState(false);
  const [activeVideo, setActiveVideo] = useState<Challenge | null>(null);
  const [selectedChallengeId, setSelectedChallengeId] = useState<string | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [enrolling, setEnrolling] = useState(false);

  // Load course lessons / challenges
  const loadChallengesForCourse = async (userId: string, course: CourseWithAccess) => {
    setChallengesLoading(true);
    try {
      // 1. Check user progress
      const { data: progress } = await supabase
        .from('lesson_progress')
        .select('lesson_id')
        .eq('user_id', userId)
        .eq('completed', true);
      
      const completedIds = new Set(progress?.map(p => p.lesson_id) || []);
      setCompletedItems(completedIds);

      // 2. Fetch from 'lessons' table for this specific journey_id
      const { data: lessonsData } = await supabase
        .from('lessons')
        .select('*')
        .eq('journey_id', course.id)
        .order('dia', { ascending: true })
        .order('created_at', { ascending: true });

      if (lessonsData && lessonsData.length > 0) {
        const formatted: Challenge[] = lessonsData.map(l => ({
          id: l.id,
          title: l.titulo,
          description: l.descricao,
          thumbnail_url: l.capa_url,
          media_url: l.video_url,
          url: l.video_url,
          created_at: l.created_at || new Date().toISOString()
        }));
        setChallenges(formatted);
        const firstUncompleted = formatted.find(c => !completedIds.has(c.id)) || formatted[0];
        setSelectedChallengeId(firstUncompleted?.id || null);
        setChallengesLoading(false);
        return;
      }

      // 3. Fetch from 'content' table by archetype
      const { data: contentData } = await supabase
        .from('content')
        .select('id, title, thumbnail_url, description, media_url, url, created_at')
        .eq('archetype', course.archetype || 'Jornada')
        .order('created_at', { ascending: true });

      if (contentData && contentData.length > 0) {
        setChallenges(contentData);
        const firstUncompleted = contentData.find(c => !completedIds.has(c.id)) || contentData[0];
        setSelectedChallengeId(firstUncompleted?.id || null);
      } else {
        setChallenges([]);
        setSelectedChallengeId(null);
      }
    } catch (err) {
      console.error('Erro ao carregar desafios do curso:', err);
      setChallenges([]);
    } finally {
      setChallengesLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    async function checkAuthAndFetchData() {
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      if (authError || !authUser) {
        if (isMounted) window.location.href = '/login';
        return;
      }
      if (isMounted) setUser(authUser);

      try {
        // Fetch user profile
        const { data: profileData } = await supabase
          .from('profiles')
          .select('role, level, journey_id')
          .eq('id', authUser.id)
          .single();

        if (isMounted && profileData) {
          setProfile(profileData);
        }

        const storedJourneyId = typeof window !== 'undefined' ? localStorage.getItem('active_journey_id') : null;
        const initialCourseId = storedJourneyId || profileData?.journey_id || DEFAULT_JOURNEY_ID;

        // Fetch all courses with access
        const { allCourses: courses, enrolledCourses: enrolled } = await getCoursesWithUserAccess(authUser.id);
        
        if (isMounted) {
          setAllCourses(courses);
          setEnrolledCourses(enrolled);
          setSelectedCourseId(initialCourseId);

          const current = courses.find(c => c.id === initialCourseId) || enrolled[0] || courses[0];
          setSelectedCourse(current || null);

          if (current && current.isEnrolled) {
            await loadChallengesForCourse(authUser.id, current);
          }
        }

        // Fetch Diary Entries
        const { data: diaryData, error: diaryError } = await supabase
          .from('diary_entries')
          .select('id, content, mood, created_at')
          .eq('user_id', authUser.id)
          .order('created_at', { ascending: false });

        if (isMounted && diaryData && !diaryError) {
          setDiaryEntries(diaryData);
        }
      } catch (err) {
        console.error('Error fetching jornada data:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    checkAuthAndFetchData();

    // Setup realtime subscription for diary entries
    const diarySubscription = supabase
      .channel('public:diary_entries')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'diary_entries' 
      }, (payload) => {
        if (payload.new && payload.new.user_id === user?.id) {
          setDiaryEntries(prev => [payload.new as DiaryEntry, ...prev]);
        }
      })
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(diarySubscription);
    };
  }, [user?.id]);

  const handleSelectCourse = async (course: CourseWithAccess) => {
    if (!user) return;
    setSelectedCourseId(course.id);
    setSelectedCourse(course);
    if (course.isEnrolled) {
      await switchActiveCourse(user.id, course.id);
      await loadChallengesForCourse(user.id, course);
    }
  };

  const handleEnrollInSelected = async () => {
    if (!user || !selectedCourse) return;
    setEnrolling(true);
    const success = await enrollUser(user.id, selectedCourse.id);
    if (success) {
      const { allCourses: courses, enrolledCourses: enrolled } = await getCoursesWithUserAccess(user.id);
      setAllCourses(courses);
      setEnrolledCourses(enrolled);
      const updated = courses.find(c => c.id === selectedCourse.id);
      if (updated) {
        setSelectedCourse(updated);
        await loadChallengesForCourse(user.id, updated);
      }
    }
    setEnrolling(false);
  };

  const handleToggleComplete = async (e: React.MouseEvent, itemId: string) => {
    e.stopPropagation();
    if (!user) return;

    const isCompleted = completedItems.has(itemId);
    const newCompleted = new Set(completedItems);
    
    if (isCompleted) {
      newCompleted.delete(itemId);
    } else {
      newCompleted.add(itemId);
    }
    
    setCompletedItems(newCompleted);

    try {
      if (isCompleted) {
        const { error: deleteError } = await supabase
          .from('lesson_progress')
          .delete()
          .eq('user_id', user.id)
          .eq('lesson_id', itemId);
        
        if (deleteError) throw deleteError;
        await updateUserGamification(user.id, false);
      } else {
        const { error: upsertError } = await supabase
          .from('lesson_progress')
          .upsert({
            user_id: user.id,
            lesson_id: itemId,
            completed: true
          });
        
        if (upsertError) throw upsertError;
        await updateUserGamification(user.id, true);
      }
    } catch (err) {
      console.error('Error toggling completion:', err);
      setCompletedItems(completedItems);
    }
  };

  const isCanvaCourse = selectedCourse?.archetype === 'Jornada' || selectedCourse?.title.toLowerCase().includes('canva');

  if (loading) {
    return (
      <main className={`min-h-screen flex items-center justify-center ${
        isDark ? 'bg-[#000000]' : 'bg-[#f7f6f8]'
      }`}>
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="size-8 border-2 border-primary border-t-transparent rounded-full"
        />
      </main>
    );
  }

  return (
    <main className={`min-h-screen relative pb-24 transition-colors duration-200 ${
      isDark ? 'bg-[#000000] text-slate-100' : 'bg-[#f7f6f8] text-slate-900'
    }`}>
      <Header />
      
      <div className="max-w-5xl mx-auto px-4 py-8">
        
        {/* Course Switcher / Navigation Header */}
        <section className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full bg-primary/20 text-primary text-[10px] font-extrabold uppercase tracking-widest font-mono">
                  JORNADA DE ESTUDOS
                </span>
                <span className="text-xs text-slate-500">•</span>
                <span className="text-xs font-bold text-slate-400">
                  {selectedCourse?.title || 'Curso Selecionado'}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight">
                Módulos & Desafios Práticos
              </h1>
            </div>

            {/* Quick Link to Home */}
            <Link 
              href="/" 
              className="text-xs font-bold text-primary hover:underline flex items-center gap-1 shrink-0"
            >
              <span>Voltar ao Painel Geral</span>
              <ChevronRight className="size-4" />
            </Link>
          </div>

          {/* Course Tabs (Enrolled & Available) */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {allCourses.map((c) => {
              const isSelected = c.id === selectedCourseId;
              return (
                <button
                  key={c.id}
                  onClick={() => handleSelectCourse(c)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all shrink-0 border cursor-pointer ${
                    isSelected
                      ? 'bg-primary text-white border-primary shadow-md shadow-primary/20'
                      : isDark
                        ? 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100 shadow-sm'
                  }`}
                >
                  {c.isEnrolled ? (
                    <BookOpen className="size-3.5" />
                  ) : (
                    <Lock className="size-3.5 text-amber-400" />
                  )}
                  <span className="truncate max-w-[200px]">{c.title}</span>
                  {c.isEnrolled && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-black/10 dark:bg-white/10 text-slate-400'
                    }`}>
                      {c.progressPercent}%
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* ACCESS LOCKED GUARD FOR NON-ENROLLED COURSE */}
        {selectedCourse && !selectedCourse.isEnrolled ? (
          <div className={`p-8 sm:p-12 rounded-3xl border text-center max-w-2xl mx-auto my-8 ${
            isDark ? 'bg-[#0f0b15] border-white/10' : 'bg-white border-slate-200 shadow-lg'
          }`}>
            <div className="size-16 rounded-3xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-5">
              <Lock className="size-8" />
            </div>

            <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-extrabold uppercase tracking-widest">
              CURSO BLOQUEADO
            </span>

            <h2 className="text-2xl font-bold font-display mt-3 mb-3">
              Você ainda não está matriculado em &quot;{selectedCourse.title}&quot;
            </h2>

            <p className={`text-sm leading-relaxed mb-6 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              {selectedCourse.description || 'Este curso possui módulos práticos, desafios passo a passo e materiais exclusivos. Matricule-se para desbloquear todas as aulas imediatamente na sua conta.'}
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={handleEnrollInSelected}
                disabled={enrolling}
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-gradient-to-r from-primary to-accent-purple text-white font-bold text-sm shadow-lg shadow-primary/20 hover:opacity-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Zap className="size-4 fill-current" />
                <span>{enrolling ? 'Processando Matrícula...' : 'Liberar Acesso / Matricular-se'}</span>
              </button>

              {enrolledCourses.length > 0 && (
                <button
                  onClick={() => handleSelectCourse(enrolledCourses[0])}
                  className={`w-full sm:w-auto px-6 py-3.5 rounded-xl font-bold text-sm border ${
                    isDark ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Voltar para Meu Curso Ativo
                </button>
              )}
            </div>
          </div>
        ) : challengesLoading ? (
          <div className="py-20 flex flex-col items-center justify-center text-center">
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
              className="size-8 border-2 border-primary border-t-transparent rounded-full mb-3"
            />
            <p className="text-xs text-slate-500">Carregando aulas do curso...</p>
          </div>
        ) : challenges.length === 0 ? (
          <div className={`p-12 rounded-3xl border text-center ${
            isDark ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'
          }`}>
            <Sparkles className="size-10 text-slate-500 mx-auto mb-3" />
            <h3 className="text-lg font-bold mb-1">Nenhuma aula cadastrada para este curso ainda</h3>
            <p className="text-xs text-slate-500">
              O administrador está preparando as aulas deste módulo. Volte em breve!
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            
            {/* Quick Ficha do Negócio Banner if Canva Course */}
            {isCanvaCourse && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-4 sm:p-5 rounded-3xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm ${
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
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-extrabold uppercase tracking-widest text-primary font-mono">
                        CANVA COM IA 2.0 · MATERIAL PRÁTICO
                      </span>
                    </div>
                    <h3 className="text-base font-bold font-display tracking-tight">
                      Ficha do Negócio (Exercício Módulo 1)
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Consulte os dados da sua marca para preencher nos prompts e exercícios das aulas.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => setIsSheetOpen(true)}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-primary/20 transition-all cursor-pointer"
                  >
                    <ClipboardList className="size-4" />
                    <span>Abrir Ficha do Negócio</span>
                  </button>
                </div>
              </motion.div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Main Content Column */}
              <div className="lg:col-span-8 space-y-12">
                {/* Featured Challenge of the Day */}
                {challenges.length > 0 && (
                  <div className="space-y-6">
                    <h2 className="text-xs font-bold text-primary uppercase tracking-widest mb-4 flex items-center gap-2">
                      <Sparkles className="size-4" />
                      Aula em Destaque
                    </h2>
                    {(() => {
                      const currentChallenge = challenges.find(c => c.id === selectedChallengeId) || challenges[0];
                      
                      return (
                        <motion.div
                          key={currentChallenge.id}
                          initial={{ y: 20, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          className={`group relative border rounded-3xl overflow-hidden transition-all ${
                            completedItems.has(currentChallenge.id) 
                              ? 'border-emerald-500/30 bg-emerald-500/5' 
                              : isDark ? 'bg-white/5 border-white/10 hover:border-primary/50' : 'bg-white border-slate-200 shadow-md hover:border-primary/50'
                          }`}
                        >
                          <div className="relative h-64 sm:h-80 w-full">
                            <Image 
                              src={getDirectDriveLink(currentChallenge.thumbnail_url) || `https://picsum.photos/seed/${currentChallenge.id}/800/600`}
                              alt={currentChallenge.title}
                              fill
                              className="object-cover opacity-80 group-hover:scale-105 transition-transform duration-500"
                              referrerPolicy="no-referrer"
                              unoptimized
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                            
                            {currentChallenge.media_url && (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <button 
                                  onClick={() => setActiveVideo(currentChallenge)}
                                  className={`size-20 rounded-full flex items-center justify-center shadow-2xl transform transition-transform cursor-pointer group-hover:scale-110 ${
                                    completedItems.has(currentChallenge.id) ? 'bg-emerald-500' : 'bg-primary'
                                  }`}
                                >
                                  {completedItems.has(currentChallenge.id) ? (
                                    <CheckCircle2 className="size-10 text-white" />
                                  ) : (
                                    <Play className="size-10 fill-current ml-1 text-white" />
                                  )}
                                </button>
                              </div>
                            )}
                          </div>

                          <div className="p-8">
                            <div className="flex items-center justify-between gap-3 mb-3">
                              <div className="flex items-center gap-2">
                                <span className="px-3 py-1 rounded-full bg-primary/20 text-primary text-[10px] font-bold uppercase tracking-widest">
                                  {selectedCourse?.title || 'Módulo'}
                                </span>
                                {completedItems.has(currentChallenge.id) && (
                                  <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-500 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1">
                                    <CheckCircle2 className="size-3" />
                                    Concluído
                                  </span>
                                )}
                              </div>

                              <button
                                onClick={(e) => handleToggleComplete(e, currentChallenge.id)}
                                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                                  completedItems.has(currentChallenge.id)
                                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                                    : isDark
                                      ? 'bg-white/10 border-white/10 text-slate-300 hover:bg-white/20'
                                      : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                                }`}
                              >
                                <CheckCircle2 className="size-3.5" />
                                <span>{completedItems.has(currentChallenge.id) ? 'Concluída' : 'Marcar como Concluída'}</span>
                              </button>
                            </div>

                            <h3 className={`text-2xl sm:text-3xl font-bold mb-3 font-display ${
                              isDark ? 'text-slate-100' : 'text-slate-900'
                            }`}>
                              {currentChallenge.title}
                            </h3>
                            <p className={`text-sm leading-relaxed ${
                              isDark ? 'text-slate-400' : 'text-slate-600'
                            }`}>
                              {currentChallenge.description}
                            </p>
                          </div>
                        </motion.div>
                      );
                    })()}
                  </div>
                )}

                {/* Other Lessons of this Course */}
                {(() => {
                  const currentChallenge = challenges.find(c => c.id === selectedChallengeId) || challenges[0];
                  const otherChallenges = challenges.filter(c => c.id !== currentChallenge?.id);
                  
                  if (otherChallenges.length === 0) return null;

                  return (
                    <div className={`space-y-6 pt-12 border-t ${isDark ? 'border-white/5' : 'border-slate-200'}`}>
                      <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">
                        Outras Aulas deste Curso ({challenges.length} aulas no total)
                      </h2>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        {otherChallenges.map((challenge, index) => {
                          const isDone = completedItems.has(challenge.id);
                          return (
                            <motion.div
                              key={challenge.id}
                              initial={{ y: 20, opacity: 0 }}
                              whileInView={{ y: 0, opacity: 1 }}
                              viewport={{ once: true }}
                              transition={{ delay: index * 0.05 }}
                              onClick={() => setSelectedChallengeId(challenge.id)}
                              className={`group relative border rounded-3xl overflow-hidden transition-all cursor-pointer ${
                                isDone 
                                  ? 'border-emerald-500/30 bg-emerald-500/5' 
                                  : isDark ? 'bg-white/5 border-white/10 hover:border-primary/50' : 'bg-white border-slate-200 shadow-sm hover:shadow-md hover:border-primary/50'
                              }`}
                            >
                              <div className="relative h-44 w-full">
                                <Image 
                                  src={getDirectDriveLink(challenge.thumbnail_url) || `https://picsum.photos/seed/${challenge.id}/600/400`}
                                  alt={challenge.title}
                                  fill
                                  className="object-cover opacity-80 group-hover:scale-105 transition-transform duration-500"
                                  referrerPolicy="no-referrer"
                                  unoptimized
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                                
                                {challenge.media_url && (
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveVideo(challenge);
                                      }}
                                      className={`size-12 rounded-full flex items-center justify-center shadow-xl transform transition-transform cursor-pointer group-hover:scale-110 ${
                                        isDone ? 'bg-emerald-500' : 'bg-primary'
                                      }`}
                                    >
                                      {isDone ? (
                                        <CheckCircle2 className="size-6 text-white" />
                                      ) : (
                                        <Play className="size-6 fill-current ml-0.5 text-white" />
                                      )}
                                    </button>
                                  </div>
                                )}
                              </div>

                              <div className="p-5">
                                <div className="flex items-center justify-between gap-2 mb-2">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase">
                                    Aula {index + 2}
                                  </span>
                                  {isDone && (
                                    <span className="text-[10px] font-bold text-emerald-500 flex items-center gap-1">
                                      <CheckCircle2 className="size-3" />
                                      Concluída
                                    </span>
                                  )}
                                </div>
                                <h4 className={`text-base font-bold mb-1.5 font-display line-clamp-2 ${
                                  isDark ? 'text-slate-100' : 'text-slate-900'
                                }`}>
                                  {challenge.title}
                                </h4>
                                <p className={`text-xs line-clamp-2 ${
                                  isDark ? 'text-slate-400' : 'text-slate-600'
                                }`}>
                                  {challenge.description}
                                </p>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
              
              {/* Sidebar Column on Desktop */}
              <div className="lg:col-span-4 space-y-6">
                <div className="sticky top-24 space-y-6">
                  <EvolutionDiary />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Floating Consultation Quick Button for Canva Course */}
      {isCanvaCourse && (
        <motion.button
          onClick={() => setIsSheetOpen(true)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="fixed bottom-24 right-4 z-40 px-4 py-3 rounded-full bg-primary hover:bg-primary/90 text-white font-bold text-xs flex items-center gap-2 shadow-2xl shadow-primary/50 border border-white/20 backdrop-blur-md cursor-pointer"
          title="Consultar A Ficha do Meu Negócio"
        >
          <ClipboardList className="size-4" />
          <span className="hidden sm:inline">Ficha do Negócio</span>
          <span className="sm:hidden">Ficha</span>
        </motion.button>
      )}
      
      <BottomNav />

      {/* Business Sheet Modal */}
      <BusinessSheetModal 
        isOpen={isSheetOpen} 
        onClose={() => setIsSheetOpen(false)} 
      />

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
              className="relative w-full max-w-4xl aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl select-none"
              data-protected-video="true"
              onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onClick={(e) => e.stopPropagation()}
            >
              <iframe
                src={getEmbedVideoUrl(activeVideo.media_url || activeVideo.url) || ''}
                className="w-full h-full border-0 select-none"
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

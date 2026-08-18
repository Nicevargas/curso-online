'use client';

import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import EvolutionDiary from '@/components/EvolutionDiary';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, CheckCircle2, Circle, Clock, Users as UsersIcon, Play, FileText, X, Calendar } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Image from 'next/image';
import Link from 'next/link';
import { getDirectDriveLink, getEmbedVideoUrl } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { updateUserGamification } from '@/lib/gamification';

interface Journey {
  id: string;
  title: string;
  steps: number;
  duration: string;
  participants: number;
  archetype: string;
  image_url: string | null;
}

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
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [diaryEntries, setDiaryEntries] = useState<DiaryEntry[]>([]);
  const [completedItems, setCompletedItems] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [activeVideo, setActiveVideo] = useState<Challenge | null>(null);
  const [user, setUser] = useState<any>(null);
  const [selectedChallengeId, setSelectedChallengeId] = useState<string | null>(null);

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
        // Fetch user profile to get role, level and journey_id
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, level, journey_id')
          .eq('id', authUser.id)
          .single();

        const journeyId = profile?.journey_id || 'fa512a52-9742-410f-a71b-0bd4013bec8d';

        // Fetch journey details to get archetype
        const { data: journeyData } = await supabase
          .from('journeys')
          .select('archetype')
          .eq('id', journeyId)
          .single();

        const archetype = journeyData?.archetype || 'Jornada';

        // Fetch Challenges from content table where archetype matches journey's archetype
        const { data: challengesData, error: challengesError } = await supabase
          .from('content')
          .select('id, title, thumbnail_url, description, media_url, url, created_at')
          .eq('archetype', archetype)
          .order('created_at', { ascending: true });

        if (isMounted && challengesData && !challengesError) {
          setChallenges(challengesData);
          
          // Set initial selected challenge to the first uncompleted one
          const { data: progress } = await supabase
            .from('lesson_progress')
            .select('lesson_id')
            .eq('user_id', authUser.id)
            .eq('completed', true);
          
          const completedIds = new Set(progress?.map(p => p.lesson_id) || []);
          const firstUncompleted = challengesData.find(c => !completedIds.has(c.id)) || challengesData[0];
          if (firstUncompleted) {
            setSelectedChallengeId(firstUncompleted.id);
          }
        }

        // Fetch progress
        const { data: progressData } = await supabase
          .from('lesson_progress')
          .select('lesson_id')
          .eq('user_id', authUser.id)
          .eq('completed', true);
        
        if (isMounted && progressData) {
          setCompletedItems(new Set(progressData.map(p => p.lesson_id)));
        }

        // Fetch diary entries
        const { data: entries, error: entriesError } = await supabase
          .from('diary_entries')
          .select('*')
          .eq('user_id', authUser.id)
          .order('created_at', { ascending: false })
          .limit(50);

        if (isMounted && entries && !entriesError) {
          setDiaryEntries(entries);
        }
      } catch (err) {
        console.error('Error fetching data:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    checkAuthAndFetchData();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        window.location.href = '/login';
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const toggleItemCompletion = async (itemId: string, e: React.MouseEvent) => {
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
        
        // Remove pontos
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
        
        // Adiciona pontos e atualiza sequência
        await updateUserGamification(user.id, true);
      }
    } catch (err) {
      console.error('Error toggling completion:', err);
      setCompletedItems(completedItems);
    }
  };

  const isUnlocked = (index: number) => {
    return true; // All challenges are unlocked per user request to remove check-in system
  };

  const groupDiaryByDay = () => {
    const groups: Record<string, DiaryEntry[]> = {};
    diaryEntries.forEach(entry => {
      const date = format(new Date(entry.created_at), 'yyyy-MM-dd');
      if (!groups[date]) groups[date] = [];
      groups[date].push(entry);
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
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

  return (
    <main className="min-h-screen bg-background-dark relative pb-24">
      <Header />
      
      <div className="max-w-5xl mx-auto px-4 py-8">
        {challenges.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-slate-500 italic">Nenhuma jornada ou desafio encontrado no momento.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Main Content Column */}
            <div className="lg:col-span-8 space-y-12">
              {/* Featured Journey of the Day */}
              {challenges.length > 0 && (
                <div className="space-y-6">
                  <h2 className="text-xs font-bold text-primary uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Sparkles className="size-4" />
                    Jornada do Dia
                  </h2>
                  {(() => {
                    const currentChallenge = challenges.find(c => c.id === selectedChallengeId) || challenges[0];
                    const index = challenges.findIndex(c => c.id === currentChallenge.id);
                    const unlocked = isUnlocked(index);
                    
                    return (
                      <motion.div
                        key={currentChallenge.id}
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        className={`group relative bg-white/5 border rounded-3xl overflow-hidden transition-all ${
                          completedItems.has(currentChallenge.id) 
                            ? 'border-emerald-500/30 bg-emerald-500/5' 
                            : unlocked 
                              ? 'border-white/10 hover:border-primary/50'
                              : 'border-white/5 opacity-50 grayscale'
                        }`}
                      >
                        <div className="relative h-64 sm:h-80 w-full">
                          <Image 
                            src={getDirectDriveLink(currentChallenge.thumbnail_url) || `https://picsum.photos/seed/${currentChallenge.id}/800/600`}
                            alt={currentChallenge.title}
                            fill
                            className="object-cover opacity-60 group-hover:scale-105 transition-transform duration-500"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-background-dark via-transparent to-transparent" />
                          
                          {currentChallenge.media_url && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <button 
                                onClick={() => unlocked && setActiveVideo(currentChallenge)}
                                disabled={!unlocked}
                                className={`size-20 rounded-full flex items-center justify-center shadow-2xl transform transition-transform ${
                                  !unlocked 
                                    ? 'bg-slate-800 cursor-not-allowed' 
                                    : 'group-hover:scale-110 ' + (completedItems.has(currentChallenge.id) ? 'bg-emerald-500' : 'bg-primary')
                                }`}
                              >
                                {completedItems.has(currentChallenge.id) ? (
                                  <CheckCircle2 className="size-10 text-white" />
                                ) : unlocked ? (
                                  <Play className="size-10 fill-current ml-1 text-white" />
                                ) : (
                                  <Clock className="size-10 text-slate-500" />
                                )}
                              </button>
                            </div>
                          )}

                          {/* Check-in button removed per user request */}
                        </div>

                        <div className="p-8">
                          <div className="flex items-center gap-3 mb-3">
                            <span className="px-3 py-1 rounded-full bg-primary/20 text-primary text-[10px] font-bold uppercase tracking-widest">
                              Em Andamento
                            </span>
                            {completedItems.has(currentChallenge.id) && (
                              <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-500 text-[10px] font-bold uppercase tracking-widest">
                                Concluído
                              </span>
                            )}
                          </div>
                          <h3 className="text-3xl font-bold text-slate-100 mb-3 font-display">{currentChallenge.title}</h3>
                          <p className="text-base text-slate-400 leading-relaxed">
                            {currentChallenge.description}
                          </p>
                        </div>
                      </motion.div>
                    )
                  })()}
                </div>
              )}

              {/* Challenges Section */}
              {(() => {
                const currentChallenge = challenges.find(c => c.id === selectedChallengeId) || challenges[0];
                const otherChallenges = challenges.filter(c => c.id !== currentChallenge?.id);
                
                if (otherChallenges.length === 0) return null;

                return (
                  <div className="space-y-6 pt-12 border-t border-white/5">
                    <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Próximos Passos</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      {otherChallenges.map((challenge, index) => {
                        const originalIndex = challenges.findIndex(c => c.id === challenge.id);
                        const unlocked = isUnlocked(originalIndex);
                        return (
                          <motion.div
                            key={challenge.id}
                            initial={{ y: 20, opacity: 0 }}
                            whileInView={{ y: 0, opacity: 1 }}
                            viewport={{ once: true }}
                            transition={{ delay: index * 0.1 }}
                            onClick={() => unlocked && setSelectedChallengeId(challenge.id)}
                            className={`group relative bg-white/5 border rounded-3xl overflow-hidden transition-all cursor-pointer ${
                              completedItems.has(challenge.id) 
                                ? 'border-emerald-500/30 bg-emerald-500/5' 
                                : unlocked 
                                  ? 'border-white/10 hover:border-primary/50'
                                  : 'border-white/5 opacity-50 grayscale cursor-not-allowed'
                            }`}
                          >
                            <div className="relative h-48 w-full">
                              <Image 
                                src={getDirectDriveLink(challenge.thumbnail_url) || `https://picsum.photos/seed/${challenge.id}/600/400`}
                                alt={challenge.title}
                                fill
                                className="object-cover opacity-60 group-hover:scale-105 transition-transform duration-500"
                                referrerPolicy="no-referrer"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-background-dark via-transparent to-transparent" />
                              
                              {challenge.media_url && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      unlocked && setActiveVideo(challenge);
                                    }}
                                    disabled={!unlocked}
                                    className={`size-14 rounded-full flex items-center justify-center shadow-2xl transform transition-transform ${
                                      !unlocked 
                                        ? 'bg-slate-800 cursor-not-allowed' 
                                        : 'group-hover:scale-110 ' + (completedItems.has(challenge.id) ? 'bg-emerald-500' : 'bg-primary')
                                    }`}
                                  >
                                    {completedItems.has(challenge.id) ? (
                                      <CheckCircle2 className="size-6 text-white" />
                                    ) : unlocked ? (
                                      <Play className="size-6 fill-current ml-1 text-white" />
                                    ) : (
                                      <Clock className="size-6 text-slate-500" />
                                    )}
                                  </button>
                                </div>
                              )}

                              {/* Check-in button removed per user request */}

                              {!unlocked && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
                                  <div className="flex flex-col items-center gap-2">
                                    <Clock className="size-8 text-white/40" />
                                    <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Bloqueado</span>
                                  </div>
                                </div>
                              )}
                            </div>

                            <div className="p-5">
                              <div className="flex items-center gap-2 mb-2">
                                <h3 className={`text-xl font-bold font-display ${
                                  completedItems.has(challenge.id) ? 'text-slate-300' : unlocked ? 'text-slate-100' : 'text-slate-500'
                                }`}>{challenge.title}</h3>
                                {completedItems.has(challenge.id) && (
                                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-500 text-[8px] font-bold uppercase tracking-widest">
                                    Concluído
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-slate-400 mb-4 line-clamp-2 leading-relaxed">
                                {challenge.description}
                              </p>

                              {challenge.url && unlocked && (
                                <div className="pt-4 border-t border-white/5">
                                  <a 
                                    href={challenge.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-flex items-center gap-2 text-xs font-bold text-primary hover:text-primary/80 transition-colors uppercase tracking-widest"
                                  >
                                    <FileText className="size-4" />
                                    Material de Apoio
                                  </a>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}
            </div>

            {/* Sidebar Column */}
            <div className="lg:col-span-4 space-y-8">
              <div className="sticky top-24 space-y-8">
                {/* Evolution Diary Section */}
                <div className="space-y-8">
                  <EvolutionDiary />
                  
                  {diaryEntries.length > 0 && (
                    <div className="mt-8">
                      <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                        <Calendar className="size-4" />
                        Resumo de Experiências
                      </h2>
                      <div className="space-y-6">
                        {groupDiaryByDay().map(([date, entries]) => (
                          <motion.div 
                            key={date}
                            initial={{ opacity: 0, y: 10 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            className="relative pl-6 border-l border-primary/20"
                          >
                            <div className="absolute left-[-5px] top-0 size-2.5 rounded-full bg-primary shadow-[0_0_10px_rgba(var(--primary-rgb),0.5)]" />
                            <h3 className="text-[10px] font-bold text-primary uppercase tracking-widest mb-3">
                              {format(new Date(date + 'T12:00:00'), "dd 'de' MMMM", { locale: ptBR })}
                            </h3>
                            <div className="space-y-3">
                              {entries.map((entry) => (
                                <div key={entry.id} className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                                  <p className="text-sm text-slate-300 leading-relaxed italic">
                                    &quot;{entry.content}&quot;
                                  </p>
                                  <div className="mt-2 flex items-center gap-2">
                                    <span className="text-[10px] text-slate-500">
                                      {format(new Date(entry.created_at), 'HH:mm')}
                                    </span>
                                    {entry.mood && (
                                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                                        {entry.mood}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
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
              className="relative w-full max-w-4xl bg-[#1a1225] rounded-3xl overflow-hidden shadow-2xl border border-white/10 flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="aspect-video w-full bg-black">
                <iframe
                  src={getEmbedVideoUrl(activeVideo.media_url!) || ''}
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>

              {activeVideo.url && (
                <div className="p-6 bg-white/5 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex flex-col gap-1 text-center sm:text-left">
                    <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Material Complementar</span>
                    <h4 className="text-base font-bold text-slate-100 font-display">{activeVideo.title}</h4>
                  </div>
                  <a 
                    href={activeVideo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full sm:w-auto flex items-center justify-center gap-2 bg-primary text-white px-8 py-4 rounded-2xl text-xs font-bold uppercase tracking-widest hover:bg-primary/80 transition-all shadow-xl shadow-primary/20"
                  >
                    <FileText className="size-4" />
                    Acessar Material de Apoio
                  </a>
                </div>
              )}

              <button
                onClick={() => setActiveVideo(null)}
                className="absolute top-4 right-4 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors z-10"
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

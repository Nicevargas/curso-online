'use client';

import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { motion, AnimatePresence } from 'motion/react';
import { Users, Star, MessageCircle, Send, Trash2, BookOpen } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Image from 'next/image';
import { getDirectDriveLink } from '@/lib/utils';
import { useTheme } from '@/lib/ThemeContext';
import { getCoursesWithUserAccess, type CourseWithAccess } from '@/lib/courses';

interface Profile {
  name: string;
  avatar_url: string | null;
}

interface Member {
  id: string;
  name: string;
  avatar_url: string | null;
  role: string;
  level: number;
  interaction_count: number;
}

interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile: Profile;
}

interface Post {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  journey_id: string | null;
  profile: Profile;
  likes_count: number;
  user_has_liked: boolean;
  comments: Comment[];
}

const FALLBACK_PROFILE: Profile = { name: 'Aluno Canva IA', avatar_url: null };

function avatarSrc(p: Profile | undefined) {
  const name = p?.name || 'A';
  return (
    getDirectDriveLink(p?.avatar_url) ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=7311d4&color=fff`
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ComunidadePage() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [courses, setCourses] = useState<CourseWithAccess[]>([]);
  const [activeJourneyId, setActiveJourneyId] = useState<string | null>(null);

  const [posts, setPosts] = useState<Post[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [newPost, setNewPost] = useState('');
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});

  const [loading, setLoading] = useState(true);
  const [feedLoading, setFeedLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);

  const activeCourse = useMemo(
    () => courses.find((c) => c.id === activeJourneyId) || null,
    [courses, activeJourneyId]
  );

  // ---------- Carregamento do feed da jornada ativa ----------
  const fetchFeed = useCallback(
    async (journeyId: string, user: any) => {
      setFeedLoading(true);
      try {
        // 1. Posts da jornada + curtidas
        const { data: postsData, error: postsError } = await supabase
          .from('community_posts')
          .select('id, content, created_at, user_id, journey_id, post_interactions (user_id)')
          .eq('journey_id', journeyId)
          .order('created_at', { ascending: false })
          .limit(100);

        if (postsError) throw postsError;

        const postIds = (postsData || []).map((p: any) => p.id);

        // 2. Comentários desses posts
        let commentsData: any[] = [];
        if (postIds.length > 0) {
          const { data, error } = await supabase
            .from('post_comments')
            .select('id, post_id, user_id, content, created_at')
            .in('post_id', postIds)
            .order('created_at', { ascending: true });
          if (error) {
            console.warn('Não foi possível carregar comentários:', error);
          } else {
            commentsData = data || [];
          }
        }

        // 3. Perfis de autores (posts + comentários) em uma consulta
        const authorIds = Array.from(
          new Set([
            ...(postsData || []).map((p: any) => p.user_id),
            ...commentsData.map((c) => c.user_id),
          ].filter(Boolean))
        );
        const profilesById: Record<string, Profile> = {};
        if (authorIds.length > 0) {
          const { data: profilesData, error: profilesError } = await supabase
            .from('profiles')
            .select('id, name, avatar_url')
            .in('id', authorIds);
          if (profilesError) console.warn('Não foi possível carregar perfis:', profilesError);
          (profilesData || []).forEach((pr: any) => {
            profilesById[pr.id] = { name: pr.name, avatar_url: pr.avatar_url };
          });
        }

        const commentsByPost: Record<string, Comment[]> = {};
        commentsData.forEach((c) => {
          (commentsByPost[c.post_id] ||= []).push({
            ...c,
            profile: profilesById[c.user_id] || FALLBACK_PROFILE,
          });
        });

        const formatted: Post[] = (postsData || []).map((post: any) => ({
          id: post.id,
          content: post.content,
          created_at: post.created_at,
          user_id: post.user_id,
          journey_id: post.journey_id,
          profile: profilesById[post.user_id] || FALLBACK_PROFILE,
          likes_count: post.post_interactions?.length || 0,
          user_has_liked:
            post.post_interactions?.some((i: any) => i.user_id === user?.id) || false,
          comments: commentsByPost[post.id] || [],
        }));

        setPosts(formatted);
        setFeedError(null);

        // 4. Membros em destaque desta jornada (quem postou/comentou/curtiu)
        const activity: Record<string, number> = {};
        (postsData || []).forEach((p: any) => {
          activity[p.user_id] = (activity[p.user_id] || 0) + 1;
          (p.post_interactions || []).forEach((i: any) => {
            activity[i.user_id] = (activity[i.user_id] || 0) + 1;
          });
        });
        commentsData.forEach((c) => {
          activity[c.user_id] = (activity[c.user_id] || 0) + 1;
        });
        const memberIds = Object.keys(activity);
        if (memberIds.length > 0) {
          const { data: memberProfiles } = await supabase
            .from('profiles')
            .select('id, name, avatar_url, role, level')
            .in('id', memberIds);
          const sorted = (memberProfiles || [])
            .map((m: any) => ({ ...m, level: m.level || 1, interaction_count: activity[m.id] || 0 }))
            .sort((a, b) => b.interaction_count - a.interaction_count)
            .slice(0, 10);
          setMembers(sorted);
        } else {
          setMembers([]);
        }
      } catch (err: any) {
        console.error('Erro ao carregar a comunidade:', err);
        setFeedError(`Não foi possível carregar as mensagens: ${err?.message || 'erro desconhecido'}`);
      } finally {
        setFeedLoading(false);
      }
    },
    []
  );

  // ---------- Inicialização: usuário + jornadas em que participa ----------
  useEffect(() => {
    let isMounted = true;

    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = '/login';
        return;
      }
      if (!isMounted) return;
      setCurrentUser(user);

      const { enrolledCourses, activeCourseId } = await getCoursesWithUserAccess(user.id);
      if (!isMounted) return;
      setCourses(enrolledCourses);

      const initial =
        enrolledCourses.find((c) => c.id === activeCourseId)?.id ||
        enrolledCourses[0]?.id ||
        null;
      setActiveJourneyId(initial);
      setLoading(false);
    }

    init();
    return () => {
      isMounted = false;
    };
  }, []);

  // ---------- Feed + tempo real da jornada ativa ----------
  useEffect(() => {
    if (!activeJourneyId || !currentUser) return;

    fetchFeed(activeJourneyId, currentUser);

    const channel = supabase
      .channel(`community:${activeJourneyId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'community_posts', filter: `journey_id=eq.${activeJourneyId}` },
        () => fetchFeed(activeJourneyId, currentUser)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'post_comments' },
        () => fetchFeed(activeJourneyId, currentUser)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'post_interactions' },
        () => fetchFeed(activeJourneyId, currentUser)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeJourneyId, currentUser, fetchFeed]);

  // ---------- Ações ----------
  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPost.trim() || !currentUser || !activeJourneyId || posting) return;

    setPosting(true);
    try {
      const { error } = await supabase.from('community_posts').insert({
        user_id: currentUser.id,
        journey_id: activeJourneyId,
        content: newPost.trim(),
      });
      if (error) throw error;
      setNewPost('');
      await fetchFeed(activeJourneyId, currentUser);
    } catch (err: any) {
      console.error('Erro ao publicar:', err);
      setFeedError(`Erro ao publicar: ${err?.message || 'tente novamente.'}`);
    } finally {
      setPosting(false);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!currentUser || !activeJourneyId) return;
    if (!window.confirm('Excluir esta publicação?')) return;
    const { error } = await supabase.from('community_posts').delete().eq('id', postId);
    if (error) {
      setFeedError(`Erro ao excluir: ${error.message}`);
      return;
    }
    await fetchFeed(activeJourneyId, currentUser);
  };

  const handleLike = async (postId: string, currentLiked: boolean) => {
    if (!currentUser || !activeJourneyId) return;
    try {
      if (currentLiked) {
        const { error } = await supabase
          .from('post_interactions')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', currentUser.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('post_interactions')
          .insert({ post_id: postId, user_id: currentUser.id });
        if (error) throw error;
      }
      await fetchFeed(activeJourneyId, currentUser);
    } catch (err: any) {
      console.error('Erro ao curtir:', err);
      setFeedError(`Erro ao curtir: ${err?.message || 'tente novamente.'}`);
    }
  };

  const handleAddComment = async (postId: string) => {
    const text = (commentDrafts[postId] || '').trim();
    if (!text || !currentUser || !activeJourneyId) return;
    try {
      const { error } = await supabase
        .from('post_comments')
        .insert({ post_id: postId, user_id: currentUser.id, content: text });
      if (error) throw error;
      setCommentDrafts((d) => ({ ...d, [postId]: '' }));
      setOpenComments((o) => ({ ...o, [postId]: true }));
      await fetchFeed(activeJourneyId, currentUser);
    } catch (err: any) {
      console.error('Erro ao comentar:', err);
      setFeedError(`Erro ao comentar: ${err?.message || 'tente novamente.'}`);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!currentUser || !activeJourneyId) return;
    const { error } = await supabase.from('post_comments').delete().eq('id', commentId);
    if (error) {
      setFeedError(`Erro ao excluir comentário: ${error.message}`);
      return;
    }
    await fetchFeed(activeJourneyId, currentUser);
  };

  // ---------- UI ----------
  const card = isDark ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200 shadow-sm';
  const textMain = isDark ? 'text-slate-100' : 'text-slate-900';
  const textSoft = isDark ? 'text-slate-400' : 'text-slate-600';

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

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className={`text-3xl font-bold font-display tracking-tight ${textMain}`}>
            Mentoria & Comunidade
          </h1>
          <p className={`text-sm mt-1 ${textSoft}`}>
            Converse com quem está na mesma jornada que você: projetos, dúvidas e feedback de artes no Canva.
          </p>
        </div>

        {/* Seletor de jornada/curso */}
        {courses.length === 0 ? (
          <div className={`p-8 text-center rounded-3xl border border-dashed ${card}`}>
            <BookOpen className="size-10 text-slate-400 mx-auto mb-3" />
            <p className="text-sm text-slate-500">
              Você ainda não participa de nenhuma jornada. Matricule-se em um curso para entrar na comunidade dele.
            </p>
          </div>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-2 mb-6 -mx-1 px-1">
            {courses.map((c) => {
              const active = c.id === activeJourneyId;
              return (
                <button
                  key={c.id}
                  onClick={() => setActiveJourneyId(c.id)}
                  className={`shrink-0 px-4 py-2 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                    active
                      ? 'bg-primary text-white border-primary shadow-md shadow-primary/20'
                      : isDark
                        ? 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {c.title}
                </button>
              );
            })}
          </div>
        )}

        {activeCourse && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Feed */}
            <div className="lg:col-span-8 space-y-6">
              <form onSubmit={handleCreatePost} className={`p-5 rounded-3xl border ${card}`}>
                <p className={`text-[10px] uppercase tracking-widest font-bold mb-2 ${textSoft}`}>
                  Publicando em: {activeCourse.title}
                </p>
                <textarea
                  value={newPost}
                  onChange={(e) => setNewPost(e.target.value)}
                  placeholder="Compartilhe seu projeto, dúvida ou evolução com a turma..."
                  className={`w-full min-h-[100px] bg-transparent border-0 resize-none outline-none text-sm placeholder:text-slate-400 ${textMain}`}
                />
                <div className={`flex items-center justify-between pt-3 border-t ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
                  <span className="text-[10px] text-slate-400">Respeite as diretrizes da comunidade</span>
                  <button
                    type="submit"
                    disabled={posting || !newPost.trim()}
                    className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white font-semibold text-xs tracking-wider uppercase transition-all shadow-md shadow-primary/20 disabled:opacity-50 cursor-pointer"
                  >
                    {posting ? 'Publicando...' : 'Publicar'}
                  </button>
                </div>
              </form>

              {feedError && (
                <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  {feedError}
                </div>
              )}

              <div className="space-y-4">
                {feedLoading && posts.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-8">Carregando conversas...</p>
                ) : posts.length === 0 ? (
                  <div className={`p-12 text-center rounded-3xl border border-dashed ${card}`}>
                    <MessageCircle className="size-10 text-slate-400 mx-auto mb-3" />
                    <p className="text-sm text-slate-500">
                      Ninguém publicou ainda em {activeCourse.title}. Seja a primeira pessoa a começar a conversa!
                    </p>
                  </div>
                ) : (
                  posts.map((post) => {
                    const isOwner = post.user_id === currentUser?.id;
                    const showComments = openComments[post.id] ?? post.comments.length > 0;
                    return (
                      <motion.div
                        key={post.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`p-6 rounded-3xl border ${card}`}
                      >
                        <div className="flex items-start justify-between gap-3 mb-4">
                          <div className="flex items-center gap-3">
                            <div className="size-10 rounded-full overflow-hidden relative border border-primary/20 bg-primary/10">
                              <Image src={avatarSrc(post.profile)} alt={post.profile.name} fill className="object-cover" referrerPolicy="no-referrer" unoptimized />
                            </div>
                            <div>
                              <h4 className={`text-sm font-bold ${textMain}`}>{post.profile.name}</h4>
                              <span className="text-[10px] text-slate-400">{formatDate(post.created_at)}</span>
                            </div>
                          </div>
                          {isOwner && (
                            <button
                              onClick={() => handleDeletePost(post.id)}
                              title="Excluir publicação"
                              className="text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          )}
                        </div>

                        <p className={`text-sm leading-relaxed whitespace-pre-line mb-4 ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                          {post.content}
                        </p>

                        <div className={`flex items-center gap-5 pt-3 border-t ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
                          <button
                            onClick={() => handleLike(post.id, post.user_has_liked)}
                            className={`flex items-center gap-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                              post.user_has_liked ? 'text-primary' : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-900'
                            }`}
                          >
                            <Star className={`size-4 ${post.user_has_liked ? 'fill-primary' : ''}`} />
                            <span>{post.likes_count} Curtir</span>
                          </button>
                          <button
                            onClick={() => setOpenComments((o) => ({ ...o, [post.id]: !showComments }))}
                            className={`flex items-center gap-1.5 text-xs font-semibold transition-colors cursor-pointer ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-900'}`}
                          >
                            <MessageCircle className="size-4" />
                            <span>{post.comments.length} {post.comments.length === 1 ? 'Resposta' : 'Respostas'}</span>
                          </button>
                        </div>

                        <AnimatePresence initial={false}>
                          {showComments && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="overflow-hidden"
                            >
                              <div className={`mt-4 pt-4 border-t space-y-3 ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
                                {post.comments.map((c) => (
                                  <div key={c.id} className="flex items-start gap-3">
                                    <div className="size-7 rounded-full overflow-hidden relative border border-primary/20 bg-primary/10 shrink-0 mt-0.5">
                                      <Image src={avatarSrc(c.profile)} alt={c.profile.name} fill className="object-cover" referrerPolicy="no-referrer" unoptimized />
                                    </div>
                                    <div className={`flex-1 rounded-2xl px-3 py-2 ${isDark ? 'bg-white/5' : 'bg-slate-50'}`}>
                                      <div className="flex items-center justify-between gap-2">
                                        <span className={`text-xs font-bold ${textMain}`}>{c.profile.name}</span>
                                        <div className="flex items-center gap-2">
                                          <span className="text-[10px] text-slate-400">{formatDate(c.created_at)}</span>
                                          {c.user_id === currentUser?.id && (
                                            <button onClick={() => handleDeleteComment(c.id)} title="Excluir resposta" className="text-slate-400 hover:text-red-400 cursor-pointer">
                                              <Trash2 className="size-3" />
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                      <p className={`text-xs leading-relaxed whitespace-pre-line mt-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{c.content}</p>
                                    </div>
                                  </div>
                                ))}

                                <form
                                  onSubmit={(e) => { e.preventDefault(); handleAddComment(post.id); }}
                                  className="flex items-center gap-2"
                                >
                                  <input
                                    value={commentDrafts[post.id] || ''}
                                    onChange={(e) => setCommentDrafts((d) => ({ ...d, [post.id]: e.target.value }))}
                                    placeholder="Escreva uma resposta..."
                                    maxLength={2000}
                                    className={`flex-1 rounded-xl px-3 py-2 text-xs outline-none border focus:border-primary/50 ${
                                      isDark ? 'bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400'
                                    }`}
                                  />
                                  <button
                                    type="submit"
                                    disabled={!(commentDrafts[post.id] || '').trim()}
                                    className="p-2 rounded-xl bg-primary text-white disabled:opacity-40 cursor-pointer"
                                    title="Enviar resposta"
                                  >
                                    <Send className="size-4" />
                                  </button>
                                </form>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Membros */}
            <div className="lg:col-span-4 space-y-6">
              <div className={`p-6 rounded-3xl border sticky top-24 ${card}`}>
                <div className="flex items-center gap-2 mb-1">
                  <Users className="size-5 text-primary" />
                  <h3 className={`text-lg font-bold font-display ${textMain}`}>Membros em Destaque</h3>
                </div>
                <p className={`text-[11px] mb-4 ${textSoft}`}>{activeCourse.title}</p>

                {members.length === 0 ? (
                  <p className="text-xs text-slate-500">Ainda sem atividade nesta jornada.</p>
                ) : (
                  <div className="space-y-3">
                    {members.map((member) => (
                      <div key={member.id} className={`flex items-center justify-between p-2.5 rounded-2xl transition-colors ${isDark ? 'hover:bg-white/5' : 'hover:bg-slate-50'}`}>
                        <div className="flex items-center gap-3">
                          <div className="size-9 rounded-full overflow-hidden relative border border-primary/20">
                            <Image src={avatarSrc(member)} alt={member.name} fill className="object-cover" referrerPolicy="no-referrer" unoptimized />
                          </div>
                          <div>
                            <p className={`text-xs font-bold ${textMain}`}>{member.name}</p>
                            <span className="text-[10px] text-accent-gold font-semibold">Nível {member.level}</span>
                          </div>
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium">{member.interaction_count} interações</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <BottomNav />
    </main>
  );
}

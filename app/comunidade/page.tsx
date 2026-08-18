'use client';

import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { motion } from 'motion/react';
import { Users, Shield, Star, MessageCircle, Hash, TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Image from 'next/image';
import { getDirectDriveLink } from '@/lib/utils';
import { useTheme } from '@/lib/ThemeContext';

interface Member {
  id: string;
  name: string;
  avatar_url: string | null;
  role: string;
  level: number;
  interaction_count?: number;
}

interface Post {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profiles: {
    name: string;
    avatar_url: string | null;
  };
  likes_count: number;
  user_has_liked: boolean;
}

export default function ComunidadePage() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [members, setMembers] = useState<Member[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPost, setNewPost] = useState('');
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  const fetchPosts = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    const { data, error } = await supabase
      .from('community_posts')
      .select(`
        *,
        profiles:user_id (name, avatar_url),
        post_interactions (user_id)
      `)
      .order('created_at', { ascending: false });

    if (!error && data) {
      const formattedPosts = data.map((post: any) => ({
        ...post,
        likes_count: post.post_interactions?.length || 0,
        user_has_liked: post.post_interactions?.some((i: any) => i.user_id === user?.id) || false
      }));
      setPosts(formattedPosts);
    }
  };

  const fetchMembers = async (user: any) => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, level')
        .eq('id', user.id)
        .single();

      const { data: allInteractions } = await supabase
        .from('post_interactions')
        .select('user_id');

      const { data: allPosts } = await supabase
        .from('community_posts')
        .select('user_id');

      const interactionCounts: Record<string, number> = {};
      const interactedUserIds = new Set<string>();

      allInteractions?.forEach(i => {
        interactionCounts[i.user_id] = (interactionCounts[i.user_id] || 0) + 1;
        interactedUserIds.add(i.user_id);
      });

      allPosts?.forEach(p => {
        interactedUserIds.add(p.user_id);
      });

      let query = supabase
        .from('profiles')
        .select('id, name, avatar_url, role, level')
        .in('id', Array.from(interactedUserIds));

      if (profile?.role !== 'admin' && !user.email?.includes('admin')) {
        query = query.gte('level', profile?.level || 1);
      }

      const { data, error } = await query.limit(10);

      if (!error && data) {
        const sortedMembers = data.map(m => ({
          ...m,
          interaction_count: interactionCounts[m.id] || 0
        })).sort((a, b) => (b.interaction_count || 0) - (a.interaction_count || 0));

        setMembers(sortedMembers);
      }
    } catch (err) {
      console.error('Error fetching members:', err);
    }
  };

  useEffect(() => {
    let isMounted = true;

    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = '/login';
        return;
      }
      if (isMounted) setCurrentUser(user);

      await Promise.all([
        fetchPosts(),
        fetchMembers(user)
      ]);

      if (isMounted) setLoading(false);
    }

    init();

    const postsSubscription = supabase
      .channel('public:community_posts')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'community_posts' 
      }, () => {
        fetchPosts();
      })
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(postsSubscription);
    };
  }, []);

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPost.trim() || !currentUser || posting) return;

    setPosting(true);
    try {
      const { error } = await supabase
        .from('community_posts')
        .insert({
          user_id: currentUser.id,
          content: newPost.trim()
        });

      if (error) throw error;
      setNewPost('');
      await fetchPosts();
      await fetchMembers(currentUser);
    } catch (err) {
      console.error('Error creating post:', err);
      alert('Erro ao publicar mensagem.');
    } finally {
      setPosting(false);
    }
  };

  const handleLike = async (postId: string, currentLiked: boolean) => {
    if (!currentUser) return;

    try {
      if (currentLiked) {
        await supabase
          .from('post_interactions')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', currentUser.id);
      } else {
        await supabase
          .from('post_interactions')
          .insert({
            post_id: postId,
            user_id: currentUser.id,
            interaction_type: 'like'
          });
      }
      await fetchPosts();
      await fetchMembers(currentUser);
    } catch (err) {
      console.error('Error toggling like:', err);
    }
  };

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
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className={`text-3xl font-bold font-display tracking-tight ${
              isDark ? 'text-slate-100' : 'text-slate-900'
            }`}>
              Mentoria & Comunidade
            </h1>
            <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Espaço de mentoria, feedback de artes no Canva e troca de ideias entre alunos.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main Feed Column */}
          <div className="lg:col-span-8 space-y-6">
            {/* Create Post Card */}
            <form onSubmit={handleCreatePost} className={`p-5 rounded-3xl border ${
              isDark ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200 shadow-sm'
            }`}>
              <textarea
                value={newPost}
                onChange={(e) => setNewPost(e.target.value)}
                placeholder="Compartilhe seu projeto, dúvida ou evolução no Canva com IA..."
                className={`w-full min-h-[100px] bg-transparent border-0 resize-none outline-none text-sm placeholder:text-slate-400 ${
                  isDark ? 'text-slate-100' : 'text-slate-900'
                }`}
              />
              <div className={`flex items-center justify-between pt-3 border-t ${
                isDark ? 'border-white/5' : 'border-slate-100'
              }`}>
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

            {/* Posts Stream */}
            <div className="space-y-4">
              {posts.length === 0 ? (
                <div className={`p-12 text-center rounded-3xl border border-dashed ${
                  isDark ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'
                }`}>
                  <MessageCircle className="size-10 text-slate-400 mx-auto mb-3" />
                  <p className="text-sm text-slate-500">Seja o primeiro a iniciar uma conversa na mentoria!</p>
                </div>
              ) : (
                posts.map((post) => (
                  <motion.div
                    key={post.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-6 rounded-3xl border transition-all ${
                      isDark ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200 shadow-sm'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className="size-10 rounded-full overflow-hidden relative border border-primary/20 bg-primary/10">
                        <Image
                          src={getDirectDriveLink(post.profiles?.avatar_url) || `https://ui-avatars.com/api/?name=${encodeURIComponent(post.profiles?.name || 'A')}&background=7311d4&color=fff`}
                          alt={post.profiles?.name || 'Membro'}
                          fill
                          className="object-cover"
                          referrerPolicy="no-referrer"
                          unoptimized
                        />
                      </div>
                      <div>
                        <h4 className={`text-sm font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                          {post.profiles?.name || 'Aluno Canva IA'}
                        </h4>
                        <span className="text-[10px] text-slate-400">
                          {new Date(post.created_at).toLocaleDateString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>

                    <p className={`text-sm leading-relaxed whitespace-pre-line mb-4 ${
                      isDark ? 'text-slate-200' : 'text-slate-700'
                    }`}>
                      {post.content}
                    </p>

                    <div className={`flex items-center gap-4 pt-3 border-t ${
                      isDark ? 'border-white/5' : 'border-slate-100'
                    }`}>
                      <button
                        onClick={() => handleLike(post.id, post.user_has_liked)}
                        className={`flex items-center gap-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                          post.user_has_liked
                            ? 'text-primary'
                            : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-900'
                        }`}
                      >
                        <Star className={`size-4 ${post.user_has_liked ? 'fill-primary' : ''}`} />
                        <span>{post.likes_count} Curtir</span>
                      </button>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>

          {/* Members Sidebar */}
          <div className="lg:col-span-4 space-y-6">
            <div className={`p-6 rounded-3xl border sticky top-24 ${
              isDark ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200 shadow-sm'
            }`}>
              <div className="flex items-center gap-2 mb-4">
                <Users className="size-5 text-primary" />
                <h3 className={`text-lg font-bold font-display ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                  Membros em Destaque
                </h3>
              </div>

              <div className="space-y-3">
                {members.map((member) => (
                  <div key={member.id} className={`flex items-center justify-between p-2.5 rounded-2xl ${
                    isDark ? 'hover:bg-white/5' : 'hover:bg-slate-50'
                  } transition-colors`}>
                    <div className="flex items-center gap-3">
                      <div className="size-9 rounded-full overflow-hidden relative border border-primary/20">
                        <Image
                          src={getDirectDriveLink(member.avatar_url) || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=7311d4&color=fff`}
                          alt={member.name}
                          fill
                          className="object-cover"
                          referrerPolicy="no-referrer"
                          unoptimized
                        />
                      </div>
                      <div>
                        <p className={`text-xs font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{member.name}</p>
                        <span className="text-[10px] text-accent-gold font-semibold">Nível {member.level}</span>
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium">{member.interaction_count} interações</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <BottomNav />
    </main>
  );
}

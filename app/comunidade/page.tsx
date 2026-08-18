'use client';

import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { motion } from 'motion/react';
import { Users, Shield, Star, MessageCircle, Hash, TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Image from 'next/image';
import { getDirectDriveLink } from '@/lib/utils';

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
      // Fetch user profile to get role and level
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, level')
        .eq('id', user.id)
        .single();

      // Fetch all interactions to count them per user
      const { data: allInteractions } = await supabase
        .from('post_interactions')
        .select('user_id');

      // Fetch all post authors
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

      // Apply filtering if not admin
      if (profile && profile.role !== 'admin') {
        query = query.eq('level', profile.level || 1);
      } else if (!profile) {
        query = query.eq('level', 1);
      }

      const { data, error } = await query
        .order('level', { ascending: false })
        .limit(20);
      
      if (data && !error) {
        const membersWithCounts = data.map(m => ({
          ...m,
          interaction_count: interactionCounts[m.id] || 0
        }));
        setMembers(membersWithCounts);
      }
    } catch (err) {
      console.error('Error fetching members:', err);
    }
  };

  useEffect(() => {
    let isMounted = true;

    async function checkAuthAndFetchData() {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        if (isMounted) window.location.href = '/login';
        return;
      }
      setCurrentUser(user);

      try {
        await Promise.all([
          fetchMembers(user),
          fetchPosts()
        ]);
      } catch (err) {
        console.error('Error fetching community data:', err);
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

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPost.trim() || posting) return;

    setPosting(true);
    try {
      const { error } = await supabase
        .from('community_posts')
        .insert([{ content: newPost, user_id: currentUser.id }]);

      if (!error) {
        setNewPost('');
        await fetchPosts();
      }
    } catch (err) {
      console.error('Error creating post:', err);
    } finally {
      setPosting(false);
    }
  };

  const handleToggleLike = async (postId: string, hasLiked: boolean) => {
    if (!currentUser) return;

    try {
      if (hasLiked) {
        await supabase
          .from('post_interactions')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', currentUser.id);
      } else {
        await supabase
          .from('post_interactions')
          .insert([{ post_id: postId, user_id: currentUser.id }]);
      }
      await Promise.all([
        fetchPosts(),
        fetchMembers(currentUser)
      ]);
    } catch (err) {
      console.error('Error toggling like:', err);
    }
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
        <div className="flex flex-col gap-1 mb-8">
          <div className="flex items-center gap-3">
            <Users className="size-6 text-primary" />
            <h1 className="text-2xl font-bold text-slate-100 font-display">Mentoria & Comunidade</h1>
          </div>
          <p className="text-sm text-slate-400">Espaço para tirar dúvidas, compartilhar suas criações e trocar experiências do curso Canva com IA.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Feed Column */}
          <div className="lg:col-span-8 space-y-10">
            {/* Post Creation */}
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
              <form onSubmit={handleCreatePost} className="relative">
                <textarea
                  value={newPost}
                  onChange={(e) => setNewPost(e.target.value)}
                  placeholder="Compartilhe uma dúvida, um insight ou o link do seu design no Canva..."
                  className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 pr-12 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-primary/50 transition-colors resize-none h-24"
                />
                <button 
                  type="submit"
                  disabled={posting || !newPost.trim()}
                  className="absolute bottom-4 right-4 p-2 rounded-xl bg-primary text-white hover:bg-primary-dark transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <MessageCircle className="size-5" />
                </button>
              </form>
            </div>

            {/* Community Feed */}
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="size-4 text-primary" />
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Mural de Mensagens</h2>
              </div>
              
              {posts.length === 0 ? (
                <div className="text-center py-10 bg-white/5 rounded-2xl border border-dashed border-white/10">
                  <p className="text-slate-500 text-xs italic">Seja o primeiro a deixar uma mensagem.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {posts.map((post) => (
                    <motion.div
                      key={post.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white/5 border border-white/10 rounded-2xl p-6"
                    >
                      <div className="flex items-center gap-3 mb-4">
                        <div className="relative size-10 rounded-full overflow-hidden border border-white/10">
                          <Image 
                            src={(post.profiles?.avatar_url && post.profiles.avatar_url.trim() !== '') 
                              ? getDirectDriveLink(post.profiles.avatar_url) 
                              : `https://ui-avatars.com/api/?name=${encodeURIComponent(post.profiles?.name || 'Membro')}&background=7311d4&color=fff&bold=true`}
                            alt={post.profiles?.name || 'Membro'}
                            fill
                            className="object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <div className="flex-1">
                          <h4 className="text-sm font-bold text-slate-200">{post.profiles?.name}</h4>
                          <p className="text-[10px] text-slate-500">
                            {new Date(post.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                      <p className="text-base text-slate-300 mb-6 leading-relaxed">
                        {post.content}
                      </p>
                      <div className="flex items-center gap-4">
                        <button 
                          onClick={() => handleToggleLike(post.id, post.user_has_liked)}
                          className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${post.user_has_liked ? 'text-primary' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                          <Star className={`size-4 ${post.user_has_liked ? 'fill-primary' : ''}`} />
                          {post.likes_count}
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Members Sidebar */}
          <div className="lg:col-span-4 space-y-6">
            <div className="sticky top-24 space-y-6">
              <div className="flex items-center gap-2 mb-4">
                <Star className="size-4 text-primary" />
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Membros da Egrégora</h2>
              </div>

              {members.length === 0 ? (
                <div className="text-center py-20 bg-white/5 rounded-3xl border border-white/10">
                  <p className="text-slate-500 italic text-sm">Nenhum membro encontrado ainda.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {members.map((member, index) => (
                    <motion.div
                      key={member.id}
                      initial={{ x: 20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: index * 0.05 }}
                      className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-4 hover:bg-white/10 transition-colors"
                    >
                      <div className="relative size-12 rounded-full overflow-hidden border-2 border-primary/20">
                        <Image 
                          src={(member.avatar_url && member.avatar_url.trim() !== '') 
                            ? getDirectDriveLink(member.avatar_url) 
                            : `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name || 'Membro')}&background=7311d4&color=fff&bold=true`} 
                          alt={member.name} 
                          fill 
                          className="object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <h3 className="text-sm font-bold text-slate-100">{member.name}</h3>
                          {member.level > 5 && <Star className="size-3 text-accent-gold fill-accent-gold" />}
                        </div>
                        <div className="flex items-center gap-2">
                          <Shield className="size-3 text-primary" />
                          <p className="text-[10px] text-slate-500 uppercase tracking-widest">
                            {member.role} • Nível {member.level}
                          </p>
                        </div>
                      </div>

                      <button className="p-2 rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all">
                        <MessageCircle className="size-4" />
                      </button>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <BottomNav />
    </main>
  );
}

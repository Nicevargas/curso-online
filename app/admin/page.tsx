'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import MistikaLogo from '@/components/Logo';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Trash2, 
  Edit3, 
  Eye, 
  Layers, 
  Video, 
  FileText, 
  Image as ImageIcon, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  ExternalLink, 
  Play, 
  ArrowLeft,
  X,
  Clock,
  Filter,
  Users,
  Shield,
  HelpCircle,
  Copy,
  ChevronRight,
  BookOpen
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { getDirectDriveLink, getEmbedVideoUrl } from '@/lib/utils';

interface ContentItem {
  id: string;
  title: string;
  description: string | null;
  archetype: string;
  thumbnail_url: string | null;
  media_url: string | null;
  url: string | null;
  created_at: string;
  is_favorite?: boolean;
}

interface Journey {
  id: string;
  title: string;
  archetype: string;
  steps?: number;
  duration?: string;
  image_url?: string | null;
}

export default function AdminDashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // Content state
  const [items, setItems] = useState<ContentItem[]>([]);
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [selectedArchetype, setSelectedArchetype] = useState<string>('todos');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals & form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ContentItem | null>(null);
  const [previewItem, setPreviewItem] = useState<ContentItem | null>(null);
  const [isPreviewStudentMode, setIsPreviewStudentMode] = useState(false);
  const [activeVideoUrl, setActiveVideoUrl] = useState<string | null>(null);

  // Form fields
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    archetype: 'Jornada',
    thumbnail_url: '',
    media_url: '',
    url: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Stats
  const [stats, setStats] = useState({
    totalLessons: 0,
    totalJourneys: 0,
    totalStudents: 0,
    myCompletedLessons: 0
  });

  useEffect(() => {
    let isMounted = true;

    async function checkAuthAndLoad() {
      try {
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
        if (authError || !authUser) {
          if (isMounted) window.location.href = '/login';
          return;
        }

        if (isMounted) setUser(authUser);

        // Check user role
        const { data: userProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authUser.id)
          .maybeSingle();

        const adminCheck = Boolean(
          userProfile?.role === 'admin' || 
          authUser.email?.toLowerCase().includes('admin') || 
          authUser.email?.toLowerCase().includes('eunicelvargas@gmail.com')
        );

        if (isMounted) {
          setProfile(userProfile);
          setIsAdmin(adminCheck);
        }

        await fetchAllData(adminCheck, authUser.id);
      } catch (err) {
        console.error('Error initializing admin:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    checkAuthAndLoad();

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

  async function fetchAllData(adminPrivileges: boolean = isAdmin, userId?: string) {
    try {
      // 1. Fetch all content / lessons
      const { data: contentData, error: contentError } = await supabase
        .from('content')
        .select('*')
        .order('created_at', { ascending: false });

      if (contentError) {
        console.warn('Could not fetch from content table:', contentError);
      } else if (contentData) {
        setItems(contentData);
      }

      // 2. Fetch journeys
      const { data: journeysData } = await supabase
        .from('journeys')
        .select('*')
        .order('title', { ascending: true });

      if (journeysData) {
        setJourneys(journeysData);
      }

      let studentCount = 0;
      let userCompletedCount = 0;

      if (adminPrivileges) {
        // Admin: fetch total count of students
        const { count } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true });
        studentCount = count || 0;
      } else if (userId || user?.id) {
        // Non-admin (Student): Only query own progress data
        const currentUid = userId || user?.id;
        const { count } = await supabase
          .from('evolution_diary')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', currentUid);
        userCompletedCount = count || 0;
      }

      setStats({
        totalLessons: contentData?.length || 0,
        totalJourneys: journeysData?.length || 0,
        totalStudents: studentCount,
        myCompletedLessons: userCompletedCount
      });
    } catch (error) {
      console.error('Error fetching admin data:', error);
    }
  }

  function showToast(text: string, type: 'success' | 'error' = 'success') {
    setNotification({ type, text });
    setTimeout(() => setNotification(null), 3500);
  }

  function handleOpenCreateModal() {
    if (!isAdmin) {
      showToast('Apenas administradores podem cadastrar aulas.', 'error');
      return;
    }
    setEditingItem(null);
    setFormData({
      title: '',
      description: '',
      archetype: journeys[0]?.archetype || 'Jornada',
      thumbnail_url: '',
      media_url: '',
      url: ''
    });
    setIsModalOpen(true);
  }

  function handleOpenEditModal(item: ContentItem) {
    if (!isAdmin) {
      showToast('Apenas administradores podem editar aulas.', 'error');
      return;
    }
    setEditingItem(item);
    setFormData({
      title: item.title || '',
      description: item.description || '',
      archetype: item.archetype || 'Jornada',
      thumbnail_url: item.thumbnail_url || '',
      media_url: item.media_url || '',
      url: item.url || ''
    });
    setIsModalOpen(true);
  }

  async function handleSaveItem(e: React.FormEvent) {
    e.preventDefault();
    if (!isAdmin) {
      showToast('Permissão negada. Apenas administradores podem salvar conteúdos.', 'error');
      return;
    }
    if (!formData.title.trim()) {
      showToast('O título da aula/conteúdo é obrigatório', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingItem) {
        // UPDATE
        const { error } = await supabase
          .from('content')
          .update({
            title: formData.title,
            description: formData.description,
            archetype: formData.archetype,
            thumbnail_url: formData.thumbnail_url || null,
            media_url: formData.media_url || null,
            url: formData.url || null,
          })
          .eq('id', editingItem.id);

        if (error) throw error;

        // Also update local list
        setItems(prev => prev.map(i => i.id === editingItem.id ? { ...i, ...formData } : i));
        showToast('Conteúdo atualizado com sucesso!');
      } else {
        // CREATE
        const newRecord = {
          title: formData.title,
          description: formData.description,
          archetype: formData.archetype,
          thumbnail_url: formData.thumbnail_url || null,
          media_url: formData.media_url || null,
          url: formData.url || null,
          created_at: new Date().toISOString()
        };

        const { data, error } = await supabase
          .from('content')
          .insert([newRecord])
          .select()
          .single();

        if (error) throw error;

        if (data) {
          setItems(prev => [data, ...prev]);
        }
        showToast('Nova aula cadastrada com sucesso!');
      }

      setIsModalOpen(false);
      await fetchAllData();
    } catch (err: any) {
      console.error('Error saving content:', err);
      showToast(err.message || 'Erro ao salvar conteúdo.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteItem(id: string, title: string) {
    if (!isAdmin) {
      showToast('Permissão negada. Apenas administradores podem excluir conteúdos.', 'error');
      return;
    }
    if (!confirm(`Tem certeza que deseja excluir a aula "${title}"?`)) return;

    try {
      const { error } = await supabase
        .from('content')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setItems(prev => prev.filter(i => i.id !== id));
      showToast('Conteúdo excluído com sucesso.');
      await fetchAllData();
    } catch (err: any) {
      console.error('Error deleting item:', err);
      showToast('Erro ao excluir conteúdo.', 'error');
    }
  }

  // Filter items
  const archetypesList = Array.from(new Set(items.map(i => i.archetype).filter(Boolean)));

  const filteredItems = items.filter(item => {
    const matchesArchetype = selectedArchetype === 'todos' || item.archetype === selectedArchetype;
    const matchesSearch = !searchQuery.trim() || 
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.archetype && item.archetype.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesArchetype && matchesSearch;
  });

  if (loading) {
    return (
      <main className="min-h-screen bg-black flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="size-8 border-2 border-primary border-t-transparent rounded-full"
        />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-slate-100 relative pb-28">
      {/* Header with Admin Badge */}
      <Header />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {/* Toast Alert */}
        <AnimatePresence>
          {notification && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`fixed top-20 right-4 z-50 p-4 rounded-2xl border shadow-2xl flex items-center gap-3 text-sm font-medium ${
                notification.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-red-500/10 border-red-500/30 text-red-300'
              }`}
            >
              {notification.type === 'success' ? <CheckCircle2 className="size-5 shrink-0" /> : <AlertCircle className="size-5 shrink-0" />}
              <span>{notification.text}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Top Breadcrumb & Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${
                isAdmin 
                  ? 'bg-primary/20 border border-primary/40 text-primary' 
                  : 'bg-accent-gold/20 border border-accent-gold/40 text-accent-gold'
              }`}>
                <Shield className="size-3.5" />
                {isAdmin ? 'Painel do Administrador' : 'Catálogo de Aulas & Conteúdos'}
              </span>
              <span className="text-xs text-slate-500">Canva com IA • {isAdmin ? 'Gestão de Conteúdos' : 'Minha Jornada'}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold font-display text-white">
              {isAdmin ? 'Gestão de Aulas & Conteúdos' : 'Aulas & Conteúdos Disponíveis'}
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              {isAdmin 
                ? 'Cadastre, edite, organize módulos e simule em tempo real a experiência do aluno.' 
                : 'Explore as aulas do curso, assista aos vídeos e acesse seus materiais de apoio.'}
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Toggle Student View Mode (Only for Admins) */}
            {isAdmin && (
              <button
                onClick={() => setIsPreviewStudentMode(!isPreviewStudentMode)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all border ${
                  isPreviewStudentMode
                    ? 'bg-accent-gold text-black border-accent-gold shadow-lg shadow-accent-gold/20'
                    : 'bg-white/5 text-slate-200 border-white/10 hover:bg-white/10'
                }`}
              >
                <Eye className="size-4" />
                {isPreviewStudentMode ? 'Modo Aluno Ativo' : 'Visualizar como Aluno'}
              </button>
            )}

            {/* Create New Lesson Button - ADMIN ONLY */}
            {isAdmin && (
              <button
                onClick={handleOpenCreateModal}
                className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/30 transition-all active:scale-95"
              >
                <Plus className="size-4" />
                Nova Aula / Conteúdo
              </button>
            )}
          </div>
        </div>

        {/* Stats Row - Shows total stats for Admin, Personal stats for Student */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-6">
          <div className="p-5 rounded-3xl bg-white/[0.03] border border-white/10 flex items-center gap-4">
            <div className="size-12 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary">
              <Video className="size-6" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-400 font-medium">Total de Aulas</p>
              <p className="text-2xl font-bold font-display text-white">{stats.totalLessons}</p>
            </div>
          </div>

          <div className="p-5 rounded-3xl bg-white/[0.03] border border-white/10 flex items-center gap-4">
            <div className="size-12 rounded-2xl bg-accent-gold/20 border border-accent-gold/30 flex items-center justify-center text-accent-gold">
              <Layers className="size-6" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-400 font-medium">Módulos / Jornadas</p>
              <p className="text-2xl font-bold font-display text-white">{stats.totalJourneys}</p>
            </div>
          </div>

          <div className="p-5 rounded-3xl bg-white/[0.03] border border-white/10 flex items-center gap-4">
            <div className="size-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Users className="size-6" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-400 font-medium">
                {isAdmin ? 'Alunos Registrados' : 'Minhas Aulas Concluídas'}
              </p>
              <p className="text-2xl font-bold font-display text-white">
                {isAdmin ? stats.totalStudents : stats.myCompletedLessons}
              </p>
            </div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-8 bg-white/[0.02] p-4 rounded-3xl border border-white/5">
          {/* Search Box */}
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar por título ou descrição..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl pl-10 pr-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-primary/50 transition-colors"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* Archetype / Module Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 scrollbar-none">
            <button
              onClick={() => setSelectedArchetype('todos')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                selectedArchetype === 'todos'
                  ? 'bg-primary text-white shadow-md shadow-primary/20'
                  : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200'
              }`}
            >
              Todos ({items.length})
            </button>
            {archetypesList.map(arch => {
              const count = items.filter(i => i.archetype === arch).length;
              return (
                <button
                  key={arch}
                  onClick={() => setSelectedArchetype(arch)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                    selectedArchetype === arch
                      ? 'bg-primary text-white shadow-md shadow-primary/20'
                      : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200'
                  }`}
                >
                  {arch} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Student Experience Live Preview View Mode */}
        {isPreviewStudentMode ? (
          <div className="space-y-6">
            <div className="p-4 rounded-2xl bg-accent-gold/10 border border-accent-gold/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Sparkles className="size-5 text-accent-gold shrink-0" />
                <p className="text-sm text-accent-gold font-medium">
                  <strong>Modo Experiência do Aluno:</strong> Você está visualizando o layout exatamente como os alunos veem ao acessar a aba Jornada.
                </p>
              </div>
              <button 
                onClick={() => setIsPreviewStudentMode(false)}
                className="text-xs underline text-accent-gold hover:text-white font-bold"
              >
                Voltar à Edição Admin
              </button>
            </div>

            {/* Student Grid Preview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredItems.map((challenge, index) => {
                const isVideo = challenge.media_url || challenge.url;
                const displayThumbnail = challenge.thumbnail_url
                  ? getDirectDriveLink(challenge.thumbnail_url)
                  : 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80';

                return (
                  <motion.div
                    key={challenge.id}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => {
                      if (isVideo) {
                        setActiveVideoUrl(challenge.media_url || challenge.url);
                      }
                    }}
                    className="group relative flex flex-col rounded-3xl bg-white/[0.04] border border-white/10 overflow-hidden hover:border-primary/50 transition-all duration-300 hover:shadow-2xl hover:shadow-primary/10 cursor-pointer"
                  >
                    <div className="relative aspect-video w-full overflow-hidden bg-black">
                      <Image
                        src={displayThumbnail}
                        alt={challenge.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
                      
                      {isVideo && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="size-12 rounded-full bg-primary/90 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                            <Play className="size-5 fill-current ml-0.5" />
                          </div>
                        </div>
                      )}

                      <div className="absolute top-3 left-3">
                        <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-black/60 backdrop-blur-md text-slate-200 border border-white/10">
                          {challenge.archetype}
                        </span>
                      </div>
                    </div>

                    <div className="p-5 flex-1 flex flex-col justify-between">
                      <div>
                        <h3 className="text-base font-bold text-slate-100 group-hover:text-primary transition-colors font-display mb-2 line-clamp-1">
                          {challenge.title}
                        </h3>
                        <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                          {challenge.description || 'Sem descrição cadastrada.'}
                        </p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-slate-400">
                        <span className="flex items-center gap-1.5">
                          <Clock className="size-3.5 text-primary" />
                          Aula do Módulo
                        </span>
                        <span className="text-primary font-semibold flex items-center gap-1">
                          Assistir Aula <ChevronRight className="size-3.5" />
                        </span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Admin Table / Card CRUD View */
          <div className="space-y-4">
            {filteredItems.length === 0 ? (
              <div className="text-center py-16 bg-white/[0.02] rounded-3xl border border-white/5">
                <Video className="size-12 text-slate-600 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-300">Nenhum conteúdo encontrado</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-6">
                  {searchQuery 
                    ? 'Tente ajustar sua busca ou filtro.' 
                    : (isAdmin ? 'Comece cadastrando a primeira aula para sua turma.' : 'Nenhuma aula cadastrada nesta categoria.')}
                </p>
                {isAdmin && (
                  <button
                    onClick={handleOpenCreateModal}
                    className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary/90 transition-all inline-flex items-center gap-2"
                  >
                    <Plus className="size-4" />
                    Cadastrar Aula
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {filteredItems.map((item) => {
                  const hasVideo = Boolean(item.media_url || item.url);
                  const displayThumbnail = item.thumbnail_url
                    ? getDirectDriveLink(item.thumbnail_url)
                    : null;

                  return (
                    <motion.div
                      key={item.id}
                      layout
                      className="p-4 sm:p-5 rounded-3xl bg-white/[0.03] border border-white/10 hover:border-white/20 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 group"
                    >
                      {/* Left: Thumbnail & Info */}
                      <div className="flex items-center gap-4 min-w-0 flex-1">
                        <div className="relative size-16 sm:size-20 rounded-2xl bg-white/5 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center">
                          {displayThumbnail ? (
                            <Image
                              src={displayThumbnail}
                              alt={item.title}
                              fill
                              className="object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <Video className="size-6 text-slate-600" />
                          )}
                          {hasVideo && (
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <Play className="size-5 text-white fill-white" />
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-primary/20 text-primary border border-primary/30">
                              {item.archetype || 'Geral'}
                            </span>
                            {hasVideo && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                                <Video className="size-2.5" /> Vídeo Ativo
                              </span>
                            )}
                          </div>

                          <h3 className="text-base font-bold text-white truncate font-display">
                            {item.title}
                          </h3>

                          <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">
                            {item.description || 'Sem descrição cadastrada'}
                          </p>
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center gap-2 w-full sm:w-auto justify-end border-t sm:border-t-0 pt-3 sm:pt-0 border-white/5">
                        {/* Play / Preview Video */}
                        {hasVideo && (
                          <button
                            onClick={() => setActiveVideoUrl(item.media_url || item.url)}
                            title="Assistir / Reproduzir"
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary/20 hover:bg-primary text-primary hover:text-white border border-primary/30 text-xs font-semibold transition-all"
                          >
                            <Play className="size-3.5 fill-current" />
                            <span>{isAdmin ? 'Testar' : 'Assistir'}</span>
                          </button>
                        )}

                        {/* Admin-only Edit & Delete buttons */}
                        {isAdmin && (
                          <>
                            <button
                              onClick={() => handleOpenEditModal(item)}
                              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 text-xs font-semibold transition-all"
                            >
                              <Edit3 className="size-3.5" />
                              <span>Editar</span>
                            </button>

                            <button
                              onClick={() => handleDeleteItem(item.id, item.title)}
                              title="Excluir aula"
                              className="p-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-colors"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* CRUD Create/Edit Modal - ONLY accessible to Admins */}
      <AnimatePresence>
        {isModalOpen && isAdmin && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-2xl bg-[#0d0d0d] border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-white/10 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold font-display text-white">
                    {editingItem ? 'Editar Aula / Conteúdo' : 'Cadastrar Nova Aula'}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Preencha os dados do vídeo, links de materiais e módulo correspondente.
                  </p>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 rounded-full text-slate-400 hover:bg-white/5 transition-colors"
                >
                  <X className="size-5" />
                </button>
              </div>

              {/* Modal Form */}
              <form onSubmit={handleSaveItem} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                {/* Title */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Título da Aula *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Módulo 1 - Desvendando os Efeitos de Texto no Canva"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-3.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-primary/50"
                  />
                </div>

                {/* Archetype / Journey Module */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Módulo / Arquétipo
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Jornada, Boas-vindas, Desafio 1, Truques Pro..."
                    value={formData.archetype}
                    onChange={(e) => setFormData({ ...formData, archetype: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-3.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-primary/50"
                  />
                  <p className="text-[11px] text-slate-500">
                    Dica: use o mesmo nome do arquétipo das jornadas para vincular as aulas aos módulos do aluno.
                  </p>
                </div>

                {/* Video URL (Google Drive, Vimeo, YouTube ou MP4) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Link do Vídeo da Aula (Google Drive, YouTube, Vimeo ou link direto)
                  </label>
                  <input
                    type="url"
                    placeholder="https://drive.google.com/file/d/... ou https://youtube.com/..."
                    value={formData.media_url}
                    onChange={(e) => setFormData({ ...formData, media_url: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-3.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-primary/50 font-mono text-xs"
                  />
                </div>

                {/* Thumbnail Cover URL */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    URL da Imagem de Capa (Thumbnail)
                  </label>
                  <input
                    type="url"
                    placeholder="https://... (link de imagem ou Google Drive)"
                    value={formData.thumbnail_url}
                    onChange={(e) => setFormData({ ...formData, thumbnail_url: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-3.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-primary/50 font-mono text-xs"
                  />
                </div>

                {/* Additional URL / PDF / Material */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Link de Material Complementar / PDF / Template Canva
                  </label>
                  <input
                    type="url"
                    placeholder="https://canva.com/design/... ou link de PDF"
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-3.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-primary/50 font-mono text-xs"
                  />
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Descrição Detalhada / Instruções
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Explique o objetivo deste desafio, os passos que o aluno deve seguir e dicas práticas..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-3.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-primary/50 resize-none"
                  />
                </div>

                {/* Modal Footer */}
                <div className="pt-4 flex items-center justify-end gap-3 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-5 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 text-sm font-semibold transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2.5 rounded-2xl bg-primary hover:bg-primary/90 text-white text-sm font-bold shadow-lg shadow-primary/30 transition-all disabled:opacity-50"
                  >
                    {isSubmitting ? 'Salvando...' : editingItem ? 'Salvar Alterações' : 'Criar Aula'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Video Playback Modal */}
      <AnimatePresence>
        {activeVideoUrl && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-4xl bg-black border border-white/15 rounded-3xl overflow-hidden shadow-2xl"
            >
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Play className="size-4 text-primary" />
                  <span className="text-sm font-bold text-white">Pré-visualização do Vídeo da Aula</span>
                </div>
                <button
                  onClick={() => setActiveVideoUrl(null)}
                  className="p-2 rounded-full text-slate-400 hover:bg-white/10 transition-colors"
                >
                  <X className="size-5" />
                </button>
              </div>

              <div className="relative aspect-video w-full bg-black">
                <iframe
                  src={getEmbedVideoUrl(activeVideoUrl) || ''}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <BottomNav />
    </main>
  );
}

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { Search, Copy, Check, Lightbulb, Bookmark, Sparkles, ClipboardList, X } from 'lucide-react';

import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import BusinessSheetModal from '@/components/BusinessSheetModal';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/ThemeContext';
import { useSession } from '@/lib/SessionContext';
import { useToast } from '@/components/ToastProvider';
import { getLocalBusinessSheet, generatePromptBlock } from '@/lib/businessSheet';

interface Tip {
  id: string;
  title: string;
  category: string;
  description: string | null;
  content: string;
}

export default function DicasPage() {
  const { theme } = useTheme();
  const { user, loading: sessionLoading } = useSession();
  const toast = useToast();
  const router = useRouter();
  const isDark = theme === 'dark';

  const [tips, setTips] = useState<Tip[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('todas');
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // ---------- Dados do banco (antes as dicas eram fixas no código) ----------
  const load = useCallback(async (userId: string) => {
    setLoading(true);
    const [tipsRes, favRes] = await Promise.all([
      supabase.from('tips').select('id, title, category, description, content').order('position', { ascending: true }),
      supabase.from('tip_favorites').select('tip_id').eq('user_id', userId),
    ]);

    if (tipsRes.error) {
      console.error('Erro ao carregar dicas:', tipsRes.error);
      toast.error('Não foi possível carregar as dicas.', tipsRes.error.message);
    }

    setTips((tipsRes.data as Tip[]) || []);
    setFavorites(new Set((favRes.data || []).map((f: any) => f.tip_id)));
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    if (sessionLoading) return;
    if (!user) {
      window.location.href = '/login';
      return;
    }
    load(user.id);
  }, [sessionLoading, user, load]);

  // ---------- Ações ----------
  const buildText = (tip: Tip, withSheet: boolean) => {
    if (!withSheet) return tip.content;
    const sheet = getLocalBusinessSheet();
    const block = generatePromptBlock(sheet);
    return `${tip.content}\n\n${block}`;
  };

  const handleCopy = async (tip: Tip, withSheet = false) => {
    try {
      await navigator.clipboard.writeText(buildText(tip, withSheet));
      setCopiedId(tip.id);
      setTimeout(() => setCopiedId(null), 2000);
      toast.success(withSheet ? 'Copiado com os dados da sua marca!' : 'Copiado para a área de transferência.');
    } catch {
      toast.error('Não foi possível copiar automaticamente.', 'Selecione o texto e use Ctrl+C.');
    }
  };

  const handleSendToLyra = (tip: Tip) => {
    // A Lyra lê este rascunho ao abrir
    try {
      sessionStorage.setItem('lyra_draft', buildText(tip, true));
    } catch {}
    router.push('/lyra');
  };

  const toggleFavorite = async (tip: Tip) => {
    if (!user) return;
    const isFav = favorites.has(tip.id);
    const next = new Set(favorites);
    if (isFav) next.delete(tip.id);
    else next.add(tip.id);
    setFavorites(next);

    const { error } = isFav
      ? await supabase.from('tip_favorites').delete().eq('user_id', user.id).eq('tip_id', tip.id)
      : await supabase.from('tip_favorites').insert({ user_id: user.id, tip_id: tip.id });

    if (error) {
      setFavorites(favorites);
      toast.error('Não foi possível salvar o favorito.');
    }
  };

  // ---------- Derivados ----------
  const categories = useMemo(() => Array.from(new Set(tips.map((t) => t.category).filter(Boolean))), [tips]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tips.filter((t) => {
      if (onlyFavorites && !favorites.has(t.id)) return false;
      if (category !== 'todas' && t.category !== category) return false;
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q) ||
        t.content.toLowerCase().includes(q)
      );
    });
  }, [tips, search, category, onlyFavorites, favorites]);

  const card = isDark ? 'bg-white/[0.03] border-white/10' : 'bg-white border-slate-200 shadow-sm';
  const soft = isDark ? 'text-slate-400' : 'text-slate-600';

  return (
    <main
      className={`min-h-screen relative pb-28 transition-colors duration-200 ${
        isDark ? 'bg-[#000000] text-slate-100' : 'bg-[#f7f6f8] text-slate-900'
      }`}
    >
      <Header />

      <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8">
        <div className="mb-6">
          <span className="px-2.5 py-0.5 rounded-full bg-accent-gold/20 text-accent-gold text-[10px] font-extrabold uppercase tracking-widest font-mono">
            Banco de prompts
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight mt-2">Prompts & Dicas</h1>
          <p className={`text-sm mt-1 ${soft}`}>
            Comandos prontos para copiar, personalizar com a sua marca e usar direto no Canva.
          </p>
        </div>

        {/* Busca e filtros */}
        <div className={`rounded-3xl border p-4 mb-6 ${card}`}>
          <div className="relative mb-3">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por tema, palavra-chave..."
              className={`w-full pl-11 pr-10 py-3 rounded-2xl text-sm outline-none border focus:border-primary/50 ${
                isDark ? 'bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-500' : 'bg-slate-50 border-slate-200'
              }`}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                aria-label="Limpar busca"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                setCategory('todas');
                setOnlyFavorites(false);
              }}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer ${
                category === 'todas' && !onlyFavorites
                  ? 'bg-primary text-white border-primary'
                  : isDark
                    ? 'bg-white/5 border-white/10 text-slate-300'
                    : 'bg-white border-slate-200 text-slate-600'
              }`}
            >
              Todas
            </button>
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => {
                  setCategory(c);
                  setOnlyFavorites(false);
                }}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer ${
                  category === c && !onlyFavorites
                    ? 'bg-primary text-white border-primary'
                    : isDark
                      ? 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {c}
              </button>
            ))}
            <button
              onClick={() => setOnlyFavorites((v) => !v)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                onlyFavorites
                  ? 'bg-accent-gold/20 text-accent-gold border-accent-gold/40'
                  : isDark
                    ? 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Bookmark className={`size-3.5 ${onlyFavorites ? 'fill-accent-gold' : ''}`} />
              Favoritas ({favorites.size})
            </button>
          </div>
        </div>

        {/* Lista */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className={`h-48 rounded-3xl border animate-pulse ${card}`} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className={`p-12 rounded-3xl border border-dashed text-center ${card}`}>
            <Lightbulb className="size-10 text-slate-400 mx-auto mb-3" />
            <p className="text-sm text-slate-500 mb-3">
              {tips.length === 0
                ? 'Nenhuma dica cadastrada ainda. O time está preparando o banco de prompts.'
                : `Nada encontrado${search ? ` para “${search}”` : ''}.`}
            </p>
            {tips.length > 0 && (
              <button
                onClick={() => {
                  setSearch('');
                  setCategory('todas');
                  setOnlyFavorites(false);
                }}
                className="text-xs font-bold text-primary hover:underline cursor-pointer"
              >
                Limpar filtros
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <AnimatePresence initial={false}>
              {filtered.map((tip) => {
                const isFav = favorites.has(tip.id);
                return (
                  <motion.article
                    key={tip.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    className={`rounded-3xl border p-5 flex flex-col ${card}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-bold uppercase tracking-wider">
                        {tip.category}
                      </span>
                      <button
                        onClick={() => toggleFavorite(tip)}
                        aria-label={isFav ? 'Remover dos favoritos' : 'Salvar nos favoritos'}
                        className={`transition-colors cursor-pointer ${isFav ? 'text-accent-gold' : 'text-slate-400 hover:text-accent-gold'}`}
                      >
                        <Bookmark className={`size-4 ${isFav ? 'fill-accent-gold' : ''}`} />
                      </button>
                    </div>

                    <h2 className="text-sm font-bold font-display mb-1">{tip.title}</h2>
                    {tip.description && <p className={`text-xs mb-3 ${soft}`}>{tip.description}</p>}

                    <pre
                      className={`text-xs leading-relaxed whitespace-pre-wrap font-sans rounded-2xl p-3 mb-4 flex-1 ${
                        isDark ? 'bg-black/40 text-slate-300' : 'bg-slate-50 text-slate-700'
                      }`}
                    >
                      {tip.content}
                    </pre>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => handleCopy(tip)}
                        className="flex-1 min-w-[110px] py-2.5 rounded-xl bg-primary text-white text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-primary/90 transition-colors cursor-pointer"
                      >
                        {copiedId === tip.id ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                        {copiedId === tip.id ? 'Copiado!' : 'Copiar'}
                      </button>

                      <button
                        onClick={() => handleCopy(tip, true)}
                        title="Copiar já com os dados da sua Ficha do Negócio"
                        className={`py-2.5 px-3 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-colors cursor-pointer ${
                          isDark ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <ClipboardList className="size-3.5" />
                        Com minha marca
                      </button>

                      <button
                        onClick={() => handleSendToLyra(tip)}
                        title="Abrir na consultora com este prompt"
                        className="py-2.5 px-3 rounded-xl text-xs font-bold border border-primary/30 bg-primary/10 text-primary flex items-center gap-1.5 hover:bg-primary/20 transition-colors cursor-pointer"
                      >
                        <Sparkles className="size-3.5" />
                        Lyra
                      </button>
                    </div>
                  </motion.article>
                );
              })}
            </AnimatePresence>
          </div>
        )}

        <div className="mt-8 text-center">
          <button
            onClick={() => setSheetOpen(true)}
            className={`text-xs font-bold px-4 py-2.5 rounded-2xl border inline-flex items-center gap-2 transition-colors cursor-pointer ${
              isDark ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <ClipboardList className="size-4 text-primary" />
            Editar minha Ficha do Negócio
          </button>
        </div>
      </div>

      <BusinessSheetModal isOpen={sheetOpen} onClose={() => setSheetOpen(false)} />
      <BottomNav />
    </main>
  );
}

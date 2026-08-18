'use client';

import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Lightbulb, Sparkles, Copy, Check, Search, Filter, 
  Layers, Wand2, Palette, MessageSquare, Flame, 
  ArrowRight, Bookmark, Tag, Send
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/ThemeContext';

interface ContentTip {
  id: string;
  category: 'prompts' | 'carrossel' | 'ganchos' | 'paletas' | 'roteiros';
  title: string;
  description: string;
  copyableContent: string;
  tags: string[];
}

const CONTENT_TIPS: ContentTip[] = [
  {
    id: '1',
    category: 'prompts',
    title: 'Fotografia de Produto Comercial com IA',
    description: 'Prompt para gerar fundos modernos e iluminação de estúdio para produtos no Magic Media.',
    copyableContent: 'Fotografia profissional de produto, frasco elegante sobre pedra de mármore branco com gotas de água sutis, iluminação de estúdio suave dourada, fundo clean minimalista, bokeh sutil, lente macro 85mm, ultra-detalhado, 8k resolution.',
    tags: ['Magic Media', 'Produtos', 'E-commerce']
  },
  {
    id: '2',
    category: 'carrossel',
    title: 'Estrutura 5 Slides: O Erro que Você Comete',
    description: 'Roteiro de carrossel de alto engajamento focado em retenção e salvamentos.',
    copyableContent: 'Slide 1 (Capa): "O erro silencioso que 90% das pessoas cometem ao criar artes no Canva (e como corrigir hoje)"\nSlide 2: "O Problema real e por que você perde tempo"\nSlide 3: "O Método de 3 passos usando Inteligência Artificial"\nSlide 4: "Exemplo prático do antes e depois"\nSlide 5 (CTA): "Salve este post para consultar quando for abrir o Canva!"',
    tags: ['Carrossel', 'Engajamento', 'Salvamentos']
  },
  {
    id: '3',
    category: 'ganchos',
    title: 'Headlines Magnéticas para Atrair Cliques',
    description: 'Ganchos comprovados para usar na primeira linha de posts, carrosséis ou capas de Reels.',
    copyableContent: '1. "Pare de fazer isso se você quer artes com aspecto profissional no Canva..."\n2. "O segredo que os grandes designers não te contam sobre o Canva com IA..."\n3. "Em apenas 5 minutos você pode transformar esse design básico em algo impressionante..."\n4. "Se eu estivesse começando hoje a criar conteúdo, faria exatamente isso:"',
    tags: ['Headlines', 'Copywriting', 'Atenção']
  },
  {
    id: '4',
    category: 'prompts',
    title: 'Retrato Corporativo Elegante (Headshot)',
    description: 'Gere fotos corporativas realistas para avatares, banners ou depoimentos.',
    copyableContent: 'Retrato fotográfico realista de mulher empreendedora moderna em escritório contemporâneo, blazer alfaiataria neutro, iluminação natural suave vinda da janela, expressão confiante e acolhedora, profundidade de campo cinematográfica, 50mm f/1.8.',
    tags: ['Retratos', 'Autoridade', 'Branding']
  },
  {
    id: '5',
    category: 'paletas',
    title: 'Paleta Autoridade & Luxo Minimalista',
    description: 'Combinação de códigos hexadecimais perfeita para marcas sofisticadas.',
    copyableContent: '• Preto Nobre: #121214\n• Dourado Imperial: #D4AF37\n• Roxo Primário: #7311D4\n• Off-White Seda: #F7F6F8\n• Cinza Platina: #E4E4E7',
    tags: ['Paletas', 'Cores', 'Branding Kit']
  },
  {
    id: '6',
    category: 'roteiros',
    title: 'Roteiro de Reel: 3 Truques Secretos do Canva',
    description: 'Roteiro dinâmico de 30 segundos para vídeo curto de alto compartilhamento.',
    copyableContent: '[0-3s Gancho]: "Você usa o Canva todo dia e ainda não conhece esses 3 segredos com Inteligência Artificial?"\n[4-12s Dica 1]: "1. Magic Grab: Selecione e mova qualquer elemento de uma foto pronta."\n[13-20s Dica 2]: "2. Magic Expand: Aumente o fundo de qualquer foto em 1 clique sem esticar."\n[21-26s Dica 3]: "3. Tradutor Instantâneo: Traduza todo o seu design para qualquer idioma."\n[27-30s CTA]: "Qual dessas você já usou? Comenta aqui embaixo!"',
    tags: ['Reels', 'Roteiro', 'Vídeo Rápido']
  }
];

const CATEGORIES = [
  { id: 'all', label: 'Todos', icon: Sparkles },
  { id: 'prompts', label: 'Prompts IA', icon: Wand2 },
  { id: 'carrossel', label: 'Carrosséis', icon: Layers },
  { id: 'ganchos', label: 'Ganchos & Headlines', icon: Flame },
  { id: 'paletas', label: 'Paletas & Cores', icon: Palette },
  { id: 'roteiros', label: 'Roteiros de Vídeo', icon: MessageSquare },
];

export default function DicasPage() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = '/login';
        return;
      }
      setLoading(false);
    }
    checkAuth();
  }, []);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredTips = CONTENT_TIPS.filter(tip => {
    const matchesCategory = selectedCategory === 'all' || tip.category === selectedCategory;
    const matchesSearch = tip.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
      tip.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tip.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    
    return matchesCategory && matchesSearch;
  });

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
    <main className={`min-h-screen flex flex-col relative pb-24 transition-colors duration-200 ${
      isDark ? 'bg-[#000000] text-slate-100' : 'bg-[#f7f6f8] text-slate-900'
    }`}>
      <Header />
      
      <div className="max-w-4xl mx-auto w-full px-4 py-8 space-y-8">
        {/* Page Header */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-2xl bg-gradient-to-tr from-accent-gold/40 to-primary/40 flex items-center justify-center border border-accent-gold/30 shadow-lg shadow-accent-gold/10">
              <Lightbulb className="size-6 text-accent-gold" />
            </div>
            <div>
              <h1 className={`text-2xl font-bold font-display ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                Dicas de Conteúdo & Prompts
              </h1>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Recursos prontos para copiar e acelerar sua criação no Canva com IA
              </p>
            </div>
          </div>
        </div>

        {/* Search and Category Filters */}
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <input 
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por palavras-chave, tags ou ferramentas..."
              className={`w-full pl-11 pr-4 py-3 rounded-2xl text-sm border outline-none transition-all ${
                isDark 
                  ? 'bg-white/5 border-white/10 text-slate-200 placeholder:text-slate-500 focus:border-primary' 
                  : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-primary'
              }`}
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {CATEGORIES.map(cat => {
              const Icon = cat.icon;
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-primary text-white shadow-md shadow-primary/20'
                      : isDark
                        ? 'bg-white/5 border border-white/10 text-slate-400 hover:text-slate-200 hover:bg-white/10'
                        : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 shadow-sm'
                  }`}
                >
                  <Icon className="size-3.5" />
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredTips.map((tip) => (
            <motion.div
              key={tip.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`rounded-3xl border p-6 flex flex-col justify-between group transition-all ${
                isDark 
                  ? 'bg-white/5 border-white/10 hover:border-primary/40' 
                  : 'bg-white border-slate-200 shadow-sm hover:shadow-md hover:border-primary/40'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-1.5">
                    {tip.tags.map((tag, i) => (
                      <span key={i} className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 uppercase tracking-wider">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <h3 className={`text-base font-bold font-display ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                  {tip.title}
                </h3>
                
                <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  {tip.description}
                </p>

                <div className={`relative rounded-2xl p-4 border mt-3 font-mono text-xs whitespace-pre-line leading-relaxed ${
                  isDark 
                    ? 'bg-black/40 border-white/5 text-slate-300' 
                    : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}>
                  {tip.copyableContent}
                </div>
              </div>

              <div className={`mt-5 pt-4 border-t flex items-center justify-between ${
                isDark ? 'border-white/5' : 'border-slate-100'
              }`}>
                <span className="text-[11px] text-slate-400">Pronto para usar no Canva</span>
                <button
                  onClick={() => handleCopy(tip.id, tip.copyableContent)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    copiedId === tip.id
                      ? 'bg-emerald-500 text-white'
                      : 'bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/20'
                  }`}
                >
                  {copiedId === tip.id ? (
                    <>
                      <Check className="size-3.5" />
                      Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="size-3.5" />
                      Copiar Conteúdo
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <BottomNav />
    </main>
  );
}

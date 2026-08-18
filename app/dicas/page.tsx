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
    copyableContent: '• Preto Noite: #121214\n• Dourado Nobre: #D4AF37\n• Bege Areia / Linho: #EFECE6\n• Cinza Titânio: #71717A\n• Dica de Fontes: Newsreader / Playfair Display (Títulos) + Inter / Montserrat (Textos)',
    tags: ['Cores', 'Branding', 'Tipografia']
  },
  {
    id: '6',
    category: 'roteiros',
    title: 'Roteiro Rápido para Reels de Tutorial (30s)',
    description: 'Estrutura dinâmica para vídeos curtos mostrando um recurso do Canva.',
    copyableContent: '[0-3s Gancho]: "Você sabia que o Canva faz ISSO automaticamente?"\n[3-15s Demonstração]: Mostre a tela usando a ferramenta de IA (ex: Magic Edit ou Remoção Mágica).\n[15-25s Resultado]: Mostre o antes e depois surpreendente.\n[25-30s CTA]: "Comenta \'CANVA\' que eu te mando mais dicas no direct!"',
    tags: ['Reels', 'TikTok', 'Tutorial']
  },
  {
    id: '7',
    category: 'prompts',
    title: 'Texturas Abstratas & Fundos Holográficos',
    description: 'Elementos visuais de fundo para dar profundidade aos seus designs e carrosséis.',
    copyableContent: 'Fundo abstrato 3D com ondas fluidas e gradiente suave roxo profundo e dourado, acabamento de vidro fosco glassmorphism, iluminação suave volumétrica, estética futurista e elegante, papel de parede minimalista.',
    tags: ['Texturas', 'Backgrounds', '3D']
  }
];

export default function DicasPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('todas');
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

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredTips = CONTENT_TIPS.filter(tip => {
    const matchesCategory = selectedCategory === 'todas' || tip.category === selectedCategory;
    const matchesSearch = searchTerm === '' || 
      tip.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tip.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tip.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    
    return matchesCategory && matchesSearch;
  });

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
    <main className="min-h-screen bg-background-dark flex flex-col relative pb-24">
      <Header />
      
      <div className="max-w-4xl mx-auto w-full px-4 py-8 space-y-8">
        {/* Page Header */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-2xl bg-gradient-to-tr from-accent-gold/40 to-primary/40 flex items-center justify-center border border-accent-gold/30 shadow-lg shadow-accent-gold/10">
              <Lightbulb className="size-6 text-accent-gold" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-100 font-display">Dicas de Conteúdo & Prompts</h1>
              <p className="text-xs text-slate-400">Ideias, fórmulas de carrossel e comandos prontos para Canva com IA</p>
            </div>
          </div>
        </div>

        {/* Search Bar & Category Filters */}
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por palavras-chave (ex: produto, carrossel, cores, ganchos)..."
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 pl-11 pr-4 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-primary/50 transition-colors"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {[
              { id: 'todas', label: 'Todas as Dicas' },
              { id: 'prompts', label: 'Prompts de IA' },
              { id: 'carrossel', label: 'Ideias de Carrossel' },
              { id: 'ganchos', label: 'Ganchos & Títulos' },
              { id: 'paletas', label: 'Paletas de Cores' },
              { id: 'roteiros', label: 'Roteiros de Vídeo' },
            ].map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all whitespace-nowrap ${
                  selectedCategory === cat.id
                    ? 'bg-primary text-white shadow-md shadow-primary/20'
                    : 'bg-white/5 border border-white/10 text-slate-400 hover:text-slate-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tips Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredTips.map((tip) => (
            <motion.div
              key={tip.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/5 border border-white/10 rounded-3xl p-6 flex flex-col justify-between hover:border-primary/40 hover:bg-white/[0.07] transition-all group"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-primary/20 text-primary border border-primary/30">
                    {tip.category === 'prompts' ? 'Prompt IA' : tip.category === 'carrossel' ? 'Carrossel' : tip.category === 'ganchos' ? 'Gancho' : tip.category === 'paletas' ? 'Design' : 'Roteiro'}
                  </span>
                  
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Sparkles className="size-3.5 text-accent-gold" />
                    <span>Pronto para usar</span>
                  </div>
                </div>

                <h3 className="text-base font-bold text-slate-100 font-display">
                  {tip.title}
                </h3>

                <p className="text-xs text-slate-400 leading-relaxed">
                  {tip.description}
                </p>

                {/* Copyable Box */}
                <div className="relative bg-black/40 border border-white/5 rounded-2xl p-4 mt-3">
                  <pre className="text-xs text-slate-300 font-sans whitespace-pre-wrap leading-relaxed max-h-36 overflow-y-auto pr-8">
                    {tip.copyableContent}
                  </pre>
                  
                  <button
                    onClick={() => copyToClipboard(tip.copyableContent, tip.id)}
                    className="absolute top-3 right-3 p-2 rounded-xl bg-white/10 text-slate-300 hover:text-white hover:bg-primary transition-all flex items-center gap-1.5 text-[11px] font-medium"
                    title="Copiar texto"
                  >
                    {copiedId === tip.id ? (
                      <>
                        <Check className="size-3.5 text-emerald-400" />
                        <span className="text-emerald-400 font-bold">Copiado</span>
                      </>
                    ) : (
                      <>
                        <Copy className="size-3.5" />
                        <span>Copiar</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Tags footer */}
              <div className="flex flex-wrap items-center gap-1.5 pt-4 mt-2 border-t border-white/5">
                {tip.tags.map((tag, tIdx) => (
                  <span key={tIdx} className="text-[10px] text-slate-500 bg-white/5 px-2 py-0.5 rounded-md">
                    #{tag}
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <BottomNav />
    </main>
  );
}

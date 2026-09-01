'use client';

import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Send, Sparkles, User, Bot, Lightbulb, Copy, Check, Palette, BookOpen, Layers, Wand2, ExternalLink, FileText, ClipboardList } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/ThemeContext';
import BusinessSheetModal from '@/components/BusinessSheetModal';
import { getLocalBusinessSheet, generatePromptBlock } from '@/lib/businessSheet';

interface Fonte {
  numero: number;
  nome: string;
  link: string | null;
  similaridade: number;
}

interface Message {
  role: 'user' | 'model';
  text: string;
  fontes?: Fonte[];
}

const QUICK_PROMPTS = [
  {
    icon: Wand2,
    label: "Prompt para Canva IA",
    query: "Me dê 3 modelos de prompts prontos para gerar imagens profissionais e realistas no Magic Media do Canva."
  },
  {
    icon: Layers,
    label: "Estrutura de Carrossel",
    query: "Como estruturar um carrossel magnético de 5 slides no Canva que gera muitos salvamentos e compartilhamentos?"
  },
  {
    icon: Palette,
    label: "Combinação de Cores",
    query: "Quais são as melhores combinações de cores e fontes para passar autoridade e sofisticação no Canva?"
  },
  {
    icon: BookOpen,
    label: "Dicas de Ferramentas",
    query: "Quais são os principais atalhos e recursos de inteligência artificial do Canva que aceleram a criação?"
  }
];

export default function ConsultoraPage() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'model',
      text: 'Olá! Sou sua **Conselheira e Consultora de Canva com IA**.\n\nEstou aqui para te orientar em todos os assuntos do curso: ferramentas de IA do Canva, criação de prompts de alto impacto, roteiros de carrosséis, identidade visual e estratégias de conteúdo.\n\nComo posso te ajudar no seu projeto de hoje?'
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSendMessage = async (textToSend?: string) => {
    const messageContent = textToSend || input;
    if (!messageContent.trim()) return;

    const userMessage: Message = { role: 'user', text: messageContent };
    setMessages(prev => [...prev, userMessage]);
    if (!textToSend) setInput('');
    setIsTyping(true);

    try {
      const response = await fetch('/api/consultor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pergunta: messageContent,
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.text
          }))
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Falha ao obter resposta da consultora');
      }

      const data = await response.json();
      const modelMessage: Message = {
        role: 'model',
        text: data.resposta || data.text || 'Desculpe, não consegui obter a resposta no momento.',
        fontes: Array.isArray(data.fontes) ? data.fontes : undefined
      };

      setMessages(prev => [...prev, modelMessage]);
    } catch (err: any) {
      console.error('Error in chat:', err);
      setMessages(prev => [
        ...prev,
        {
          role: 'model',
          text: err.message ? `Erro na consultoria: ${err.message}` : 'Houve uma falha na conexão com a consultoria. Por favor, tente novamente em alguns instantes.'
        }
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
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
    <main className={`min-h-screen flex flex-col relative pb-20 transition-colors duration-200 ${
      isDark ? 'bg-[#000000] text-slate-100' : 'bg-[#f7f6f8] text-slate-900'
    }`}>
      <Header />
      
      {/* Header Info */}
      <div className={`p-4 flex items-center justify-between sticky top-[69px] z-40 backdrop-blur-md border-b ${
        isDark ? 'bg-black/80 border-white/5' : 'bg-white/80 border-slate-200 shadow-sm'
      }`}>
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-2xl bg-gradient-to-tr from-primary to-accent-gold/50 flex items-center justify-center border border-primary/40 shadow-lg shadow-primary/20">
            <Sparkles className="size-5 text-white" />
          </div>
          <div>
            <h1 className={`text-sm font-bold font-display ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
              Conselheira & Consultora de IA
            </h1>
            <div className="flex items-center gap-1.5">
              <div className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className={`text-[10px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Especialista Canva com IA Ativa
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 max-w-3xl mx-auto w-full">
        {/* Quick Suggestion Pills */}
        {messages.length <= 1 && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
              <Lightbulb className="size-4 text-accent-gold" />
              Tópicos de Pesquisa Rápida:
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {QUICK_PROMPTS.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(item.query)}
                  className={`p-3 rounded-2xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                    isDark 
                      ? 'bg-white/5 border-white/10 hover:border-primary/50 hover:bg-white/10' 
                      : 'bg-white border-slate-200 shadow-sm hover:border-primary/50 hover:bg-slate-50'
                  }`}
                >
                  <div className="size-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
                    <item.icon className="size-4 text-primary" />
                  </div>
                  <div>
                    <p className={`text-xs font-bold ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>{item.label}</p>
                    <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">{item.query}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {message.role === 'model' && (
              <div className="size-8 rounded-full bg-gradient-to-tr from-primary to-accent-gold flex items-center justify-center shrink-0 shadow-md">
                <Bot className="size-4 text-white" />
              </div>
            )}

            <div className={`relative max-w-[85%] rounded-3xl p-4 sm:p-5 text-sm leading-relaxed shadow-sm ${
              message.role === 'user'
                ? 'bg-primary text-white rounded-br-none'
                : isDark
                  ? 'bg-[#18151f] border border-white/10 text-slate-200 rounded-bl-none'
                  : 'bg-white border border-slate-200 text-slate-900 rounded-bl-none shadow-sm'
            }`}>
              <div className="whitespace-pre-wrap font-sans">
                {message.text}
              </div>

              {/* Cited Sources from RAG Knowledge Base */}
              {message.role === 'model' && message.fontes && message.fontes.length > 0 && (
                <div className={`mt-3 pt-3 border-t ${
                  isDark ? 'border-white/10' : 'border-slate-200'
                }`}>
                  <div className="flex items-center gap-1.5 mb-2 text-[11px] font-bold text-accent-gold uppercase tracking-wider">
                    <FileText className="size-3.5" />
                    Fontes do Material do Workshop:
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {message.fontes.map((fonte) => (
                      <div
                        key={fonte.numero}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs border ${
                          isDark 
                            ? 'bg-white/5 border-white/10 text-slate-300' 
                            : 'bg-slate-100 border-slate-200 text-slate-700'
                        }`}
                      >
                        <span className="font-bold text-primary">[{fonte.numero}]</span>
                        <span className="truncate max-w-[180px]">{fonte.nome}</span>
                        {fonte.link && (
                          <a
                            href={fonte.link}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary hover:text-accent-gold transition-colors ml-0.5"
                            title="Abrir documento original"
                          >
                            <ExternalLink className="size-3" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {message.role === 'model' && (
                <div className={`flex items-center justify-end gap-2 mt-3 pt-2 border-t ${
                  isDark ? 'border-white/5' : 'border-slate-100'
                }`}>
                  <button
                    onClick={() => copyToClipboard(message.text, index)}
                    className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    {copiedIndex === index ? (
                      <>
                        <Check className="size-3 text-emerald-400" />
                        <span className="text-emerald-400">Copiado</span>
                      </>
                    ) : (
                      <>
                        <Copy className="size-3" />
                        <span>Copiar resposta</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {message.role === 'user' && (
              <div className="size-8 rounded-full bg-slate-700 flex items-center justify-center shrink-0">
                <User className="size-4 text-white" />
              </div>
            )}
          </motion.div>
        ))}

        {isTyping && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-3 items-center"
          >
            <div className="size-8 rounded-full bg-gradient-to-tr from-primary to-accent-gold flex items-center justify-center shrink-0 shadow-md">
              <Bot className="size-4 text-white" />
            </div>
            <div className={`rounded-2xl p-4 border flex items-center gap-1.5 ${
              isDark ? 'bg-[#18151f] border-white/10' : 'bg-white border-slate-200 shadow-sm'
            }`}>
              <div className="size-2 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
              <div className="size-2 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
              <div className="size-2 rounded-full bg-primary animate-bounce" />
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <div className={`p-3 sm:p-4 sticky bottom-0 z-40 border-t ${
        isDark ? 'bg-black/90 border-white/5 backdrop-blur-md' : 'bg-white/90 border-slate-200 backdrop-blur-md'
      }`}>
        {/* Quick Context / Ficha do Negócio Actions */}
        <div className="max-w-3xl mx-auto mb-2 flex items-center justify-between gap-2 overflow-x-auto text-[11px]">
          <button
            type="button"
            onClick={() => {
              const sheet = getLocalBusinessSheet();
              const promptContext = generatePromptBlock(sheet);
              setInput(prev => prev ? `${prev}\n\n${promptContext}` : promptContext);
            }}
            className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 transition-all font-semibold shrink-0 cursor-pointer ${
              isDark 
                ? 'bg-primary/15 border-primary/30 text-primary hover:bg-primary/25' 
                : 'bg-primary/10 border-primary/20 text-primary hover:bg-primary/15'
            }`}
          >
            <Sparkles className="size-3.5" />
            <span>Inserir Ficha do Negócio (Canva)</span>
          </button>

          <button
            type="button"
            onClick={() => setIsSheetOpen(true)}
            className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 transition-all font-semibold shrink-0 cursor-pointer ${
              isDark 
                ? 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10' 
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <ClipboardList className="size-3.5 text-primary" />
            <span>Ver Ficha (Canva)</span>
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="max-w-3xl mx-auto flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pergunte sobre aulas, ferramentas de IA, prompts ou carrosséis..."
            disabled={isTyping}
            className={`flex-1 px-5 py-3.5 rounded-2xl text-sm border outline-none transition-all ${
              isDark 
                ? 'bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-500 focus:border-primary' 
                : 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-primary'
            }`}
          />
          <button
            type="submit"
            disabled={!input.trim() || isTyping}
            className="size-12 rounded-2xl bg-primary hover:bg-primary/90 text-white flex items-center justify-center transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed shrink-0 cursor-pointer"
          >
            <Send className="size-5" />
          </button>
        </form>
      </div>

      <BusinessSheetModal 
        isOpen={isSheetOpen} 
        onClose={() => setIsSheetOpen(false)} 
      />

      <BottomNav />
    </main>
  );
}

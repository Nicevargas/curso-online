'use client';

import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Send, Sparkles, User, Bot, Lightbulb, Copy, Check, Palette, BookOpen, Layers, Wand2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Message {
  role: 'user' | 'model';
  text: string;
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
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = async (customText?: string) => {
    const messageToSend = customText || input.trim();
    if (!messageToSend || isTyping) return;

    if (!customText) setInput('');

    const newMessages = [...messages, { role: 'user' as const, text: messageToSend }];
    setMessages(newMessages);
    setIsTyping(true);

    try {
      const response = await fetch('/api/consultora', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!response.ok) {
        throw new Error('Falha na resposta do servidor');
      }

      const data = await response.json();
      const replyText = data.text || "Desculpe, não consegui obter uma resposta. Tente novamente.";
      
      setMessages(prev => [...prev, { role: 'model', text: replyText }]);
    } catch (error) {
      console.error('Erro na consulta:', error);
      setMessages(prev => [
        ...prev,
        {
          role: 'model',
          text: "Houve uma instabilidade temporária na conexão. Por favor, tente enviar sua pergunta novamente!"
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
    <main className="min-h-screen bg-background-dark flex flex-col relative pb-20">
      <Header />
      
      {/* Header Info */}
      <div className="bg-background-dark/80 backdrop-blur-md border-b border-white/5 p-4 flex items-center justify-between sticky top-[69px] z-40">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-2xl bg-gradient-to-tr from-primary to-accent-gold/50 flex items-center justify-center border border-primary/40 shadow-lg shadow-primary/20">
            <Sparkles className="size-5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-100 font-display">Conselheira & Consultora de IA</h1>
            <div className="flex items-center gap-1.5">
              <div className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] text-slate-400 font-medium">Especialista Canva com IA Ativa</span>
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
                  onClick={() => handleSend(item.query)}
                  className="flex items-center gap-3 p-3.5 rounded-2xl bg-white/5 border border-white/10 hover:border-primary/50 hover:bg-primary/10 transition-all text-left group"
                >
                  <div className="size-8 rounded-xl bg-primary/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <item.icon className="size-4 text-primary" />
                  </div>
                  <span className="text-xs font-semibold text-slate-200 group-hover:text-white transition-colors">
                    {item.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`flex gap-3 max-w-[90%] sm:max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`size-8 rounded-full flex items-center justify-center shrink-0 border ${
                msg.role === 'user' 
                  ? 'bg-white/10 border-white/20' 
                  : 'bg-primary/20 border-primary/30'
              }`}>
                {msg.role === 'user' ? <User className="size-4 text-slate-300" /> : <Bot className="size-4 text-primary" />}
              </div>
              <div className="relative group">
                <div className={`p-4 sm:p-5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-primary text-white rounded-tr-none'
                    : 'bg-white/5 text-slate-200 border border-white/10 rounded-tl-none shadow-md'
                }`}>
                  {msg.text}
                </div>
                {msg.role === 'model' && (
                  <button
                    onClick={() => copyToClipboard(msg.text, index)}
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/40 text-slate-400 hover:text-white opacity-0 group-hover:opacity-100 transition-all"
                    title="Copiar resposta"
                  >
                    {copiedIndex === index ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        ))}

        {isTyping && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div className="flex gap-3">
              <div className="size-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
                <Bot className="size-4 text-primary" />
              </div>
              <div className="bg-white/5 border border-white/10 p-4 rounded-2xl rounded-tl-none flex items-center gap-1.5">
                <span className="text-xs text-slate-400 mr-1">Consultando conhecimento...</span>
                <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1 }} className="size-1.5 rounded-full bg-primary" />
                <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="size-1.5 rounded-full bg-primary" />
                <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="size-1.5 rounded-full bg-primary" />
              </div>
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 sticky bottom-20 z-40 bg-background-dark/90 backdrop-blur-xl border-t border-white/5">
        <div className="max-w-3xl mx-auto relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Pergunte sobre prompts, ferramentas do Canva, ideias de post..."
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-5 pr-14 text-sm text-slate-200 focus:outline-none focus:border-primary/50 transition-all placeholder:text-slate-500 shadow-inner"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isTyping}
            className="absolute right-2.5 top-2.5 bottom-2.5 px-4 rounded-xl bg-primary text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:bg-primary/80 flex items-center justify-center shadow-md shadow-primary/20"
          >
            <Send className="size-4" />
          </button>
        </div>
        <p className="text-center text-[10px] text-slate-500 mt-2.5 uppercase tracking-wider font-medium">
          Consultora Especialista treinada nas técnicas e ferramentas do Canva com IA
        </p>
      </div>

      <BottomNav />
    </main>
  );
}

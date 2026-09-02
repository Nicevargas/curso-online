'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, FileText, Check, Copy, Sparkles, AlertCircle, 
  HelpCircle, Printer, Save, ArrowRight, ExternalLink,
  Layers, Palette, MessageSquare, Volume2, UserCheck, Briefcase
} from 'lucide-react';
import { 
  BusinessSheetData, 
  EMPTY_BUSINESS_SHEET, 
  EXAMPLE_BUSINESS_SHEET, 
  MODULE_MAPPINGS, 
  TONE_OPTIONS, 
  generatePromptBlock,
  getLocalBusinessSheet,
  saveLocalBusinessSheet
} from '@/lib/businessSheet';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/ThemeContext';
import { useBusinessSheet } from '@/lib/useBusinessSheet';
import { useToast } from '@/components/ToastProvider';

interface BusinessSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'form' | 'example' | 'map' | 'prompt';
  /** 'modal' abre em diálogo; 'page' renderiza embutido na página /ficha. */
  variant?: 'modal' | 'page';
}

export default function BusinessSheetModal({ isOpen, onClose, initialTab = 'form', variant = 'modal' }: BusinessSheetModalProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const toast = useToast();
  const isPage = variant === 'page';
  const active = isPage || isOpen;

  const [tab, setTab] = useState<'form' | 'example' | 'map' | 'prompt'>(initialTab);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  const {
    formData,
    loading,
    saveState,
    savedAt,
    error,
    save,
    updateField: handleFieldChange,
    updateColor: handleColorChange,
    copyPrompt,
    completeness,
    filledCount,
    totalFields,
  } = useBusinessSheet(active);

  const saving = saveState === 'saving';
  const saveSuccess = saveState === 'saved';

  useEffect(() => {
    if (active) setTab(initialTab);
  }, [active, initialTab]);

  // Fecha com Esc e trava a rolagem do fundo (o modal não fazia nem um nem outro)
  useEffect(() => {
    if (!isOpen || isPage) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, isPage, onClose]);

  useEffect(() => {
    if (error) toast.error('Não foi possível salvar sua ficha.', error);
  }, [error, toast]);

  const handleSave = async () => {
    const ok = await save();
    if (ok) toast.success('Ficha salva!');
  };

  const handleCopyPrompt = async () => {
    const ok = await copyPrompt();
    if (ok) {
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2500);
    } else {
      toast.error('Não foi possível copiar. Selecione o texto e use Ctrl+C.');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const panel = (
        <motion.div
          initial={isPage ? false : { opacity: 0, scale: 0.95, y: 10 }}
          animate={isPage ? undefined : { opacity: 1, scale: 1, y: 0 }}
          exit={isPage ? undefined : { opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className={`print-area relative w-full ${
            isPage ? 'max-w-4xl mx-auto' : 'max-w-4xl max-h-[90vh]'
          } flex flex-col rounded-3xl overflow-hidden shadow-2xl border ${
            isDark
              ? 'bg-[#121118] border-white/10 text-slate-100'
              : 'bg-white border-slate-200 text-slate-900'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className={`px-6 py-4 border-b flex items-center justify-between gap-4 shrink-0 ${
            isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-slate-50'
          }`}>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-primary font-mono">
                MÓDULO 1 · CURSO CANVA COM IA 2.0
              </span>
              <h2 className="text-xl sm:text-2xl font-bold font-display tracking-tight flex items-center gap-2">
                A ficha do seu negócio
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                title="Imprimir / Salvar PDF"
                className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                  isDark 
                    ? 'border-white/10 hover:bg-white/10 text-slate-300' 
                    : 'border-slate-200 hover:bg-slate-100 text-slate-700'
                }`}
              >
                <Printer className="size-4" />
                <span className="hidden sm:inline">Imprimir</span>
              </button>

              <button
                onClick={onClose}
                className={`p-2 rounded-xl transition-colors ${
                  isDark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-200 text-slate-600'
                }`}
              >
                <X className="size-5" />
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className={`px-6 py-2 border-b flex items-center gap-2 overflow-x-auto shrink-0 ${
            isDark ? 'border-white/10 bg-black/20' : 'border-slate-200 bg-slate-100/70'
          }`}>
            <button
              onClick={() => setTab('form')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                tab === 'form'
                  ? 'bg-primary text-white shadow-sm'
                  : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="size-3.5" />
              Minha Ficha
            </button>
            <button
              onClick={() => setTab('example')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                tab === 'example'
                  ? 'bg-primary text-white shadow-sm'
                  : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Briefcase className="size-3.5" />
              Exemplo Preenchido
            </button>
            <button
              onClick={() => setTab('map')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                tab === 'map'
                  ? 'bg-primary text-white shadow-sm'
                  : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="size-3.5" />
              Onde Cada Campo Volta
            </button>
            <button
              onClick={() => setTab('prompt')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                tab === 'prompt'
                  ? 'bg-primary text-white shadow-sm'
                  : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="size-3.5 text-accent-gold" />
              Gerador de Prompt IA
            </button>
          </div>

          {/* Completude e auto-save */}
          <div className={`px-4 sm:px-6 py-3 border-b flex flex-wrap items-center gap-3 ${
            isDark ? 'border-white/10' : 'border-slate-200'
          }`}>
            <div className="flex-1 min-w-[180px]">
              <div className="flex items-center justify-between text-[11px] font-bold mb-1.5">
                <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>
                  {filledCount} de {totalFields} campos preenchidos
                </span>
                <span className="text-primary font-mono">{completeness}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${completeness}%` }}
                  transition={{ duration: 0.5 }}
                  className="h-full rounded-full bg-gradient-to-r from-primary to-accent-gold"
                />
              </div>
            </div>

            <span className={`text-[11px] font-semibold shrink-0 ${
              saveState === 'error' ? 'text-red-400' : isDark ? 'text-slate-400' : 'text-slate-500'
            }`}>
              {saveState === 'saving'
                ? 'Salvando...'
                : saveState === 'error'
                  ? 'Erro ao salvar'
                  : savedAt
                    ? `Salvo às ${savedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                    : 'Salva sozinho enquanto você digita'}
            </span>
          </div>

          {/* Body Content */}
          <div className={`flex-1 p-4 sm:p-6 space-y-6 ${isPage ? '' : 'overflow-y-auto'}`}>
            {/* Tab: Form */}
            {tab === 'form' && (
              <div className="space-y-6">
                {/* PDF Subtitle & Alert Box */}
                <div>
                  <p className="text-sm font-medium text-slate-400 dark:text-slate-400">
                    Preencha uma vez. Esse negócio não muda até o último módulo.
                  </p>
                </div>

                {/* Callout box matching PDF styling */}
                <div className={`p-4 rounded-2xl border-l-4 border-l-amber-500 flex items-start gap-3 text-sm ${
                  isDark 
                    ? 'bg-amber-500/10 border border-white/5 text-amber-200' 
                    : 'bg-amber-50 border border-amber-200 text-amber-900'
                }`}>
                  <AlertCircle className="size-5 text-amber-500 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="font-bold">
                      Leva 2 minutos — e é a única tarefa do curso que você não pode pular.
                    </p>
                    <p className="text-xs opacity-90">
                      Travou num campo? Escreve o que vier à cabeça e segue. Dá pra ajustar depois.
                    </p>
                  </div>
                </div>

                {/* Form Fields */}
                <div className="space-y-5">
                  {/* 01 Nome do Negócio */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                      <span className="text-primary font-mono font-black text-sm">01</span>
                      <span>NOME DO NEGÓCIO</span>
                      <span className="text-xs font-normal lowercase italic text-slate-400">
                        como o cliente chama
                      </span>
                    </label>
                    <input
                      type="text"
                      value={formData.business_name}
                      onChange={(e) => handleFieldChange('business_name', e.target.value)}
                      placeholder="Ex: Confeitaria da Ana, Studio Beleza & Estilo, Consultoria Pro"
                      className={`w-full px-4 py-3 rounded-xl border text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                        isDark 
                          ? 'bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus:bg-white/10' 
                          : 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white'
                      }`}
                    />
                  </div>

                  {/* 02 Segmento & 03 O que você vende (2 Colunas) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* 02 Segmento */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                        <span className="text-primary font-mono font-black text-sm">02</span>
                        <span>SEGMENTO</span>
                        <span className="text-xs font-normal lowercase italic text-slate-400">
                          uma palavra
                        </span>
                      </label>
                      <input
                        type="text"
                        value={formData.segment}
                        onChange={(e) => handleFieldChange('segment', e.target.value)}
                        placeholder="Ex: confeitaria, estética, advocacia, moda"
                        className={`w-full px-4 py-3 rounded-xl border text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                          isDark 
                            ? 'bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus:bg-white/10' 
                            : 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white'
                        }`}
                      />
                    </div>

                    {/* 03 O que você vende */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                        <span className="text-primary font-mono font-black text-sm">03</span>
                        <span>O QUE VOCÊ VENDE</span>
                        <span className="text-xs font-normal lowercase italic text-slate-400">
                          o principal
                        </span>
                      </label>
                      <input
                        type="text"
                        value={formData.what_you_sell}
                        onChange={(e) => handleFieldChange('what_you_sell', e.target.value)}
                        placeholder="Ex: bolos artesanais para festas e encomendas"
                        className={`w-full px-4 py-3 rounded-xl border text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                          isDark 
                            ? 'bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus:bg-white/10' 
                            : 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white'
                        }`}
                      />
                    </div>
                  </div>

                  {/* 04 Para quem */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                      <span className="text-primary font-mono font-black text-sm">04</span>
                      <span>PARA QUEM</span>
                      <span className="text-xs font-normal lowercase italic text-slate-400">
                        quem é, o que precisa, o que atrapalha a vida dessa pessoa
                      </span>
                    </label>
                    <textarea
                      rows={3}
                      value={formData.target_audience}
                      onChange={(e) => handleFieldChange('target_audience', e.target.value)}
                      placeholder="Ex: mulheres de 25 a 45 anos que organizam a festa em casa e querem algo bonito sem ter que dar conta de fazer"
                      className={`w-full px-4 py-3 rounded-xl border text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none ${
                        isDark 
                          ? 'bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus:bg-white/10' 
                          : 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white'
                      }`}
                    />
                  </div>

                  {/* 05 O Principal Benefício */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                      <span className="text-primary font-mono font-black text-sm">05</span>
                      <span>O PRINCIPAL BENEFÍCIO</span>
                      <span className="text-xs font-normal lowercase italic text-slate-400">
                        complete: “com a gente, o cliente ganha…”
                      </span>
                    </label>
                    <textarea
                      rows={2}
                      value={formData.main_benefit}
                      onChange={(e) => handleFieldChange('main_benefit', e.target.value)}
                      placeholder="Ex: o bolo bonito da festa sem ela precisar cozinhar nem se preocupar"
                      className={`w-full px-4 py-3 rounded-xl border text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none ${
                        isDark 
                          ? 'bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus:bg-white/10' 
                          : 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white'
                      }`}
                    />
                  </div>

                  {/* 06 Tom de Voz */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                      <span className="text-primary font-mono font-black text-sm">06</span>
                      <span>TOM DE VOZ</span>
                      <span className="text-xs font-normal lowercase italic text-slate-400">
                        marque um
                      </span>
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                      {TONE_OPTIONS.map((t) => {
                        const isSelected = formData.tone_of_voice === t.id;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => handleFieldChange('tone_of_voice', t.id)}
                            className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                              isSelected
                                ? 'bg-primary/15 border-primary text-primary shadow-sm ring-1 ring-primary'
                                : isDark
                                  ? 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <div className="flex items-center justify-between w-full mb-1">
                              <span className="text-xs font-bold">{t.label}</span>
                              <div className={`size-4 rounded-full border flex items-center justify-center ${
                                isSelected ? 'border-primary bg-primary text-white' : 'border-slate-400'
                              }`}>
                                {isSelected && <Check className="size-3 stroke-[3]" />}
                              </div>
                            </div>
                            <span className="text-[10px] opacity-75 leading-tight">{t.desc}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 07 Cores da Marca */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                      <span className="text-primary font-mono font-black text-sm">07</span>
                      <span>CORES DA MARCA</span>
                      <span className="text-xs font-normal lowercase italic text-slate-400">
                        no máximo 3 — escreva o nome ou selecione a cor
                      </span>
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {[0, 1, 2].map((idx) => {
                        const color = formData.brand_colors[idx] || { name: '', hex: '#7311D4' };
                        return (
                          <div
                            key={idx}
                            className={`p-3 rounded-xl border flex items-center gap-3 ${
                              isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'
                            }`}
                          >
                            <div className="relative shrink-0">
                              <input
                                type="color"
                                value={color.hex || '#7311D4'}
                                onChange={(e) => handleColorChange(idx, 'hex', e.target.value)}
                                className="size-10 rounded-lg cursor-pointer border border-white/20 bg-transparent p-0 overflow-hidden"
                              />
                            </div>
                            <div className="flex-1 space-y-1">
                              <input
                                type="text"
                                value={color.name}
                                onChange={(e) => handleColorChange(idx, 'name', e.target.value)}
                                placeholder={`Cor ${idx + 1} (ex: Rosa)`}
                                className={`w-full bg-transparent text-xs font-bold focus:outline-none ${
                                  isDark ? 'text-white' : 'text-slate-900'
                                }`}
                              />
                              <span className="text-[10px] font-mono text-slate-400 block uppercase">
                                {color.hex || '#000000'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 08 Como o cliente fala com você */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                      <span className="text-primary font-mono font-black text-sm">08</span>
                      <span>COMO O CLIENTE FALA COM VOCÊ</span>
                      <span className="text-xs font-normal lowercase italic text-slate-400">
                        é a chamada que fecha toda peça do curso
                      </span>
                    </label>
                    <input
                      type="text"
                      value={formData.contact_channel}
                      onChange={(e) => handleFieldChange('contact_channel', e.target.value)}
                      placeholder="Ex: WhatsApp, Direct do Instagram, Link na bio, Site"
                      className={`w-full px-4 py-3 rounded-xl border text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                        isDark 
                          ? 'bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus:bg-white/10' 
                          : 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white'
                      }`}
                    />
                  </div>
                </div>

                {/* Footer buttons */}
                <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-white/10">
                  <div className="text-xs text-slate-400 flex items-center gap-1.5">
                    <Sparkles className="size-3.5 text-primary" />
                    <span>Deixe essa ficha salva para consultar durante as aulas e exercícios!</span>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex-1 sm:flex-none px-6 py-3 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-primary/25 transition-all"
                    >
                      <Save className="size-4" />
                      <span>{saving ? 'Salvando...' : saveSuccess ? 'Salvo com Sucesso!' : 'Salvar Ficha'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Example */}
            {tab === 'example' && (
              <div className="space-y-6">
                <div className={`p-4 rounded-2xl border ${
                  isDark ? 'bg-primary/10 border-primary/20 text-slate-300' : 'bg-primary/5 border-primary/20 text-slate-700'
                }`}>
                  <p className="text-xs font-bold text-primary uppercase tracking-wider mb-1">
                    Exemplo oficial do curso
                  </p>
                  <p className="text-sm">
                    <strong>Não copie</strong> — use apenas como régua para entender a quantidade de detalhe ideal em cada campo.
                  </p>
                </div>

                <div className={`rounded-2xl border p-6 space-y-4 ${
                  isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="border-b pb-3 border-white/10 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">01 NOME DO NEGÓCIO</span>
                    <span className="text-sm font-bold text-primary">{EXAMPLE_BUSINESS_SHEET.business_name}</span>
                  </div>

                  <div className="border-b pb-3 border-white/10 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">02 SEGMENTO</span>
                    <span className="text-sm font-medium">{EXAMPLE_BUSINESS_SHEET.segment}</span>
                  </div>

                  <div className="border-b pb-3 border-white/10 flex flex-col gap-1">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">03 O QUE VOCÊ VENDE</span>
                    <span className="text-sm font-medium">{EXAMPLE_BUSINESS_SHEET.what_you_sell}</span>
                  </div>

                  <div className="border-b pb-3 border-white/10 flex flex-col gap-1">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">04 PARA QUEM</span>
                    <span className="text-sm font-medium leading-relaxed">{EXAMPLE_BUSINESS_SHEET.target_audience}</span>
                  </div>

                  <div className="border-b pb-3 border-white/10 flex flex-col gap-1">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">05 PRINCIPAL BENEFÍCIO</span>
                    <span className="text-sm font-medium leading-relaxed">{EXAMPLE_BUSINESS_SHEET.main_benefit}</span>
                  </div>

                  <div className="border-b pb-3 border-white/10 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">06 TOM DE VOZ</span>
                    <span className="px-2.5 py-1 rounded-md bg-primary/20 text-primary text-xs font-bold">
                      {EXAMPLE_BUSINESS_SHEET.tone_of_voice}
                    </span>
                  </div>

                  <div className="border-b pb-3 border-white/10 flex flex-col gap-2">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">07 CORES DA MARCA</span>
                    <div className="flex flex-wrap items-center gap-3">
                      {EXAMPLE_BUSINESS_SHEET.brand_colors.map((c, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs font-medium">
                          <span className="size-4 rounded-full border border-white/20 shadow-sm" style={{ backgroundColor: c.hex }} />
                          <span>{c.name}</span>
                          <span className="text-[10px] font-mono text-slate-400">({c.hex})</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">08 COMO O CLIENTE FALA COM VOCÊ</span>
                    <span className="text-sm font-bold text-emerald-400">{EXAMPLE_BUSINESS_SHEET.contact_channel}</span>
                  </div>
                </div>

                <div className="text-center">
                  <button
                    onClick={() => setTab('form')}
                    className="px-6 py-2.5 rounded-xl bg-primary/20 hover:bg-primary/30 text-primary text-xs font-bold inline-flex items-center gap-2 transition-colors"
                  >
                    <span>Ir para Minha Ficha</span>
                    <ArrowRight className="size-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Tab: Map (Onde cada campo volta) */}
            {tab === 'map' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold font-display tracking-tight mb-1">
                    Por que essa ficha importa? Onde cada campo volta:
                  </h3>
                  <p className="text-xs text-slate-400">
                    Essa ficha não é aquecimento. Cada linha que você preenche reaparece em algum módulo — e é por isso que no Módulo 10 a campanha já vai estar quase pronta.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {MODULE_MAPPINGS.map((m, idx) => (
                    <div
                      key={idx}
                      className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-primary">{m.fieldNumber}</span>
                          <h4 className="text-sm font-bold">{m.field}</h4>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                            {m.tag}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          {m.description}
                        </p>
                      </div>

                      <div className="shrink-0 flex items-center gap-1.5 self-start sm:self-center">
                        <span className="text-[10px] uppercase font-bold text-slate-500">Módulos</span>
                        <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-mono font-bold">
                          {m.modules}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tab: Prompt IA Generator */}
            {tab === 'prompt' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold font-display tracking-tight flex items-center gap-2 mb-1">
                    <Sparkles className="size-5 text-accent-gold" />
                    Contexto Pronto para IA (Canva, ChatGPT, Claude)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Copie esse bloco para colar nas suas conversas com IA ou no gerador de texto do Canva para que a IA crie posts 100% personalizados para a sua marca.
                  </p>
                </div>

                <div className={`p-4 rounded-2xl border font-mono text-xs leading-relaxed relative ${
                  isDark ? 'bg-black/40 border-white/10 text-slate-200' : 'bg-slate-900 text-slate-100 border-slate-800'
                }`}>
                  <pre className="whitespace-pre-wrap font-mono">
                    {generatePromptBlock(formData)}
                  </pre>

                  <button
                    onClick={handleCopyPrompt}
                    className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-xs font-bold flex items-center gap-1.5 shadow-md transition-all"
                  >
                    {copiedPrompt ? (
                      <>
                        <Check className="size-3.5" />
                        <span>Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="size-3.5" />
                        <span>Copiar Bloco</span>
                      </>
                    )}
                  </button>
                </div>

                <div className={`p-4 rounded-2xl border text-xs flex items-start gap-3 ${
                  isDark ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-200' : 'bg-indigo-50 border-indigo-200 text-indigo-900'
                }`}>
                  <Sparkles className="size-4 text-indigo-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold mb-1">Dica de uso nas aulas:</p>
                    <p className="opacity-90">
                      Sempre que o exercício pedir para criar um prompt no Canva IA ou na nossa <strong>Conselheira IA (Lyra)</strong>, cole esse bloco no início da sua mensagem!
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
  );

  if (isPage) return panel;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center p-3 sm:p-6 overflow-y-auto bg-black/80 backdrop-blur-md"
          onClick={onClose}
        >
          {panel}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

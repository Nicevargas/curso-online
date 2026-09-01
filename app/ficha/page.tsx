'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { motion } from 'motion/react';
import { 
  FileText, Check, Copy, Sparkles, AlertCircle, 
  Printer, Save, ArrowRight, Layers, Palette, 
  Briefcase, CheckCircle2, RefreshCw, ExternalLink
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
import Link from 'next/link';

export default function FichaNegocioPage() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [tab, setTab] = useState<'form' | 'example' | 'map' | 'prompt'>('form');
  const [formData, setFormData] = useState<BusinessSheetData>(EMPTY_BUSINESS_SHEET);
  const [userId, setUserId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load user data on mount
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setLoading(true);
      const local = getLocalBusinessSheet();
      if (isMounted) setFormData(local);

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user && isMounted) {
          setUserId(user.id);
          
          // Tenta canva_business_sheets primeiro
          let { data: serverSheet } = await supabase
            .from('canva_business_sheets')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();

          if (!serverSheet) {
            const fallback = await supabase
              .from('business_sheets')
              .select('*')
              .eq('user_id', user.id)
              .maybeSingle();
            if (fallback.data) {
              serverSheet = fallback.data;
            }
          }

          if (serverSheet && isMounted) {
            const merged: BusinessSheetData = {
              business_name: serverSheet.business_name || local.business_name || '',
              segment: serverSheet.segment || local.segment || '',
              what_you_sell: serverSheet.what_you_sell || local.what_you_sell || '',
              target_audience: serverSheet.target_audience || local.target_audience || '',
              main_benefit: serverSheet.main_benefit || local.main_benefit || '',
              tone_of_voice: serverSheet.tone_of_voice || local.tone_of_voice || 'Amigável',
              brand_colors: Array.isArray(serverSheet.brand_colors) && serverSheet.brand_colors.length > 0 
                ? serverSheet.brand_colors 
                : local.brand_colors || EMPTY_BUSINESS_SHEET.brand_colors,
              contact_channel: serverSheet.contact_channel || local.contact_channel || 'WhatsApp',
            };
            setFormData(merged);
            saveLocalBusinessSheet(merged);
          }
        }
      } catch (err) {
        console.warn('Erro ao carregar dados do servidor:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleFieldChange = (field: keyof BusinessSheetData, value: any) => {
    const updated = { ...formData, [field]: value };
    setFormData(updated);
    saveLocalBusinessSheet(updated);
  };

  const handleColorChange = (index: number, key: 'name' | 'hex', value: string) => {
    const updatedColors = [...formData.brand_colors];
    if (!updatedColors[index]) {
      updatedColors[index] = { name: '', hex: '#7311D4' };
    }
    updatedColors[index] = { ...updatedColors[index], [key]: value };
    handleFieldChange('brand_colors', updatedColors);
  };

  const handleSave = async () => {
    setSaving(true);
    saveLocalBusinessSheet(formData);

    try {
      if (userId) {
        await fetch('/api/ficha', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, data: formData }),
        });
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) {
      console.warn('Salvo localmente:', e);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleCopyPrompt = () => {
    const promptText = generatePromptBlock(formData);
    navigator.clipboard.writeText(promptText);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <main className={`min-h-screen relative pb-28 transition-colors duration-200 ${
      isDark ? 'bg-[#000000] text-slate-100' : 'bg-[#f7f6f8] text-slate-900'
    }`}>
      <Header />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 sm:pt-10">
        {/* Top Breadcrumb & Badge */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[11px] font-extrabold uppercase tracking-widest font-mono">
              CURSO CANVA COM IA 2.0 · MÓDULO 1
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className={`px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all ${
                isDark 
                  ? 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-300' 
                  : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700 shadow-sm'
              }`}
            >
              <Printer className="size-4 text-primary" />
              <span>Imprimir / PDF</span>
            </button>

            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-primary/20 transition-all"
            >
              <Save className="size-4" />
              <span>{saving ? 'Salvando...' : saveSuccess ? 'Salvo!' : 'Salvar Ficha'}</span>
            </button>
          </div>
        </div>

        {/* Title Header */}
        <div className="mb-6">
          <h1 className="text-3xl sm:text-4xl font-bold font-display tracking-tight mb-2">
            A ficha do seu negócio
          </h1>
          <p className="text-base text-slate-500 dark:text-slate-400 font-medium">
            Preencha uma vez. Esse negócio não muda até o último módulo do curso de Canva.
          </p>
        </div>

        {/* Alert Callout Box (Fidelity to PDF) */}
        <div className={`p-4 sm:p-5 rounded-2xl border-l-4 border-l-amber-500 flex items-start gap-3.5 mb-8 ${
          isDark 
            ? 'bg-amber-500/10 border border-white/5 text-amber-200' 
            : 'bg-amber-50 border border-amber-200 text-amber-900 shadow-sm'
        }`}>
          <AlertCircle className="size-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-sm sm:text-base">
              Leva 2 minutos — e é a única tarefa do curso que você não pode pular.
            </p>
            <p className="text-xs sm:text-sm opacity-90">
              Travou num campo? Escreve o que vier à cabeça e segue. Dá pra ajustar depois.
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 mb-8 border-b border-white/10 pb-3 overflow-x-auto">
          <button
            onClick={() => setTab('form')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shrink-0 ${
              tab === 'form'
                ? 'bg-primary text-white shadow-sm'
                : isDark ? 'text-slate-400 hover:text-white bg-white/5' : 'text-slate-600 hover:text-slate-900 bg-white border border-slate-200'
            }`}
          >
            <FileText className="size-4" />
            Minha Ficha
          </button>

          <button
            onClick={() => setTab('example')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shrink-0 ${
              tab === 'example'
                ? 'bg-primary text-white shadow-sm'
                : isDark ? 'text-slate-400 hover:text-white bg-white/5' : 'text-slate-600 hover:text-slate-900 bg-white border border-slate-200'
            }`}
          >
            <Briefcase className="size-4" />
            Exemplo Preenchido
          </button>

          <button
            onClick={() => setTab('map')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shrink-0 ${
              tab === 'map'
                ? 'bg-primary text-white shadow-sm'
                : isDark ? 'text-slate-400 hover:text-white bg-white/5' : 'text-slate-600 hover:text-slate-900 bg-white border border-slate-200'
            }`}
          >
            <Layers className="size-4" />
            Onde Cada Campo Volta
          </button>

          <button
            onClick={() => setTab('prompt')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shrink-0 ${
              tab === 'prompt'
                ? 'bg-primary text-white shadow-sm'
                : isDark ? 'text-slate-400 hover:text-white bg-white/5' : 'text-slate-600 hover:text-slate-900 bg-white border border-slate-200'
            }`}
          >
            <Sparkles className="size-4 text-accent-gold" />
            Gerador de Prompt IA
          </button>
        </div>

        {/* Tab 1: Form */}
        {tab === 'form' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-6 sm:p-8 rounded-3xl border shadow-sm space-y-6 ${
              isDark ? 'bg-[#121118] border-white/10' : 'bg-white border-slate-200'
            }`}
          >
            {/* 01 Nome do Negócio */}
            <div className="space-y-2">
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
                placeholder="Ex: Confeitaria da Ana, Estúdio Belle, Consultoria Criativa"
                className={`w-full px-4 py-3.5 rounded-2xl border text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                  isDark 
                    ? 'bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus:bg-white/10' 
                    : 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white'
                }`}
              />
            </div>

            {/* 02 Segmento & 03 O que você vende */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* 02 Segmento */}
              <div className="space-y-2">
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
                  placeholder="Ex: confeitaria, advocacia, moda, estética"
                  className={`w-full px-4 py-3.5 rounded-2xl border text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                    isDark 
                      ? 'bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus:bg-white/10' 
                      : 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white'
                  }`}
                />
              </div>

              {/* 03 O que você vende */}
              <div className="space-y-2">
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
                  className={`w-full px-4 py-3.5 rounded-2xl border text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                    isDark 
                      ? 'bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus:bg-white/10' 
                      : 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white'
                  }`}
                />
              </div>
            </div>

            {/* 04 Para quem */}
            <div className="space-y-2">
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
                className={`w-full px-4 py-3.5 rounded-2xl border text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none ${
                  isDark 
                    ? 'bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus:bg-white/10' 
                    : 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white'
                }`}
              />
            </div>

            {/* 05 O Principal Benefício */}
            <div className="space-y-2">
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
                className={`w-full px-4 py-3.5 rounded-2xl border text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none ${
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
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {TONE_OPTIONS.map((t) => {
                  const isSelected = formData.tone_of_voice === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleFieldChange('tone_of_voice', t.id)}
                      className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                        isSelected
                          ? 'bg-primary/15 border-primary text-primary shadow-sm ring-2 ring-primary/40'
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
                      className={`p-3.5 rounded-2xl border flex items-center gap-3 ${
                        isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="relative shrink-0">
                        <input
                          type="color"
                          value={color.hex || '#7311D4'}
                          onChange={(e) => handleColorChange(idx, 'hex', e.target.value)}
                          className="size-11 rounded-xl cursor-pointer border border-white/20 bg-transparent p-0 overflow-hidden shadow-sm"
                        />
                      </div>
                      <div className="flex-1 space-y-1">
                        <input
                          type="text"
                          value={color.name}
                          onChange={(e) => handleColorChange(idx, 'name', e.target.value)}
                          placeholder={`Cor ${idx + 1} (ex: Rosa queimado)`}
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
            <div className="space-y-2">
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
                placeholder="Ex: WhatsApp, Direct do Instagram, Link na bio"
                className={`w-full px-4 py-3.5 rounded-2xl border text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                  isDark 
                    ? 'bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus:bg-white/10' 
                    : 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white'
                }`}
              />
            </div>

            {/* Action Bottom */}
            <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-white/10">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Sparkles className="size-4 text-primary" />
                <span>Essa ficha fica disponível para você consultar durante as aulas em <strong>/jornada</strong>.</span>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-primary hover:bg-primary/90 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-xl shadow-primary/30 transition-all"
                >
                  <Save className="size-4" />
                  <span>{saving ? 'Salvando...' : saveSuccess ? 'Salvo com Sucesso!' : 'Salvar Ficha do Negócio'}</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Tab 2: Example */}
        {tab === 'example' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className={`p-4 rounded-2xl border ${
              isDark ? 'bg-primary/10 border-primary/20 text-slate-300' : 'bg-primary/5 border-primary/20 text-slate-700'
            }`}>
              <p className="text-xs font-bold text-primary uppercase tracking-wider mb-1">
                Exemplo oficial do curso
              </p>
              <p className="text-sm">
                <strong>Não copie</strong> — use só como régua de quanto detalhe é suficiente.
              </p>
            </div>

            <div className={`p-6 sm:p-8 rounded-3xl border space-y-4 ${
              isDark ? 'bg-[#121118] border-white/10' : 'bg-white border-slate-200'
            }`}>
              <div className="border-b pb-3.5 border-white/10 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">01 NOME DO NEGÓCIO</span>
                <span className="text-base font-bold text-primary">{EXAMPLE_BUSINESS_SHEET.business_name}</span>
              </div>

              <div className="border-b pb-3.5 border-white/10 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">02 SEGMENTO</span>
                <span className="text-sm font-medium">{EXAMPLE_BUSINESS_SHEET.segment}</span>
              </div>

              <div className="border-b pb-3.5 border-white/10 flex flex-col gap-1">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">03 O QUE VOCÊ VENDE</span>
                <span className="text-sm font-medium">{EXAMPLE_BUSINESS_SHEET.what_you_sell}</span>
              </div>

              <div className="border-b pb-3.5 border-white/10 flex flex-col gap-1">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">04 PARA QUEM</span>
                <span className="text-sm font-medium leading-relaxed">{EXAMPLE_BUSINESS_SHEET.target_audience}</span>
              </div>

              <div className="border-b pb-3.5 border-white/10 flex flex-col gap-1">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">05 PRINCIPAL BENEFÍCIO</span>
                <span className="text-sm font-medium leading-relaxed">{EXAMPLE_BUSINESS_SHEET.main_benefit}</span>
              </div>

              <div className="border-b pb-3.5 border-white/10 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">06 TOM DE VOZ</span>
                <span className="px-3 py-1 rounded-lg bg-primary/20 text-primary text-xs font-bold">
                  {EXAMPLE_BUSINESS_SHEET.tone_of_voice}
                </span>
              </div>

              <div className="border-b pb-3.5 border-white/10 flex flex-col gap-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">07 CORES DA MARCA</span>
                <div className="flex flex-wrap items-center gap-4">
                  {EXAMPLE_BUSINESS_SHEET.brand_colors.map((c, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs font-medium">
                      <span className="size-5 rounded-full border border-white/20 shadow-sm" style={{ backgroundColor: c.hex }} />
                      <span>{c.name}</span>
                      <span className="text-[11px] font-mono text-slate-400">({c.hex})</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">08 COMO O CLIENTE FALA COM VOCÊ</span>
                <span className="text-sm font-bold text-emerald-400">{EXAMPLE_BUSINESS_SHEET.contact_channel}</span>
              </div>
            </div>
          </motion.div>
        )}

        {/* Tab 3: Map */}
        {tab === 'map' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className={`p-6 rounded-3xl border ${
              isDark ? 'bg-[#121118] border-white/10' : 'bg-white border-slate-200'
            }`}>
              <h3 className="text-xl font-bold font-display tracking-tight mb-2">
                Por que essa ficha importa? Onde cada campo volta:
              </h3>
              <p className="text-sm text-slate-400 mb-6">
                Essa ficha não é aquecimento. Cada linha que você preenche reaparece em algum módulo — e é por isso que no Módulo 10 a campanha já vai estar quase pronta.
              </p>

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
                      <span className="px-3 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-mono font-bold">
                        {m.modules}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Tab 4: Prompt Generator */}
        {tab === 'prompt' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className={`p-6 sm:p-8 rounded-3xl border space-y-6 ${
              isDark ? 'bg-[#121118] border-white/10' : 'bg-white border-slate-200'
            }`}>
              <div>
                <h3 className="text-xl font-bold font-display tracking-tight flex items-center gap-2 mb-1">
                  <Sparkles className="size-5 text-accent-gold" />
                  Contexto Pronto para IA (Canva, ChatGPT, Claude)
                </h3>
                <p className="text-xs text-slate-400">
                  Copie o bloco abaixo e cole nos seus prompts para que a IA gere imagens, títulos e copies com a identidade exata da sua marca.
                </p>
              </div>

              <div className={`p-5 rounded-2xl border font-mono text-xs leading-relaxed relative ${
                isDark ? 'bg-black/60 border-white/10 text-slate-200' : 'bg-slate-950 text-slate-100 border-slate-800'
              }`}>
                <pre className="whitespace-pre-wrap font-mono text-xs sm:text-sm">
                  {generatePromptBlock(formData)}
                </pre>

                <button
                  onClick={handleCopyPrompt}
                  className="absolute top-4 right-4 px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-bold flex items-center gap-2 shadow-lg transition-all"
                >
                  {copiedPrompt ? (
                    <>
                      <Check className="size-4" />
                      <span>Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="size-4" />
                      <span>Copiar Bloco</span>
                    </>
                  )}
                </button>
              </div>

              <div className={`p-4 rounded-2xl border text-xs flex items-start gap-3 ${
                isDark ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-200' : 'bg-indigo-50 border-indigo-200 text-indigo-900'
              }`}>
                <Sparkles className="size-5 text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold mb-1">Como usar durante as aulas:</p>
                  <p className="opacity-90 leading-relaxed">
                    Sempre que for gerar um carrossel no Canva com Magic Write ou usar nossa <strong>Conselheira IA</strong>, cole esse contexto. Assim, todo conteúdo criado sairá pronto para o seu cliente final!
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      <BottomNav />
    </main>
  );
}

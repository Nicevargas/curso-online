'use client';

import { FileEdit, CheckCircle2, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '@/lib/supabase';

export default function EvolutionDiary() {
  const [reflection, setReflection] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    if (!reflection.trim()) return;

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { error } = await supabase
        .from('diary_entries')
        .insert({
          user_id: user.id,
          content: reflection,
          mood: 'neutral' // Default mood
        });

      if (error) throw error;

      setSaved(true);
      setReflection('');
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('Erro ao salvar reflexão:', err);
      alert('Erro ao salvar sua reflexão. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="px-4 py-6 lg:px-0 lg:py-0">
      <div className="flex items-center gap-2 mb-4">
        <FileEdit className="size-5 text-primary" />
        <h2 className="text-slate-100 text-xl font-bold tracking-tight font-display">Diário de Evolução</h2>
      </div>
      
      <div className="relative">
        <textarea 
          value={reflection}
          onChange={(e) => setReflection(e.target.value)}
          disabled={saving}
          className="w-full min-h-[140px] lg:min-h-[200px] bg-[#251b33] border border-primary/20 rounded-2xl p-4 text-sm text-slate-200 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all placeholder:text-slate-600 resize-none disabled:opacity-50" 
          placeholder="Como você se sentiu hoje ao assumir sua nova identidade?"
        />
        
        <AnimatePresence>
          {saved && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="absolute inset-0 flex items-center justify-center bg-[#251b33]/80 backdrop-blur-sm rounded-2xl z-10"
            >
              <div className="flex flex-col items-center gap-2 text-primary">
                <CheckCircle2 className="size-12" />
                <span className="font-bold text-sm uppercase tracking-widest">Reflexão Salva!</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      <motion.button 
        onClick={handleSave}
        disabled={saving || !reflection.trim()}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.98 }}
        className="w-full mt-4 bg-primary text-white py-4 rounded-2xl font-bold text-sm tracking-widest shadow-xl shadow-primary/30 uppercase flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saving ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Salvando...
          </>
        ) : (
          'Salvar Reflexão'
        )}
      </motion.button>
    </section>
  );
}

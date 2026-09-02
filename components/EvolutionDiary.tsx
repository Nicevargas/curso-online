'use client';

import { FileEdit, Loader2, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/ThemeContext';
import { useSession } from '@/lib/SessionContext';
import { useToast } from '@/components/ToastProvider';

interface Entry {
  id: string;
  content: string;
  mood: string | null;
  created_at: string;
}

const MOODS = [
  { key: 'animada', emoji: '🤩', label: 'Animada' },
  { key: 'feliz', emoji: '😊', label: 'Feliz' },
  { key: 'neutral', emoji: '😌', label: 'Tranquila' },
  { key: 'cansada', emoji: '😴', label: 'Cansada' },
  { key: 'desafiada', emoji: '😤', label: 'Desafiada' },
];

export default function EvolutionDiary() {
  const { theme } = useTheme();
  const { user } = useSession();
  const toast = useToast();
  const isDark = theme === 'dark';

  const [reflection, setReflection] = useState('');
  const [mood, setMood] = useState('neutral');
  const [saving, setSaving] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(true);

  const loadEntries = useCallback(async (userId: string) => {
    setLoadingEntries(true);
    const { data, error } = await supabase
      .from('diary_entries')
      .select('id, content, mood, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);
    if (error) console.warn('Não foi possível carregar o diário:', error.message);
    setEntries((data as Entry[]) || []);
    setLoadingEntries(false);
  }, []);

  useEffect(() => {
    if (user?.id) loadEntries(user.id);
    else setLoadingEntries(false);
  }, [user?.id, loadEntries]);

  const handleSave = async () => {
    if (!reflection.trim() || !user) return;

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('diary_entries')
        .insert({ user_id: user.id, content: reflection.trim(), mood })
        .select('id, content, mood, created_at')
        .single();

      if (error) throw error;

      setEntries((prev) => [data as Entry, ...prev].slice(0, 10));
      setReflection('');
      setMood('neutral');
      toast.success('Registro salvo no seu diário.');
    } catch (err: any) {
      console.error('Erro ao salvar reflexão:', err);
      toast.error('Não foi possível salvar sua reflexão.', err?.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const previous = entries;
    setEntries((prev) => prev.filter((e) => e.id !== id));
    const { error } = await supabase.from('diary_entries').delete().eq('id', id);
    if (error) {
      setEntries(previous);
      toast.error('Não foi possível excluir o registro.');
    }
  };

  const card = isDark ? 'bg-white/[0.03] border-white/10' : 'bg-white border-slate-200 shadow-sm';
  const soft = isDark ? 'text-slate-400' : 'text-slate-600';

  return (
    <section className={`rounded-3xl border p-5 ${card}`}>
      <div className="flex items-center gap-2 mb-1">
        <FileEdit className="size-5 text-primary" />
        <h2 className={`text-base font-bold font-display ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
          Diário de Evolução
        </h2>
      </div>
      <p className={`text-xs mb-4 ${soft}`}>Como foi seu estudo hoje? Registre aprendizados e ideias.</p>

      {/* Humor */}
      <div className="flex items-center gap-1.5 mb-3">
        {MOODS.map((m) => (
          <button
            key={m.key}
            onClick={() => setMood(m.key)}
            title={m.label}
            aria-label={m.label}
            className={`size-9 rounded-xl text-lg transition-all cursor-pointer border ${
              mood === m.key
                ? 'border-primary bg-primary/15 scale-110'
                : isDark
                  ? 'border-white/10 hover:bg-white/5'
                  : 'border-slate-200 hover:bg-slate-50'
            }`}
          >
            {m.emoji}
          </button>
        ))}
      </div>

      <textarea
        value={reflection}
        onChange={(e) => setReflection(e.target.value)}
        placeholder="O que você aprendeu ou criou hoje?"
        rows={3}
        className={`w-full rounded-2xl p-3 text-sm outline-none border resize-none focus:border-primary/50 transition-colors ${
          isDark
            ? 'bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-500'
            : 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400'
        }`}
      />

      <button
        onClick={handleSave}
        disabled={saving || !reflection.trim()}
        className="w-full mt-3 py-2.5 rounded-2xl bg-primary text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-40 cursor-pointer"
      >
        {saving && <Loader2 className="size-4 animate-spin" />}
        {saving ? 'Salvando...' : 'Salvar registro'}
      </button>

      {/* Histórico — antes a aluna escrevia e nunca mais via o que escreveu */}
      <div className="mt-5 pt-4 border-t border-white/5">
        <h3 className={`text-[11px] font-bold uppercase tracking-widest mb-3 ${soft}`}>Seus registros</h3>

        {loadingEntries ? (
          <div className="space-y-2">
            {[0, 1].map((i) => (
              <div key={i} className="h-12 rounded-xl bg-slate-500/10 animate-pulse" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <p className="text-xs text-slate-500">Nenhum registro ainda. O primeiro pode ser hoje!</p>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            <AnimatePresence initial={false}>
              {entries.map((entry) => {
                const emoji = MOODS.find((m) => m.key === entry.mood)?.emoji || '📝';
                return (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    className={`group rounded-2xl p-3 text-xs ${isDark ? 'bg-white/5' : 'bg-slate-50'}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="text-base leading-none">{emoji}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400">
                          {new Date(entry.created_at).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                          })}
                        </span>
                        <button
                          onClick={() => handleDelete(entry.id)}
                          aria-label="Excluir registro"
                          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-400 transition-all cursor-pointer"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                    </div>
                    <p className={`leading-relaxed whitespace-pre-line ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      {entry.content}
                    </p>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </section>
  );
}

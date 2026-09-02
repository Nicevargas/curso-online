'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Plus,
  Check,
  Trash2,
  Calendar,
  X,
  ListChecks,
  Flag,
  CheckCircle2,
  CalendarClock,
} from 'lucide-react';

import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/ThemeContext';
import { useSession } from '@/lib/SessionContext';
import { useToast } from '@/components/ToastProvider';

interface Task {
  id: string;
  title: string;
  category: string;
  priority: 'alta' | 'media' | 'baixa';
  due_date: string | null;
  completed: boolean;
  created_at: string;
}

const CATEGORIES = ['Estudo', 'Criação', 'Publicação', 'Negócio', 'Pessoal'];

const PRIORITIES: Array<{ key: Task['priority']; label: string; className: string }> = [
  { key: 'alta', label: 'Alta', className: 'bg-red-500/15 text-red-400 border-red-500/30' },
  { key: 'media', label: 'Média', className: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  { key: 'baixa', label: 'Baixa', className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
];

const todayISO = () => new Date().toISOString().slice(0, 10);

function formatDue(date: string | null) {
  if (!date) return null;
  const today = todayISO();
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  if (date === today) return { label: 'Hoje', late: false };
  if (date === tomorrow) return { label: 'Amanhã', late: false };
  const late = date < today;
  return {
    label: new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
    late,
  };
}

export default function PlannerPage() {
  const { theme } = useTheme();
  const { user, loading: sessionLoading } = useSession();
  const toast = useToast();
  const isDark = theme === 'dark';

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('todas');
  const [modalOpen, setModalOpen] = useState(false);

  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState(CATEGORIES[0]);
  const [newPriority, setNewPriority] = useState<Task['priority']>('media');
  const [newDue, setNewDue] = useState(todayISO());
  const [saving, setSaving] = useState(false);

  // ---------- Dados no Supabase (antes ficavam só no localStorage do navegador) ----------
  const loadTasks = useCallback(async (userId: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('planner_tasks')
      .select('*')
      .eq('user_id', userId)
      .order('completed', { ascending: true })
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao carregar tarefas:', error);
      toast.error('Não foi possível carregar suas tarefas.', error.message);
    }
    setTasks((data as Task[]) || []);
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    if (sessionLoading) return;
    if (!user) {
      window.location.href = '/login';
      return;
    }
    loadTasks(user.id);
  }, [sessionLoading, user, loadTasks]);

  // ---------- Ações ----------
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !user) return;

    setSaving(true);
    const { data, error } = await supabase
      .from('planner_tasks')
      .insert({
        user_id: user.id,
        title: newTitle.trim(),
        category: newCategory,
        priority: newPriority,
        due_date: newDue || null,
      })
      .select()
      .single();

    setSaving(false);

    if (error) {
      toast.error('Não foi possível criar a tarefa.', error.message);
      return;
    }

    setTasks((prev) => [data as Task, ...prev]);
    setNewTitle('');
    setNewPriority('media');
    setNewDue(todayISO());
    setModalOpen(false);
    toast.success('Tarefa adicionada ao seu planner.');
  };

  const handleToggle = async (task: Task) => {
    const next = !task.completed;
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, completed: next } : t)));

    const { error } = await supabase.from('planner_tasks').update({ completed: next }).eq('id', task.id);
    if (error) {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, completed: !next } : t)));
      toast.error('Não foi possível atualizar a tarefa.');
      return;
    }

    if (next) {
      const remaining = tasks.filter((t) => !t.completed && t.id !== task.id).length;
      if (remaining === 0) {
        toast.celebrate();
        toast.reward('Tudo concluído! 🎉', 'Sua lista está zerada. Que tal registrar isso no diário?');
      }
    }
  };

  const handleDelete = async (task: Task) => {
    const previous = tasks;
    setTasks((prev) => prev.filter((t) => t.id !== task.id));

    const { error } = await supabase.from('planner_tasks').delete().eq('id', task.id);
    if (error) {
      setTasks(previous);
      toast.error('Não foi possível excluir a tarefa.');
      return;
    }

    toast.toast('Tarefa excluída.', {
      kind: 'info',
      detail: task.title,
    });
  };

  // ---------- Derivados ----------
  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (filter === 'pending' && t.completed) return false;
      if (filter === 'completed' && !t.completed) return false;
      if (categoryFilter !== 'todas' && t.category !== categoryFilter) return false;
      return true;
    });
  }, [tasks, filter, categoryFilter]);

  const todayTasks = useMemo(() => tasks.filter((t) => t.due_date === todayISO()), [tasks]);
  const todayDone = todayTasks.filter((t) => t.completed).length;
  const todayPercent = todayTasks.length > 0 ? Math.round((todayDone / todayTasks.length) * 100) : 0;
  const lateCount = tasks.filter((t) => !t.completed && t.due_date && t.due_date < todayISO()).length;

  const card = isDark ? 'bg-white/[0.03] border-white/10' : 'bg-white border-slate-200 shadow-sm';
  const soft = isDark ? 'text-slate-400' : 'text-slate-600';

  return (
    <main
      className={`min-h-screen relative pb-28 transition-colors duration-200 ${
        isDark ? 'bg-[#000000] text-slate-100' : 'bg-[#f7f6f8] text-slate-900'
      }`}
    >
      <Header />

      <div className="max-w-3xl mx-auto px-4 py-6 sm:py-8">
        {/* Cabeçalho + progresso do dia */}
        <section className={`rounded-3xl border p-5 sm:p-6 mb-6 ${card}`}>
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <span className="px-2.5 py-0.5 rounded-full bg-primary/20 text-primary text-[10px] font-extrabold uppercase tracking-widest font-mono">
                Planner
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight mt-2">Metas & Tarefas</h1>
              <p className={`text-sm mt-1 ${soft}`}>
                {todayTasks.length === 0
                  ? 'Nada marcado para hoje. Que tal planejar um passo?'
                  : todayPercent === 100
                    ? 'Você concluiu tudo o que planejou para hoje! 🎉'
                    : `${todayDone} de ${todayTasks.length} tarefas de hoje concluídas.`}
              </p>
            </div>
            <button
              onClick={() => setModalOpen(true)}
              className="shrink-0 size-11 rounded-2xl bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/25 hover:bg-primary/90 transition-all cursor-pointer"
              aria-label="Nova tarefa"
            >
              <Plus className="size-5" />
            </button>
          </div>

          {todayTasks.length > 0 && (
            <div className="mb-4">
              <div className="w-full h-2.5 rounded-full bg-white/10 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${todayPercent}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                  className="h-full rounded-full bg-gradient-to-r from-primary to-accent-purple"
                />
              </div>
            </div>
          )}

          {lateCount > 0 && (
            <div className="flex items-center gap-2 text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-2xl px-3 py-2 mb-4">
              <CalendarClock className="size-4" />
              {lateCount} {lateCount === 1 ? 'tarefa atrasada' : 'tarefas atrasadas'}
            </div>
          )}

          {/* Filtros */}
          <div className="flex flex-wrap gap-2">
            {([
              { key: 'all', label: 'Todas' },
              { key: 'pending', label: 'Pendentes' },
              { key: 'completed', label: 'Concluídas' },
            ] as const).map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer ${
                  filter === f.key
                    ? 'bg-primary text-white border-primary'
                    : isDark
                      ? 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {f.label}
              </button>
            ))}

            <span className={`mx-1 self-center ${soft}`}>·</span>

            {/* Filtro por categoria — existia no estado e não tinha interface */}
            <button
              onClick={() => setCategoryFilter('todas')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer ${
                categoryFilter === 'todas'
                  ? 'bg-primary/15 text-primary border-primary/40'
                  : isDark
                    ? 'bg-white/5 border-white/10 text-slate-300'
                    : 'bg-white border-slate-200 text-slate-600'
              }`}
            >
              Tudo
            </button>
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCategoryFilter(c)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer ${
                  categoryFilter === c
                    ? 'bg-primary/15 text-primary border-primary/40'
                    : isDark
                      ? 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </section>

        {/* Lista */}
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className={`h-20 rounded-3xl border animate-pulse ${card}`} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className={`p-12 rounded-3xl border border-dashed text-center ${card}`}>
            <ListChecks className="size-10 text-slate-400 mx-auto mb-3" />
            <p className="text-sm text-slate-500 mb-3">
              {tasks.length === 0
                ? 'Seu planner está vazio. Crie a primeira tarefa!'
                : 'Nenhuma tarefa neste filtro.'}
            </p>
            <button
              onClick={() => (tasks.length === 0 ? setModalOpen(true) : (setFilter('all'), setCategoryFilter('todas')))}
              className="text-xs font-bold text-primary hover:underline cursor-pointer"
            >
              {tasks.length === 0 ? 'Criar tarefa' : 'Limpar filtros'}
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            <AnimatePresence initial={false}>
              {filtered.map((task) => {
                const due = formatDue(task.due_date);
                const priority = PRIORITIES.find((p) => p.key === task.priority) || PRIORITIES[1];
                return (
                  <motion.div
                    key={task.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                    className={`group rounded-3xl border p-4 flex items-start gap-3 transition-colors ${card} ${
                      task.completed ? 'opacity-60' : ''
                    }`}
                  >
                    <button
                      onClick={() => handleToggle(task)}
                      aria-label={task.completed ? 'Marcar como pendente' : 'Marcar como concluída'}
                      className={`size-6 rounded-lg border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all cursor-pointer ${
                        task.completed
                          ? 'bg-emerald-500 border-emerald-500 text-white'
                          : isDark
                            ? 'border-white/20 hover:border-primary'
                            : 'border-slate-300 hover:border-primary'
                      }`}
                    >
                      {task.completed && <Check className="size-4" />}
                    </button>

                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold leading-snug ${task.completed ? 'line-through' : ''}`}>
                        {task.title}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                            isDark ? 'bg-white/5 border-white/10 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'
                          }`}
                        >
                          {task.category}
                        </span>
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${priority.className}`}>
                          {priority.label}
                        </span>
                        {due && (
                          <span
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border flex items-center gap-1 ${
                              due.late && !task.completed
                                ? 'bg-red-500/15 text-red-400 border-red-500/30'
                                : isDark
                                  ? 'bg-white/5 border-white/10 text-slate-400'
                                  : 'bg-slate-50 border-slate-200 text-slate-500'
                            }`}
                          >
                            <Calendar className="size-3" />
                            {due.label}
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => handleDelete(task)}
                      aria-label="Excluir tarefa"
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-slate-400 hover:text-red-400 transition-all shrink-0 cursor-pointer"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Modal nova tarefa */}
      <AnimatePresence>
        {modalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setModalOpen(false)}
          >
            <motion.form
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 30, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              onSubmit={handleCreate}
              className={`w-full max-w-md rounded-3xl border p-6 shadow-2xl ${
                isDark ? 'bg-[#0f0b15] border-white/10' : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold font-display">Nova tarefa</h2>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  aria-label="Fechar"
                  className={`p-1.5 rounded-lg cursor-pointer ${isDark ? 'hover:bg-white/10' : 'hover:bg-slate-100'}`}
                >
                  <X className="size-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className={`text-[10px] font-bold uppercase tracking-widest ${soft}`}>O que fazer</label>
                  <input
                    autoFocus
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Ex: Criar carrossel do módulo 3"
                    maxLength={300}
                    className={`w-full mt-1.5 rounded-2xl p-3 text-sm outline-none border focus:border-primary/50 ${
                      isDark ? 'bg-white/5 border-white/10 text-slate-100' : 'bg-slate-50 border-slate-200'
                    }`}
                  />
                </div>

                <div>
                  <label className={`text-[10px] font-bold uppercase tracking-widest ${soft}`}>Categoria</label>
                  <div className="flex flex-wrap gap-2 mt-1.5">
                    {CATEGORIES.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setNewCategory(c)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          newCategory === c
                            ? 'bg-primary text-white border-primary'
                            : isDark
                              ? 'bg-white/5 border-white/10 text-slate-300'
                              : 'bg-white border-slate-200 text-slate-600'
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Prioridade: existia no código e nunca teve campo nem aparecia */}
                <div>
                  <label className={`text-[10px] font-bold uppercase tracking-widest ${soft}`}>Prioridade</label>
                  <div className="flex gap-2 mt-1.5">
                    {PRIORITIES.map((p) => (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => setNewPriority(p.key)}
                        className={`flex-1 px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          newPriority === p.key ? p.className : isDark ? 'bg-white/5 border-white/10 text-slate-400' : 'bg-white border-slate-200 text-slate-500'
                        }`}
                      >
                        <Flag className="size-3.5" />
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Data real (antes era texto "Hoje"/"Amanhã" e nada vencia) */}
                <div>
                  <label className={`text-[10px] font-bold uppercase tracking-widest ${soft}`}>Prazo</label>
                  <input
                    type="date"
                    value={newDue}
                    onChange={(e) => setNewDue(e.target.value)}
                    className={`w-full mt-1.5 rounded-2xl p-3 text-sm outline-none border focus:border-primary/50 ${
                      isDark ? 'bg-white/5 border-white/10 text-slate-100' : 'bg-slate-50 border-slate-200'
                    }`}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={saving || !newTitle.trim()}
                className="w-full mt-6 py-3.5 rounded-2xl bg-primary text-white font-bold text-sm hover:bg-primary/90 transition-colors disabled:opacity-40 flex items-center justify-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="size-4" />
                {saving ? 'Salvando...' : 'Adicionar ao planner'}
              </button>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNav />
    </main>
  );
}

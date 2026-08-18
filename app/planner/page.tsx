'use client';

import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CheckSquare, Plus, Calendar, Clock, Sparkles, Trash2, 
  Tag, Filter, CheckCircle2, Circle, AlertCircle, Layers, 
  Palette, Video, Image as ImageIcon, BookOpen, Flame
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Task {
  id: string;
  title: string;
  category: 'carrossel' | 'video' | 'post' | 'story' | 'marca' | 'estudo';
  priority: 'alta' | 'media' | 'baixa';
  dueDate: string;
  completed: boolean;
  createdAt: string;
}

const CATEGORY_MAP: Record<string, { label: string; icon: any; color: string }> = {
  carrossel: { label: 'Carrossel Canva', icon: Layers, color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
  video: { label: 'Vídeo / Reels', icon: Video, color: 'text-pink-400 bg-pink-500/10 border-pink-500/20' },
  post: { label: 'Post / Feed', icon: ImageIcon, color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  story: { label: 'Stories / Banner', icon: Sparkles, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  marca: { label: 'Identidade Visual', icon: Palette, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  estudo: { label: 'Estudo do Curso', icon: BookOpen, color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
};

const DEFAULT_TASKS: Task[] = [
  {
    id: '1',
    title: 'Criar primeiro Carrossel de 5 slides com IA no Canva',
    category: 'carrossel',
    priority: 'alta',
    dueDate: 'Hoje',
    completed: false,
    createdAt: new Date().toISOString()
  },
  {
    id: '2',
    title: 'Gerar 3 imagens fotorealistas no Magic Media',
    category: 'post',
    priority: 'alta',
    dueDate: 'Hoje',
    completed: true,
    createdAt: new Date().toISOString()
  },
  {
    id: '3',
    title: 'Definir paleta de cores e tipografia no Brand Kit',
    category: 'marca',
    priority: 'media',
    dueDate: 'Amanhã',
    completed: false,
    createdAt: new Date().toISOString()
  },
  {
    id: '4',
    title: 'Assistir aula do Desafio e aplicar o exercício prático',
    category: 'estudo',
    priority: 'alta',
    dueDate: 'Esta semana',
    completed: false,
    createdAt: new Date().toISOString()
  }
];

export default function PlannerPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'todas' | 'pendentes' | 'concluidas'>('todas');
  const [selectedCategory, setSelectedCategory] = useState<string>('todas');
  
  // New task form state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<Task['category']>('carrossel');
  const [newPriority, setNewPriority] = useState<Task['priority']>('alta');
  const [newDueDate, setNewDueDate] = useState('Hoje');

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = '/login';
        return;
      }

      // Load tasks from localStorage
      try {
        const saved = localStorage.getItem(`canva_planner_tasks_${user.id}`);
        if (saved) {
          setTasks(JSON.parse(saved));
        } else {
          setTasks(DEFAULT_TASKS);
          localStorage.setItem(`canva_planner_tasks_${user.id}`, JSON.stringify(DEFAULT_TASKS));
        }
      } catch {
        setTasks(DEFAULT_TASKS);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  const saveTasks = async (updatedTasks: Task[]) => {
    setTasks(updatedTasks);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        localStorage.setItem(`canva_planner_tasks_${user.id}`, JSON.stringify(updatedTasks));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleTask = (taskId: string) => {
    const updated = tasks.map(t => 
      t.id === taskId ? { ...t, completed: !t.completed } : t
    );
    saveTasks(updated);
  };

  const handleDeleteTask = (taskId: string) => {
    const updated = tasks.filter(t => t.id !== taskId);
    saveTasks(updated);
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newTask: Task = {
      id: Date.now().toString(),
      title: newTitle.trim(),
      category: newCategory,
      priority: newPriority,
      dueDate: newDueDate || 'Sem data',
      completed: false,
      createdAt: new Date().toISOString()
    };

    saveTasks([newTask, ...tasks]);
    setNewTitle('');
    setShowAddModal(false);
  };

  const completedCount = tasks.filter(t => t.completed).length;
  const pendingCount = tasks.length - completedCount;
  const progressPercent = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  const filteredTasks = tasks.filter(t => {
    if (filter === 'pendentes' && t.completed) return false;
    if (filter === 'concluidas' && !t.completed) return false;
    if (selectedCategory !== 'todas' && t.category !== selectedCategory) return false;
    return true;
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
        {/* Page Title & Action */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-2xl bg-gradient-to-tr from-primary to-accent-purple/50 flex items-center justify-center border border-primary/30 shadow-lg shadow-primary/20">
              <CheckSquare className="size-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-100 font-display">Planner de Tarefas</h1>
              <p className="text-xs text-slate-400">Organize sua rotina de criação no Canva com IA</p>
            </div>
          </div>

          <button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-primary hover:bg-primary/90 text-white font-semibold text-xs tracking-wider uppercase transition-all shadow-lg shadow-primary/20 cursor-pointer"
          >
            <Plus className="size-4" />
            Nova Tarefa
          </button>
        </div>

        {/* Overview Stats Card */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pendentes</span>
              <p className="text-2xl font-bold text-slate-100 mt-1">{pendingCount}</p>
            </div>
            <div className="size-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Clock className="size-5" />
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Concluídas</span>
              <p className="text-2xl font-bold text-emerald-400 mt-1">{completedCount}</p>
            </div>
            <div className="size-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="size-5" />
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Progresso Geral</span>
              <span className="text-sm font-bold text-accent-gold">{progressPercent}%</span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-2 mt-3 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-primary to-accent-gold h-full rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          {/* Status Tabs */}
          <div className="flex items-center p-1 bg-white/5 border border-white/10 rounded-2xl">
            {(['todas', 'pendentes', 'concluidas'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all capitalize ${
                  filter === tab
                    ? 'bg-primary text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab === 'todas' ? 'Todas' : tab === 'pendentes' ? 'Pendentes' : 'Concluídas'}
              </button>
            ))}
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setSelectedCategory('todas')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all whitespace-nowrap ${
                selectedCategory === 'todas'
                  ? 'bg-primary/20 border-primary text-primary'
                  : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200'
              }`}
            >
              Todas Categorias
            </button>
            {Object.entries(CATEGORY_MAP).map(([key, value]) => (
              <button
                key={key}
                onClick={() => setSelectedCategory(key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  selectedCategory === key
                    ? 'bg-primary/20 border-primary text-primary'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200'
                }`}
              >
                <value.icon className="size-3" />
                {value.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tasks List */}
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {filteredTasks.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-16 bg-white/5 border border-dashed border-white/10 rounded-3xl"
              >
                <CheckSquare className="size-10 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400 text-sm font-medium">Nenhuma tarefa encontrada neste filtro.</p>
                <p className="text-slate-600 text-xs mt-1">Clique em &ldquo;Nova Tarefa&rdquo; para adicionar seus objetivos no Canva.</p>
              </motion.div>
            ) : (
              filteredTasks.map((task) => {
                const categoryInfo = CATEGORY_MAP[task.category] || CATEGORY_MAP.carrossel;
                const CategoryIcon = categoryInfo.icon;

                return (
                  <motion.div
                    key={task.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className={`flex items-center justify-between p-4 sm:p-5 rounded-2xl border transition-all ${
                      task.completed
                        ? 'bg-white/[0.02] border-white/5 opacity-60'
                        : 'bg-white/5 border-white/10 hover:border-primary/40 hover:bg-white/[0.07]'
                    }`}
                  >
                    <div className="flex items-start sm:items-center gap-3.5 flex-1 min-w-0">
                      <button
                        onClick={() => handleToggleTask(task.id)}
                        className={`size-6 rounded-lg border-2 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0 transition-all ${
                          task.completed
                            ? 'bg-emerald-500 border-emerald-500 text-white'
                            : 'border-slate-500 hover:border-primary text-transparent'
                        }`}
                      >
                        <CheckCircle2 className="size-4" />
                      </button>

                      <div className="flex-1 min-w-0 pr-3">
                        <p className={`text-sm font-medium leading-relaxed truncate ${
                          task.completed ? 'line-through text-slate-500' : 'text-slate-200'
                        }`}>
                          {task.title}
                        </p>

                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-semibold border ${categoryInfo.color}`}>
                            <CategoryIcon className="size-3" />
                            {categoryInfo.label}
                          </span>

                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] text-slate-400 bg-white/5 border border-white/5">
                            <Calendar className="size-2.5" />
                            {task.dueDate}
                          </span>

                          {task.priority === 'alta' && (
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold text-red-400 bg-red-500/10 border border-red-500/20">
                              Alta
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteTask(task.id)}
                      className="p-2 rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                      title="Excluir tarefa"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Add Task Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setShowAddModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg bg-[#111111] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-100 font-display">Adicionar Nova Tarefa</h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/5"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleAddTask} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    Título da Tarefa
                  </label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Ex: Criar carrossel sobre prompts de IA"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-slate-100 focus:outline-none focus:border-primary/50 transition-colors"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                      Categoria
                    </label>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value as any)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-slate-200 focus:outline-none focus:border-primary/50 transition-colors"
                    >
                      <option value="carrossel" className="bg-[#111111]">Carrossel Canva</option>
                      <option value="video" className="bg-[#111111]">Vídeo / Reels</option>
                      <option value="post" className="bg-[#111111]">Post / Feed</option>
                      <option value="story" className="bg-[#111111]">Stories / Banner</option>
                      <option value="marca" className="bg-[#111111]">Identidade Visual</option>
                      <option value="estudo" className="bg-[#111111]">Estudo do Curso</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                      Prioridade
                    </label>
                    <select
                      value={newPriority}
                      onChange={(e) => setNewPriority(e.target.value as any)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-slate-200 focus:outline-none focus:border-primary/50 transition-colors"
                    >
                      <option value="alta" className="bg-[#111111]">Alta Prioridade</option>
                      <option value="media" className="bg-[#111111]">Média</option>
                      <option value="baixa" className="bg-[#111111]">Baixa</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    Prazo / Dia
                  </label>
                  <input
                    type="text"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    placeholder="Ex: Hoje, Amanhã, 20/08"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-slate-100 focus:outline-none focus:border-primary/50 transition-colors"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-5 py-3 rounded-2xl text-xs font-bold text-slate-400 hover:text-white uppercase tracking-wider transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-3 rounded-2xl bg-primary hover:bg-primary/90 text-white text-xs font-bold uppercase tracking-wider transition-all shadow-lg shadow-primary/20"
                  >
                    Salvar Tarefa
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNav />
    </main>
  );
}

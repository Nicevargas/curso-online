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
import { useTheme } from '@/lib/ThemeContext';

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
    title: 'Assistir aula de edição mágica de vídeo no Canva',
    category: 'estudo',
    priority: 'baixa',
    dueDate: 'Esta Semana',
    completed: false,
    createdAt: new Date().toISOString()
  }
];

export default function PlannerPage() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);

  // Form State
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<Task['category']>('carrossel');
  const [newPriority, setNewPriority] = useState<Task['priority']>('media');
  const [newDueDate, setNewDueDate] = useState('Hoje');

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = '/login';
        return;
      }

      // Load from localStorage or defaults
      const savedTasks = localStorage.getItem(`planner_tasks_${user.id}`);
      if (savedTasks) {
        try {
          setTasks(JSON.parse(savedTasks));
        } catch (e) {
          setTasks(DEFAULT_TASKS);
        }
      } else {
        setTasks(DEFAULT_TASKS);
      }
      setLoading(false);
    }

    init();
  }, []);

  const saveTasks = (updated: Task[]) => {
    setTasks(updated);
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        localStorage.setItem(`planner_tasks_${user.id}`, JSON.stringify(updated));
      }
    });
  };

  const handleToggleTask = (id: string) => {
    const updated = tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
    saveTasks(updated);
  };

  const handleDeleteTask = (id: string) => {
    const updated = tasks.filter(t => t.id !== id);
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
      dueDate: newDueDate,
      completed: false,
      createdAt: new Date().toISOString()
    };

    saveTasks([newTask, ...tasks]);
    setNewTitle('');
    setShowAddModal(false);
  };

  const filteredTasks = tasks.filter(t => {
    const matchesFilter = filter === 'all' ? true : filter === 'completed' ? t.completed : !t.completed;
    const matchesCategory = selectedCategory === 'all' ? true : t.category === selectedCategory;
    return matchesFilter && matchesCategory;
  });

  const completedCount = tasks.filter(t => t.completed).length;
  const pendingCount = tasks.length - completedCount;

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
        {/* Page Title & Action */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-2xl bg-gradient-to-tr from-primary to-accent-purple/50 flex items-center justify-center border border-primary/30 shadow-lg shadow-primary/20">
              <CheckSquare className="size-6 text-white" />
            </div>
            <div>
              <h1 className={`text-2xl font-bold font-display ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                Planner de Tarefas
              </h1>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Organize sua rotina de criação no Canva com IA
              </p>
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
          <div className={`border rounded-2xl p-5 flex items-center justify-between ${
            isDark ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pendentes</span>
              <p className={`text-2xl font-bold mt-1 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{pendingCount}</p>
            </div>
            <div className="size-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Clock className="size-5" />
            </div>
          </div>

          <div className={`border rounded-2xl p-5 flex items-center justify-between ${
            isDark ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Concluídas</span>
              <p className={`text-2xl font-bold mt-1 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{completedCount}</p>
            </div>
            <div className="size-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="size-5" />
            </div>
          </div>

          <div className={`border rounded-2xl p-5 flex items-center justify-between ${
            isDark ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total de Metas</span>
              <p className={`text-2xl font-bold mt-1 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{tasks.length}</p>
            </div>
            <div className="size-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Sparkles className="size-5" />
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className={`flex items-center gap-1.5 p-1 rounded-2xl border w-fit ${
            isDark ? 'bg-white/5 border-white/10' : 'bg-slate-100 border-slate-200'
          }`}>
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                filter === 'all' 
                  ? 'bg-primary text-white shadow-md' 
                  : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todas ({tasks.length})
            </button>
            <button
              onClick={() => setFilter('pending')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                filter === 'pending' 
                  ? 'bg-primary text-white shadow-md' 
                  : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Pendentes ({pendingCount})
            </button>
            <button
              onClick={() => setFilter('completed')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                filter === 'completed' 
                  ? 'bg-primary text-white shadow-md' 
                  : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Concluídas ({completedCount})
            </button>
          </div>
        </div>

        {/* Tasks List */}
        <div className="space-y-3">
          {filteredTasks.length === 0 ? (
            <div className={`p-12 text-center rounded-3xl border border-dashed ${
              isDark ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'
            }`}>
              <CheckSquare className="size-10 text-slate-400 mx-auto mb-3" />
              <p className="text-sm text-slate-500">Nenhuma tarefa encontrada neste filtro.</p>
            </div>
          ) : (
            filteredTasks.map((task) => {
              const cat = CATEGORY_MAP[task.category] || CATEGORY_MAP.carrossel;
              const CatIcon = cat.icon;
              return (
                <motion.div
                  key={task.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-4 sm:p-5 rounded-2xl border transition-all flex items-center justify-between gap-4 ${
                    task.completed 
                      ? 'border-emerald-500/20 bg-emerald-500/5 opacity-75' 
                      : isDark ? 'bg-white/5 border-white/10 hover:border-primary/40' : 'bg-white border-slate-200 shadow-sm hover:border-primary/40'
                  }`}
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <button
                      onClick={() => handleToggleTask(task.id)}
                      className="shrink-0 transition-transform active:scale-90 cursor-pointer"
                    >
                      {task.completed ? (
                        <CheckCircle2 className="size-6 text-emerald-400" />
                      ) : (
                        <Circle className="size-6 text-slate-400 hover:text-primary transition-colors" />
                      )}
                    </button>

                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-medium transition-all truncate ${
                        task.completed 
                          ? 'line-through text-slate-400' 
                          : isDark ? 'text-slate-100' : 'text-slate-900'
                      }`}>
                        {task.title}
                      </p>
                      
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1 uppercase tracking-wider ${cat.color}`}>
                          <CatIcon className="size-3" />
                          {cat.label}
                        </span>
                        
                        <span className={`text-[10px] font-semibold flex items-center gap-1 ${
                          isDark ? 'text-slate-400' : 'text-slate-500'
                        }`}>
                          <Calendar className="size-3" />
                          {task.dueDate}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDeleteTask(task.id)}
                    className="p-2 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0 cursor-pointer"
                    title="Excluir tarefa"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </motion.div>
              );
            })
          )}
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
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-lg border rounded-3xl p-6 sm:p-8 shadow-2xl ${
                isDark ? 'bg-[#121214] border-white/10 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
              }`}
            >
              <h2 className="text-xl font-bold font-display mb-4">Adicionar Nova Tarefa</h2>
              
              <form onSubmit={handleAddTask} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Título da Tarefa
                  </label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Ex: Criar carrossel sobre gatilhos mentais..."
                    className={`w-full px-4 py-3 rounded-xl text-sm border outline-none ${
                      isDark ? 'bg-white/5 border-white/10 text-slate-100 focus:border-primary' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-primary'
                    }`}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      Categoria
                    </label>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value as any)}
                      className={`w-full px-4 py-3 rounded-xl text-sm border outline-none ${
                        isDark ? 'bg-[#1e1e24] border-white/10 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-900'
                      }`}
                    >
                      <option value="carrossel">Carrossel Canva</option>
                      <option value="video">Vídeo / Reels</option>
                      <option value="post">Post / Feed</option>
                      <option value="story">Stories / Banner</option>
                      <option value="marca">Identidade Visual</option>
                      <option value="estudo">Estudo do Curso</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      Prazo
                    </label>
                    <select
                      value={newDueDate}
                      onChange={(e) => setNewDueDate(e.target.value)}
                      className={`w-full px-4 py-3 rounded-xl text-sm border outline-none ${
                        isDark ? 'bg-[#1e1e24] border-white/10 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-900'
                      }`}
                    >
                      <option value="Hoje">Hoje</option>
                      <option value="Amanhã">Amanhã</option>
                      <option value="Esta Semana">Esta Semana</option>
                      <option value="Próxima Semana">Próxima Semana</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/5">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className={`px-5 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                      isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-bold uppercase tracking-wider shadow-md shadow-primary/20"
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

'use client';

import { Home, Sparkles, Users, MessageSquare, LayoutGrid, ShieldCheck, CheckSquare, Lightbulb, User, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { useSession } from '@/lib/SessionContext';
import { useTheme } from '@/lib/ThemeContext';

const MAIN_ITEMS = [
  { icon: Home, label: 'Início', href: '/' },
  { icon: Sparkles, label: 'Jornada', href: '/jornada' },
  { icon: Users, label: 'Mentoria', href: '/comunidade' },
];

/** Páginas que antes não estavam em nenhum menu e ficavam praticamente inacessíveis. */
const MORE_ITEMS = [
  { icon: MessageSquare, label: 'Mentora IA', href: '/lyra', desc: 'Tire dúvidas e crie prompts' },
  { icon: Lightbulb, label: 'Prompts & Dicas', href: '/dicas', desc: 'Fórmulas prontas para copiar' },
  { icon: CheckSquare, label: 'Planner', href: '/planner', desc: 'Metas e tarefas de estudo' },
  { icon: LayoutGrid, label: 'Ficha do Negócio', href: '/ficha', desc: 'Sua marca em um só lugar' },
  { icon: User, label: 'Perfil', href: '/perfil', desc: 'Conquistas e configurações' },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { isAdmin } = useSession();
  const { theme } = useTheme();
  const [moreOpen, setMoreOpen] = useState(false);

  const isDark = theme === 'dark';
  const moreActive = MORE_ITEMS.some((i) => pathname === i.href) || pathname === '/admin';

  const items = [
    ...MAIN_ITEMS,
    ...(isAdmin ? [{ icon: ShieldCheck, label: 'Admin', href: '/admin' }] : []),
  ];

  return (
    <>
      <AnimatePresence>
        {moreOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-end justify-center"
            onClick={() => setMoreOpen(false)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-md rounded-t-3xl border-t border-x p-5 pb-28 ${
                isDark ? 'bg-[#0f0b15] border-white/10 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold font-display">Mais recursos</h3>
                <button
                  onClick={() => setMoreOpen(false)}
                  aria-label="Fechar"
                  className={`p-1.5 rounded-lg cursor-pointer ${isDark ? 'hover:bg-white/10' : 'hover:bg-slate-100'}`}
                >
                  <X className="size-5" />
                </button>
              </div>

              <div className="space-y-2">
                {MORE_ITEMS.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className={`flex items-center gap-3 p-3 rounded-2xl border transition-colors ${
                      pathname === item.href
                        ? 'border-primary/50 bg-primary/10'
                        : isDark
                          ? 'border-white/10 hover:bg-white/5'
                          : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span className="size-10 rounded-xl bg-primary/15 border border-primary/25 text-primary flex items-center justify-center shrink-0">
                      <item.icon className="size-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-bold">{item.label}</span>
                      <span className={`block text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{item.desc}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <nav
        className={`fixed bottom-0 left-0 right-0 z-[70] flex justify-center border-t backdrop-blur-xl px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 transition-colors ${
          isDark ? 'border-primary/10 bg-black/90' : 'border-slate-200 bg-[#f7f6f8]/95'
        }`}
      >
        <div className="flex w-full max-w-md gap-1">
          {items.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-1 flex-col items-center justify-center gap-1 transition-colors relative ${
                  isActive ? 'text-primary' : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'
                }`}
              >
                <item.icon className={`size-6 ${isActive ? 'fill-primary/20' : ''}`} />
                <span className="text-[10px] font-bold uppercase tracking-widest">{item.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute -top-3 left-1/2 -translate-x-1/2 size-1 bg-primary rounded-full shadow-[0_0_8px_rgba(115,17,212,0.8)]"
                  />
                )}
              </Link>
            );
          })}

          <button
            onClick={() => setMoreOpen(true)}
            className={`flex flex-1 flex-col items-center justify-center gap-1 transition-colors relative cursor-pointer ${
              moreActive ? 'text-primary' : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'
            }`}
          >
            <LayoutGrid className={`size-6 ${moreActive ? 'fill-primary/20' : ''}`} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Mais</span>
          </button>
        </div>
      </nav>
    </>
  );
}

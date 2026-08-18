'use client';

import { motion } from 'motion/react';
import Link from 'next/link';
import MistikaLogo from '@/components/Logo';
import { useTheme } from '@/lib/ThemeContext';
import { Sun, Moon } from 'lucide-react';

export default function Header() {
  const { theme, toggleTheme } = useTheme();

  const isDark = theme === 'dark';

  return (
    <motion.header 
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className={`sticky top-0 z-50 transition-colors border-b ${
        isDark 
          ? 'bg-[#000000] border-white/10 text-white' 
          : 'bg-[#f7f6f8] border-slate-200 text-slate-900'
      }`}
    >
      <div className="max-w-5xl mx-auto flex items-center px-4 py-2 sm:py-3 justify-between">
        <div className="flex size-10 shrink-0 items-center justify-start">
        </div>
        <Link href="/" className="hover:opacity-90 transition-opacity flex items-center justify-center">
          <MistikaLogo size="md" />
        </Link>
        <div className="flex size-10 items-center justify-end">
          <button
            onClick={toggleTheme}
            aria-label="Alternar tema Dark / Light"
            title={isDark ? 'Mudar para modo Claro' : 'Mudar para modo Escuro'}
            className={`p-2 rounded-2xl border hover:scale-105 active:scale-95 transition-all shadow-sm ${
              isDark
                ? 'bg-white/5 border-white/10 text-slate-200 hover:bg-white/10'
                : 'bg-black/5 border-black/10 text-slate-700 hover:bg-black/10'
            }`}
          >
            {isDark ? (
              <Sun className="size-4 text-accent-gold" />
            ) : (
              <Moon className="size-4 text-primary" />
            )}
          </button>
        </div>
      </div>
    </motion.header>
  );
}

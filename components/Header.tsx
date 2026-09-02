'use client';

import { motion } from 'motion/react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import MistikaLogo from '@/components/Logo';
import { useTheme } from '@/lib/ThemeContext';
import { useSession } from '@/lib/SessionContext';
import { getDirectDriveLink } from '@/lib/utils';
import { Sun, Moon, ArrowLeft, Flame, Star } from 'lucide-react';

export default function Header({ showBack = false }: { showBack?: boolean }) {
  const { theme, toggleTheme } = useTheme();
  const { profile } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const isDark = theme === 'dark';
  const isHome = pathname === '/';
  const canGoBack = showBack || !isHome;

  const points = profile?.points ?? 0;
  const streak = profile?.streak ?? 0;
  const avatar = getDirectDriveLink(profile?.avatar_url);
  const name = profile?.name || 'Aluna';

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className={`sticky top-0 z-50 transition-colors border-b backdrop-blur-xl ${
        isDark ? 'bg-black/85 border-white/10 text-white' : 'bg-[#f7f6f8]/90 border-slate-200 text-slate-900'
      }`}
    >
      <div className="max-w-6xl mx-auto flex items-center gap-3 px-4 py-2 sm:py-2.5">
        {/* Voltar */}
        <div className="w-10 shrink-0 flex justify-start">
          {canGoBack && (
            <button
              onClick={() => router.back()}
              aria-label="Voltar"
              className={`p-2 rounded-xl transition-colors cursor-pointer ${
                isDark ? 'hover:bg-white/10 text-slate-300' : 'hover:bg-black/5 text-slate-600'
              }`}
            >
              <ArrowLeft className="size-5" />
            </button>
          )}
        </div>

        <Link href="/" className="hover:opacity-90 transition-opacity flex items-center justify-center flex-1">
          <MistikaLogo size="md" />
        </Link>

        <div className="flex items-center gap-2 shrink-0">
          {/* Pontos e sequência — antes esses números existiam no banco e não apareciam */}
          {(points > 0 || streak > 0) && (
            <Link
              href="/perfil"
              title={`${points} pontos · ${streak} dias de sequência`}
              className={`hidden xs:flex sm:flex items-center gap-2 px-2.5 py-1.5 rounded-full border text-[11px] font-bold transition-colors ${
                isDark ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-white border-slate-200 hover:bg-slate-50'
              }`}
            >
              {streak > 0 && (
                <span className="flex items-center gap-1 text-orange-500">
                  <Flame className="size-3.5" />
                  {streak}
                </span>
              )}
              <span className="flex items-center gap-1 text-primary">
                <Star className="size-3.5 fill-primary" />
                {points}
              </span>
            </Link>
          )}

          <button
            onClick={toggleTheme}
            aria-label="Alternar tema claro/escuro"
            className={`p-2 rounded-xl border transition-all hover:scale-105 active:scale-95 cursor-pointer ${
              isDark ? 'bg-white/5 border-white/10 text-slate-200 hover:bg-white/10' : 'bg-black/5 border-black/10 text-slate-700 hover:bg-black/10'
            }`}
          >
            {isDark ? <Sun className="size-4 text-accent-gold" /> : <Moon className="size-4 text-primary" />}
          </button>

          <Link href="/perfil" aria-label="Meu perfil" className="shrink-0">
            <div className="size-9 rounded-full overflow-hidden relative border-2 border-primary/30 hover:border-primary transition-colors">
              <Image
                src={avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=7311d4&color=fff`}
                alt={name}
                fill
                className="object-cover"
                referrerPolicy="no-referrer"
                unoptimized
              />
            </div>
          </Link>
        </div>
      </div>
    </motion.header>
  );
}

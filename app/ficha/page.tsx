'use client';

import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import BusinessSheetModal from '@/components/BusinessSheetModal';
import { useTheme } from '@/lib/ThemeContext';

/**
 * Página da Ficha do Negócio.
 *
 * O formulário vive em <BusinessSheetModal variant="page" /> — antes esta página e o
 * modal eram o mesmo componente copiado (cerca de 700 linhas duplicadas em cada um),
 * e qualquer correção precisava ser feita duas vezes.
 */
export default function FichaPage() {
  const { theme } = useTheme();
  const router = useRouter();
  const isDark = theme === 'dark';

  return (
    <main
      className={`min-h-screen relative pb-28 transition-colors duration-200 ${
        isDark ? 'bg-[#000000] text-slate-100' : 'bg-[#f7f6f8] text-slate-900'
      }`}
    >
      <Header />

      <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8">
        <BusinessSheetModal isOpen variant="page" onClose={() => router.push('/')} />
      </div>

      <BottomNav />
    </main>
  );
}

'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/SessionContext';

export type ThemeMode = 'dark' | 'light';

interface ThemeContextType {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  setTheme: () => {},
  toggleTheme: () => {},
});

function applyTheme(mode: ThemeMode) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.toggle('dark', mode === 'dark');
  root.classList.toggle('light', mode === 'light');
  root.style.colorScheme = mode;
}

/**
 * O tema vem do localStorage (aplicado antes do primeiro paint pelo script do layout)
 * e é sincronizado com o perfil que o SessionProvider já carregou — sem uma segunda
 * consulta ao Supabase e sem o flash escuro→claro que existia antes.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useSession();
  const syncedFor = useRef<string | null>(null);

  const [theme, setThemeState] = useState<ThemeMode>(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('app_theme') === 'light') return 'light';
    return 'dark';
  });

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Sincroniza uma vez com a preferência salva no perfil
  useEffect(() => {
    if (!profile?.id || syncedFor.current === profile.id) return;
    syncedFor.current = profile.id;

    const saved = profile.theme;
    if (saved === 'dark' || saved === 'light') {
      setThemeState(saved);
      try {
        localStorage.setItem('app_theme', saved);
      } catch {}
    }
  }, [profile?.id, profile?.theme]);

  const setTheme = useCallback(
    (newTheme: ThemeMode) => {
      setThemeState(newTheme);
      applyTheme(newTheme);
      try {
        localStorage.setItem('app_theme', newTheme);
      } catch {}

      if (user?.id) {
        supabase
          .from('profiles')
          .update({ theme: newTheme })
          .eq('id', user.id)
          .then(({ error }) => {
            if (error) console.warn('Não foi possível salvar o tema no perfil:', error.message);
          });
      }
    },
    [user?.id]
  );

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  return <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { isAdminRole, hasPaidAccess } from './roles';

export interface Profile {
  id: string;
  name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  role?: string | null;
  level?: number | null;
  status?: string | null;
  points?: number | null;
  streak?: number | null;
  plan?: string | null;
  plan_expires_at?: string | null;
  is_paid?: boolean | null;
  journey_id?: string | null;
  theme?: string | null;
  created_at?: string | null;
}

interface SessionValue {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  isAdmin: boolean;
  hasAccess: boolean;
  refreshProfile: () => Promise<void>;
  /** Atualiza o perfil em memória (ex.: após ganhar pontos) sem nova consulta. */
  patchProfile: (patch: Partial<Profile>) => void;
}

const SessionContext = createContext<SessionValue>({
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
  hasAccess: false,
  refreshProfile: async () => {},
  patchProfile: () => {},
});

/**
 * Uma única leitura de sessão + perfil para todo o app.
 *
 * Antes, SubscriptionGuard, ThemeContext e BottomNav faziam cada um o seu
 * `auth.getUser()` + consulta em `profiles` a cada navegação — três idas ao servidor
 * antes de qualquer tela aparecer.
 */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const loadedFor = useRef<string | null>(null);

  const loadProfile = useCallback(async (userId: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    setProfile((data as Profile) || null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user?.id) await loadProfile(user.id);
  }, [user?.id, loadProfile]);

  const patchProfile = useCallback((patch: Partial<Profile>) => {
    setProfile((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  useEffect(() => {
    let active = true;

    async function init() {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!active) return;

        setUser(authUser);
        if (authUser && loadedFor.current !== authUser.id) {
          loadedFor.current = authUser.id;
          await loadProfile(authUser.id);
        }
      } catch (err) {
        // Sem conexão com o Supabase: seguimos como visitante em vez de travar
        // o app na tela de carregamento.
        console.error('Não foi possível ler a sessão:', err);
      } finally {
        if (active) setLoading(false);
      }
    }

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        loadedFor.current = null;
        setUser(null);
        setProfile(null);
        return;
      }
      const nextUser = session?.user || null;
      setUser(nextUser);
      if (nextUser && loadedFor.current !== nextUser.id) {
        loadedFor.current = nextUser.id;
        loadProfile(nextUser.id);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  const value = useMemo<SessionValue>(
    () => ({
      user,
      profile,
      loading,
      isAdmin: isAdminRole(profile?.role),
      hasAccess: hasPaidAccess(profile),
      refreshProfile,
      patchProfile,
    }),
    [user, profile, loading, refreshProfile, patchProfile]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}

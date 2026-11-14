import type { Session } from '@supabase/supabase-js';
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import type { Character } from '@/game/rules';
import { isConfigured, supabase } from '@/lib/supabase';

type AuthState = {
  configured: boolean;
  loading: boolean;
  session: Session | null;
  character: Character | null;
  refreshCharacter: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [character, setCharacter] = useState<Character | null>(null);
  const [loading, setLoading] = useState(isConfigured);

  const loadCharacter = useCallback(async (s: Session | null) => {
    if (!s) {
      setCharacter(null);
      return;
    }
    const { data } = await supabase().from('characters').select('*').eq('user_id', s.user.id).maybeSingle();
    setCharacter((data as Character) ?? null);
  }, []);

  useEffect(() => {
    if (!isConfigured) return;
    let active = true;
    supabase()
      .auth.getSession()
      .then(async ({ data }) => {
        if (!active) return;
        setSession(data.session);
        await loadCharacter(data.session);
        if (active) setLoading(false);
      });
    const { data: sub } = supabase().auth.onAuthStateChange((_event, s) => {
      setSession(s);
      // Don't await Supabase calls inside this callback (it can deadlock the auth lock).
      setTimeout(() => loadCharacter(s), 0);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [loadCharacter]);

  const value: AuthState = {
    configured: isConfigured,
    loading,
    session,
    character,
    refreshCharacter: () => loadCharacter(session),
    signOut: async () => {
      await supabase().auth.signOut();
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
}

import type { Session } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { Profile } from "@brabus/shared";
import { getProfile } from "@brabus/supabase";

import { supabase } from "@/lib/supabase";

type AuthState = {
  /** true mientras se recupera la sesión guardada al abrir la app. */
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const loadProfile = useCallback(async (s: Session | null) => {
    setProfile(s ? await getProfile(supabase, s.user.id) : null);
  }, []);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      await loadProfile(data.session);
      if (active) setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      // Fuera del callback para no bloquear el cliente de auth.
      setTimeout(() => loadProfile(s), 0);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const value = useMemo<AuthState>(
    () => ({
      loading,
      session,
      profile,
      signOut: async () => {
        await supabase.auth.signOut();
      },
      refreshProfile: () => loadProfile(session),
    }),
    [loading, session, profile, loadProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}

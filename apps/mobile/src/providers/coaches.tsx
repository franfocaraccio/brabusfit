import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AppState } from "react-native";

import { getMyCoaches, type MyCoach } from "@brabus/supabase";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/auth";

type CoachesState = {
  /** Coaches del alumno (activos + invitaciones). Vacío para coaches. */
  coaches: MyCoach[];
  pending: MyCoach[];
  refresh: () => Promise<void>;
};

const CoachesContext = createContext<CoachesState | null>(null);

/** Coaches e invitaciones del alumno (badge en Perfil, aviso en Inicio, popup). */
export function CoachesProvider({ children }: { children: ReactNode }) {
  const { session, profile } = useAuth();
  const [coaches, setCoaches] = useState<MyCoach[]>([]);
  const userId = session?.user.id;
  const isCoach = profile?.is_coach ?? false;

  const fetchCoaches = useCallback(
    () =>
      userId && !isCoach ? getMyCoaches(supabase, userId) : Promise.resolve([]),
    [userId, isCoach],
  );

  const refresh = useCallback(async () => {
    setCoaches(await fetchCoaches());
  }, [fetchCoaches]);

  useEffect(() => {
    let active = true;
    const load = () => fetchCoaches().then((c) => active && setCoaches(c));
    load();
    // Al volver a la app (por ejemplo, después de que el coach lo agregó).
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") load();
    });
    return () => {
      active = false;
      sub.remove();
    };
  }, [fetchCoaches]);

  const value = useMemo<CoachesState>(
    () => ({
      coaches,
      pending: coaches.filter((c) => c.status === "pending"),
      refresh,
    }),
    [coaches, refresh],
  );
  return (
    <CoachesContext.Provider value={value}>{children}</CoachesContext.Provider>
  );
}

export function useCoaches(): CoachesState {
  const ctx = useContext(CoachesContext);
  if (!ctx)
    throw new Error("useCoaches debe usarse dentro de <CoachesProvider>");
  return ctx;
}

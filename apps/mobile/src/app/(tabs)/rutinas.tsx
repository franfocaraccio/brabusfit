import { useLocalSearchParams } from "expo-router";
import { useState } from "react";

import { MyProgress } from "@/components/my-progress";
import { PlansBrowser } from "@/components/plans-browser";
import { Segmented } from "@/components/segmented";
import { useAuth } from "@/providers/auth";

type View = "routines" | "progress";

/**
 * Pestaña "Entrenamiento" del alumno: rutinas y progreso con un selector arriba
 * (igual que la web). El coach no entrena: ve solo "Rutinas".
 */
export default function EntrenamientoScreen() {
  const { profile } = useAuth();
  // ?vista=progreso abre directo en Progreso.
  const { vista } = useLocalSearchParams<{ vista?: string }>();
  const [view, setView] = useState<View>(
    vista === "progreso" ? "progress" : "routines",
  );
  // Si la pestaña ya estaba abierta y se llega con otro ?vista=, se cambia.
  const [lastVista, setLastVista] = useState(vista);
  if (vista !== lastVista) {
    setLastVista(vista);
    if (vista === "progreso") setView("progress");
  }

  const header = (
    <Segmented
      fill
      value={view}
      onChange={setView}
      options={[
        { value: "routines", label: "Rutinas" },
        { value: "progress", label: "Progreso" },
      ]}
    />
  );

  if (profile?.is_coach) return <PlansBrowser kind="routines" />;

  return view === "progress" ? (
    <MyProgress header={header} />
  ) : (
    <PlansBrowser kind="routines" header={header} />
  );
}

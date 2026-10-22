import { useLocalSearchParams } from "expo-router";
import { useState } from "react";

import { MyProgress } from "@/components/my-progress";
import { PlansBrowser } from "@/components/plans-browser";
import { Segmented } from "@/components/segmented";

type View = "routines" | "progress";

/** Pestaña "Entrenamiento": rutinas y progreso con un selector arriba (igual que la web). */
export default function EntrenamientoScreen() {
  // ?vista=progreso abre directo en Progreso.
  const { vista } = useLocalSearchParams<{ vista?: string }>();
  const [view, setView] = useState<View>(vista === "progreso" ? "progress" : "routines");
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

  return view === "progress" ? (
    <MyProgress header={header} />
  ) : (
    <PlansBrowser kind="routines" header={header} />
  );
}

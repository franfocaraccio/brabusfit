import { useLocalSearchParams } from "expo-router";
import { useState } from "react";

import { PlansBrowser, type PlansKind } from "@/components/plans-browser";
import { Segmented } from "@/components/segmented";

/** Pestaña "Planes": rutinas y nutrición con un selector arriba. */
export default function PlanesScreen() {
  // ?vista=nutricion abre directo en Nutrición.
  const { vista } = useLocalSearchParams<{ vista?: string }>();
  const [kind, setKind] = useState<PlansKind>(vista === "nutricion" ? "nutrition" : "routines");
  // Si la pestaña ya estaba abierta y se llega con otro ?vista=, se cambia.
  const [lastVista, setLastVista] = useState(vista);
  if (vista !== lastVista) {
    setLastVista(vista);
    if (vista === "nutricion") setKind("nutrition");
  }

  return (
    <PlansBrowser
      key={kind}
      kind={kind}
      header={
        <Segmented
          fill
          value={kind}
          onChange={setKind}
          options={[
            { value: "routines", label: "Rutinas" },
            { value: "nutrition", label: "Nutrición" },
          ]}
        />
      }
    />
  );
}

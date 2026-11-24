import { ScrollView } from "react-native";

import {
  FOOD_UNITS,
  MEAL_SUGGESTIONS,
  NEW_FOLDER,
  ROUTINE_TEMPLATE,
  ROUTINE_TEMPLATE_LABEL,
} from "@brabus/shared";
import type { ClientSummary, FolderLite } from "@brabus/supabase";

import { OptionList, Sheet } from "@/components/sheet";

/** Qué se está eligiendo en el panel de opciones del editor de planes. */
export type PlanPicker =
  | { kind: "target" }
  | { kind: "folder" }
  | { kind: "meal"; mealKey: string }
  | { kind: "unit"; mealKey: string; optKey: string; itemKey: string }
  | null;

const TITLES = {
  target: "¿Para quién es?",
  folder: "Carpeta",
  meal: "Comida",
  unit: "Unidad",
} as const;

/**
 * Un solo panel para los selectores del editor: destino, carpeta, nombre de
 * comida y unidad. `value` es lo elegido hoy en el selector abierto.
 */
export function PlanPickerSheet({
  picker,
  value,
  clients,
  folders,
  onClose,
  onSelect,
}: {
  picker: PlanPicker;
  value: string | null;
  clients: ClientSummary[];
  folders: FolderLite[];
  onClose: () => void;
  onSelect: (value: string) => void;
}) {
  const options =
    picker?.kind === "target"
      ? [
          {
            value: ROUTINE_TEMPLATE,
            label: ROUTINE_TEMPLATE_LABEL,
            icon: "albums-outline" as const,
          },
          ...clients.map((c) => ({
            value: c.id,
            label: c.name,
            icon: "person-outline" as const,
          })),
        ]
      : picker?.kind === "folder"
        ? [
            ...folders.map((f) => ({
              value: f.id,
              label: f.name,
              icon: "folder-outline" as const,
            })),
            {
              value: NEW_FOLDER,
              label: "Crear carpeta nueva",
              icon: "add" as const,
            },
          ]
        : picker?.kind === "meal"
          ? MEAL_SUGGESTIONS.map((s) => ({ value: s, label: s }))
          : picker?.kind === "unit"
            ? FOOD_UNITS.map((u) => ({ value: u, label: u }))
            : null;

  return (
    <Sheet
      visible={picker !== null}
      onClose={onClose}
      title={TITLES[picker?.kind ?? "unit"]}
    >
      <ScrollView style={{ maxHeight: 420 }}>
        {options ? (
          <OptionList value={value} options={options} onSelect={onSelect} />
        ) : null}
      </ScrollView>
    </Sheet>
  );
}

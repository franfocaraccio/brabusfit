import { ScrollView } from "react-native";

import {
  formatRest,
  NEW_FOLDER,
  REST_OPTIONS,
  ROUTINE_TEMPLATE,
  ROUTINE_TEMPLATE_LABEL,
} from "@brabus/shared";
import type { ClientSummary, FolderLite } from "@brabus/supabase";

import { OptionList, Sheet } from "@/components/sheet";

/** "¿Para quién es?": plantilla o un cliente. */
export function TargetSheet({
  visible,
  target,
  clients,
  onClose,
  onSelect,
}: {
  visible: boolean;
  target: string;
  clients: ClientSummary[];
  onClose: () => void;
  onSelect: (target: string) => void;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title="¿Para quién es?">
      <ScrollView style={{ maxHeight: 420 }}>
        <OptionList
          value={target}
          options={[
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
          ]}
          onSelect={onSelect}
        />
      </ScrollView>
    </Sheet>
  );
}

/** Descanso entre series de un ejercicio (null = sin descanso). */
export function RestSheet({
  visible,
  value,
  onClose,
  onSelect,
}: {
  visible: boolean;
  value: number | null;
  onClose: () => void;
  onSelect: (rest: number | null) => void;
}) {
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Descanso entre series"
      description="El alumno ve una cuenta regresiva al completar cada serie y la puede ajustar."
    >
      <ScrollView style={{ maxHeight: 420 }}>
        <OptionList
          value={value === null ? "none" : String(value)}
          options={[
            { value: "none", label: "Sin descanso" },
            ...REST_OPTIONS.map((sec) => ({
              value: String(sec),
              label: formatRest(sec),
            })),
          ]}
          onSelect={(v) => onSelect(v === "none" ? null : Number(v))}
        />
      </ScrollView>
    </Sheet>
  );
}

/** Carpeta de la plantilla: una existente o "Crear carpeta nueva". */
export function FolderSheet({
  visible,
  folderId,
  folders,
  onClose,
  onSelect,
}: {
  visible: boolean;
  folderId: string | null;
  folders: FolderLite[];
  onClose: () => void;
  onSelect: (folderId: string) => void;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title="Carpeta">
      <OptionList
        value={folderId}
        options={[
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
        ]}
        onSelect={onSelect}
      />
    </Sheet>
  );
}

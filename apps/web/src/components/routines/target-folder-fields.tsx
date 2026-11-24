import {
  NEW_FOLDER,
  ROUTINE_TEMPLATE,
  ROUTINE_TEMPLATE_LABEL,
} from "@brabus/shared";
import type { ClientSummary, FolderLite } from "@brabus/supabase";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * "¿Para quién es?" (coach, al crear una rutina o un plan): plantilla o un
 * cliente, con la aclaración debajo.
 */
export function TargetField({
  target,
  clients,
  hint,
  onChange,
}: {
  target: string;
  clients: ClientSummary[];
  hint: string;
  onChange: (target: string) => void;
}) {
  const items: Record<string, string> = {
    [ROUTINE_TEMPLATE]: ROUTINE_TEMPLATE_LABEL,
    ...Object.fromEntries(clients.map((c) => [c.id, c.name])),
  };
  return (
    <div className="space-y-2">
      <Label>¿Para quién es?</Label>
      <Select
        value={target}
        onValueChange={(v) => onChange(v ?? ROUTINE_TEMPLATE)}
        items={items}
      >
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ROUTINE_TEMPLATE}>
            {ROUTINE_TEMPLATE_LABEL}
          </SelectItem>
          {clients.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-muted-foreground text-xs">{hint}</p>
    </div>
  );
}

/** Carpeta de la plantilla: una existente o una nueva con nombre. */
export function FolderField({
  folders,
  folderId,
  newFolderName,
  newFolderPlaceholder,
  onFolderChange,
  onNewFolderNameChange,
}: {
  folders: FolderLite[];
  folderId: string | null;
  newFolderName: string;
  /** Ejemplo del campo de carpeta nueva. */
  newFolderPlaceholder: string;
  onFolderChange: (folderId: string | null) => void;
  onNewFolderNameChange: (name: string) => void;
}) {
  // Carpetas existentes + opción para crear una nueva en el momento.
  const items: Record<string, string> = {
    ...Object.fromEntries(folders.map((f) => [f.id, f.name])),
    [NEW_FOLDER]: "➕ Crear carpeta nueva",
  };
  return (
    <div className="space-y-2">
      <Label>Carpeta</Label>
      <Select
        value={folderId}
        onValueChange={(v) => onFolderChange(v)}
        items={items}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Elegí una carpeta" />
        </SelectTrigger>
        <SelectContent>
          {folders.map((f) => (
            <SelectItem key={f.id} value={f.id}>
              {f.name}
            </SelectItem>
          ))}
          <SelectItem value={NEW_FOLDER}>➕ Crear carpeta nueva</SelectItem>
        </SelectContent>
      </Select>
      {folderId === NEW_FOLDER && (
        <Input
          value={newFolderName}
          onChange={(e) => onNewFolderNameChange(e.target.value)}
          placeholder={newFolderPlaceholder}
          autoFocus
        />
      )}
    </div>
  );
}

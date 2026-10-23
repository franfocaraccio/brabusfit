import { AppearancePicker } from "@/components/settings/appearance-picker";
import { SettingsHeader } from "@/components/settings/settings-header";

/** Ajustes → Apariencia: tema oscuro, claro o automático. */
export default function AparienciaPage() {
  return (
    <div className="max-w-xl space-y-6">
      <SettingsHeader title="Apariencia" />
      <AppearancePicker />
      <p className="text-muted-foreground text-xs">
        Se guarda en este dispositivo: podés usar uno distinto en el celular y
        en la compu.
      </p>
    </div>
  );
}

import {
  macroLine,
  sanitizeDecimal,
  type MacroRange,
  type PlanTargetField,
  type PlanTargets,
} from "@brabus/shared";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const TARGETS: readonly (readonly [PlanTargetField, string])[] = [
  ["target_kcal", "Calorías (kcal)"],
  ["target_protein", "Proteínas (g)"],
  ["target_carbs", "Carbohidratos (g)"],
  ["target_fat", "Grasas (g)"],
  ["target_water_l", "Agua (L)"],
];

/** Objetivos del plan (kcal, macros, agua) e indicaciones generales. */
export function PlanTargetsCard({
  day,
  targets,
  guidelines,
  onTargetChange,
  onGuidelinesChange,
}: {
  /** Totales del plan tal como está armado. */
  day: MacroRange;
  targets: PlanTargets;
  guidelines: string;
  onTargetChange: (field: PlanTargetField, value: string) => void;
  onGuidelinesChange: (value: string) => void;
}) {
  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div>
          <h2 className="font-sans text-sm font-semibold">
            Objetivos (opcional)
          </h2>
          {day.hasData && (
            <p className="text-muted-foreground text-xs">
              Plan actual: {macroLine(day)}
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {TARGETS.map(([key, label]) => (
            <div key={key} className="space-y-1.5">
              <Label className="text-xs">{label}</Label>
              <Input
                inputMode="decimal"
                value={targets[key]}
                onChange={(e) =>
                  onTargetChange(key, sanitizeDecimal(e.target.value))
                }
              />
            </div>
          ))}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="guidelines">Indicaciones generales (opcional)</Label>
          <Textarea
            id="guidelines"
            value={guidelines}
            onChange={(e) => onGuidelinesChange(e.target.value)}
            placeholder="Hidratación, suplementos, alimentos a evitar…"
          />
        </div>
      </CardContent>
    </Card>
  );
}

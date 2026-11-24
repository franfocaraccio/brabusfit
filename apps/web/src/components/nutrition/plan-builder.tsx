"use client";

import { useRouter } from "next/navigation";
import { useReducer, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import {
  MEAL_SUGGESTIONS,
  buildPlanPayload,
  dayRange,
  draftPlanMeal,
  initialPlanMeals,
  initialPlanTargets,
  initialRoutineTarget,
  macroLine,
  nextMealName,
  planIsForClient,
  planMealsReducer,
  planTargetHint,
  type PlanInput,
} from "@brabus/shared";
import type { ClientSummary, FolderLite } from "@brabus/supabase";

import { savePlan } from "@/lib/actions/nutrition";
import {
  FolderField,
  TargetField,
} from "@/components/routines/target-folder-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { MealCard } from "./meal-card";
import { PlanTargetsCard } from "./plan-targets-card";

let seq = 0;
const newKey = () => `k${++seq}`;

/** Crear / editar un plan de nutrición (igual que PlanBuilder de mobile). */
export function PlanBuilder({
  planId,
  initial,
  clientName,
  folders,
  clients = [],
  initialClientId,
}: {
  planId?: string;
  initial?: PlanInput;
  /** Editando un plan de cliente: su nombre (no usa carpeta). */
  clientName?: string | null;
  folders: FolderLite[];
  /** Al crear: clientes a los que se le puede armar el plan. */
  clients?: ClientSummary[];
  initialClientId?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isEdit = Boolean(planId);

  const [name, setName] = useState(initial?.name ?? "");
  const [target, setTarget] = useState(() =>
    initialRoutineTarget(initialClientId, clients),
  );
  const [folderId, setFolderId] = useState<string | null>(
    initial?.folder_id ?? null,
  );
  const [newFolderName, setNewFolderName] = useState("");
  const [guidelines, setGuidelines] = useState(initial?.guidelines ?? "");
  const [targets, setTargets] = useState(() => initialPlanTargets(initial));
  const [meals, dispatch] = useReducer(planMealsReducer, initial, (i) =>
    initialPlanMeals(i, newKey),
  );

  const forClient = planIsForClient(isEdit, clientName, target);

  const submit = () => {
    const built = buildPlanPayload({
      name,
      isEdit,
      forClient,
      target,
      folderId,
      newFolderName,
      guidelines,
      targets,
      meals,
    });
    if (!built.ok) {
      toast.error(built.error);
      return;
    }

    startTransition(async () => {
      const result = await savePlan(planId ?? null, built.payload);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(isEdit ? "Plan actualizado" : "Plan creado");
      router.push(`/nutricion/${result.data.id}`);
      router.refresh();
    });
  };

  const day = dayRange(meals);

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="plan-name">Nombre del plan</Label>
          <Input
            id="plan-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Volumen 2800 kcal"
          />
        </div>

        {!isEdit && (
          <TargetField
            target={target}
            clients={clients}
            hint={planTargetHint(forClient)}
            onChange={setTarget}
          />
        )}

        {isEdit && clientName && (
          <p className="text-muted-foreground text-sm">
            Plan de:{" "}
            <span className="text-foreground font-medium">{clientName}</span>
          </p>
        )}

        {!forClient && (
          <FolderField
            folders={folders}
            folderId={folderId}
            newFolderName={newFolderName}
            newFolderPlaceholder="Nombre de la carpeta (ej: Volumen)"
            onFolderChange={setFolderId}
            onNewFolderNameChange={setNewFolderName}
          />
        )}
      </div>

      <PlanTargetsCard
        day={day}
        targets={targets}
        guidelines={guidelines}
        onTargetChange={(field, value) =>
          setTargets((t) => ({ ...t, [field]: value }))
        }
        onGuidelinesChange={setGuidelines}
      />

      <datalist id="meal-suggestions">
        {MEAL_SUGGESTIONS.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>

      <div className="space-y-4">
        {meals.map((meal) => (
          <MealCard
            key={meal.key}
            meal={meal}
            canRemove={meals.length > 1}
            dispatch={dispatch}
            newKey={newKey}
          />
        ))}

        <Button
          type="button"
          variant="secondary"
          className="w-full"
          onClick={() =>
            dispatch({
              type: "addMeal",
              meal: draftPlanMeal(newKey, nextMealName(meals)),
            })
          }
        >
          <Plus className="size-4" /> Agregar comida
        </Button>
      </div>

      <div className="bg-background/90 sticky bottom-16 z-20 -mx-4 space-y-2 border-t px-4 py-3 backdrop-blur md:bottom-0 md:mx-0 md:border-0 md:bg-transparent md:px-0 md:py-0">
        {day.hasData && (
          <p className="text-muted-foreground text-center text-xs">
            Total del día: {macroLine(day)}
          </p>
        )}
        <Button
          type="button"
          className="w-full"
          onClick={submit}
          disabled={pending}
        >
          {pending ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear plan"}
        </Button>
      </div>
    </div>
  );
}

import { Plus, Trash2 } from "lucide-react";
import type { Dispatch } from "react";

import {
  draftPlanItem,
  draftPlanOption,
  macroLine,
  mealRange,
  optionLabel,
  optionLetter,
  optionTotals,
  type PlanMealDraft,
  type PlanMealsAction,
} from "@brabus/shared";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import { FoodItemRow, PLAN_MACROS } from "./food-item-row";

/**
 * Una comida del plan: nombre (con sugerencias), horario y sus opciones
 * (A, B…) con alimentos y totales.
 */
export function MealCard({
  meal,
  canRemove,
  dispatch,
  newKey,
}: {
  meal: PlanMealDraft;
  canRemove: boolean;
  dispatch: Dispatch<PlanMealsAction>;
  newKey: () => string;
}) {
  const mealKey = meal.key;
  const range = mealRange(meal.options);
  const multi = meal.options.length > 1;
  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1.5">
            <Label className="text-xs">Comida</Label>
            <Input
              list="meal-suggestions"
              value={meal.name}
              onChange={(e) =>
                dispatch({
                  type: "updateMeal",
                  mealKey,
                  patch: { name: e.target.value },
                })
              }
              placeholder="Desayuno"
            />
          </div>
          <div className="w-24 space-y-1.5">
            <Label className="text-xs">Horario</Label>
            <Input
              value={meal.time_label}
              onChange={(e) =>
                dispatch({
                  type: "updateMeal",
                  mealKey,
                  patch: { time_label: e.target.value },
                })
              }
              placeholder="8:00"
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Eliminar comida"
            onClick={() => dispatch({ type: "removeMeal", mealKey })}
            disabled={!canRemove}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>

        {meal.options.map((opt, oi) => {
          const t = optionTotals(opt.items);
          const optKey = opt.key;
          return (
            <div
              key={optKey}
              className={cn(
                "space-y-2",
                multi && "bg-muted/30 rounded-lg border p-3",
              )}
            >
              {multi && (
                <div className="flex items-center justify-between">
                  <span className="text-primary-text text-xs font-semibold">
                    {optionLabel(oi)}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      dispatch({ type: "removeOption", mealKey, optKey })
                    }
                  >
                    Quitar opción
                  </Button>
                </div>
              )}

              <div className="text-muted-foreground hidden grid-cols-[1fr_4.5rem_6rem_repeat(4,3.75rem)_2.25rem] gap-1.5 px-0.5 text-[11px] sm:grid">
                <span>Alimento</span>
                <span>Cantidad</span>
                <span>Unidad</span>
                {PLAN_MACROS.map(([, l]) => (
                  <span key={l}>{l}</span>
                ))}
                <span />
              </div>
              {opt.items.map((item) => (
                <FoodItemRow
                  key={item.key}
                  item={item}
                  onChange={(patch) =>
                    dispatch({
                      type: "updateItem",
                      mealKey,
                      optKey,
                      itemKey: item.key,
                      patch,
                    })
                  }
                  onRemove={() =>
                    dispatch({
                      type: "removeItem",
                      mealKey,
                      optKey,
                      itemKey: item.key,
                      blank: draftPlanItem(newKey),
                    })
                  }
                />
              ))}

              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-1"
                  onClick={() =>
                    dispatch({
                      type: "addItem",
                      mealKey,
                      optKey,
                      item: draftPlanItem(newKey),
                    })
                  }
                >
                  <Plus className="size-4" /> Alimento
                </Button>
                {t.hasData && (
                  <span className="text-muted-foreground text-xs">
                    {macroLine({ min: t, max: t, hasData: true })}
                  </span>
                )}
              </div>
            </div>
          );
        })}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() =>
              dispatch({
                type: "addOption",
                mealKey,
                option: draftPlanOption(newKey),
              })
            }
          >
            <Plus className="size-4" /> Opción{" "}
            {optionLetter(meal.options.length)}
          </Button>
          {multi && range.hasData && (
            <span className="text-muted-foreground text-xs">
              Comida: {macroLine(range)}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

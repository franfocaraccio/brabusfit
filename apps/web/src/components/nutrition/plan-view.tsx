import {
  dayRange,
  formatRange,
  itemAmount,
  macroLine,
  mealRange,
  optionLabel,
  optionTotals,
  planTargets,
} from "@brabus/shared";
import type { PlanDetail } from "@brabus/supabase";

import { Card } from "@/components/ui/card";

const n = (v: number | null) =>
  v === null ? "" : v.toLocaleString("es-AR", { maximumFractionDigits: 1 });

/** Plan de nutrición en solo lectura: objetivos vs. total, indicaciones y comidas. */
export function PlanView({ detail }: { detail: PlanDetail }) {
  const { plan, meals } = detail;
  const day = dayRange(meals);
  const targets = planTargets(plan);

  const compare: [string, number | null, keyof typeof day.min, string][] = [
    ["Calorías", plan.target_kcal, "kcal", "kcal"],
    ["Proteínas", plan.target_protein, "protein", "g"],
    ["Carbohidratos", plan.target_carbs, "carbs", "g"],
    ["Grasas", plan.target_fat, "fat", "g"],
  ];

  return (
    <div className="space-y-4">
      {(targets.length > 0 || day.hasData) && (
        <Card className="grid grid-cols-2 gap-x-6 gap-y-3 p-4 sm:grid-cols-4">
          {compare.map(([label, target, key, unit]) =>
            target === null && !day.hasData ? null : (
              <div key={key}>
                <p className="text-muted-foreground text-xs">{label}</p>
                <p className="text-sm font-semibold">
                  {day.hasData ? formatRange(day, key, unit) : "—"}
                </p>
                {target !== null && (
                  <p className="text-muted-foreground text-xs">
                    Objetivo {n(target)} {unit}
                  </p>
                )}
              </div>
            ),
          )}
          {plan.target_water_l !== null && (
            <div>
              <p className="text-muted-foreground text-xs">Agua</p>
              <p className="text-sm font-semibold">{n(plan.target_water_l)} L</p>
            </div>
          )}
        </Card>
      )}

      {plan.guidelines && (
        <Card className="space-y-1 p-4">
          <p className="text-muted-foreground text-xs">Indicaciones</p>
          <p className="text-sm whitespace-pre-line">{plan.guidelines}</p>
        </Card>
      )}

      {meals.length === 0 ? (
        <Card className="p-6 text-center">
          <p className="text-muted-foreground text-sm">Este plan no tiene comidas.</p>
        </Card>
      ) : (
        meals.map((meal) => {
          const range = mealRange(meal.options);
          return (
            <Card key={meal.id} className="space-y-3 p-4">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="font-sans text-base font-semibold">
                  {meal.name}
                  {meal.time_label ? (
                    <span className="text-primary-text ml-2 text-xs font-semibold">{meal.time_label}</span>
                  ) : null}
                </h2>
                {range.hasData && (
                  <span className="text-muted-foreground text-xs">
                    {formatRange(range, "kcal", "kcal")}
                  </span>
                )}
              </div>

              {meal.options.map((opt, i) => {
                const t = optionTotals(opt.items);
                return (
                  <div key={i} className="space-y-1.5">
                    {meal.options.length > 1 && (
                      <p className="text-primary-text text-xs font-semibold">{optionLabel(i)}</p>
                    )}
                    <ul className="divide-y rounded-lg border">
                      {opt.items.map((it, j) => (
                        <li key={j} className="flex items-baseline justify-between gap-3 px-3 py-2 text-sm">
                          <span className="min-w-0">
                            <span className="font-medium">{it.food}</span>
                            {itemAmount(it) ? (
                              <span className="text-muted-foreground ml-2">{itemAmount(it)}</span>
                            ) : null}
                          </span>
                          {it.kcal !== null || it.protein !== null || it.carbs !== null || it.fat !== null ? (
                            <span className="text-muted-foreground shrink-0 text-xs">
                              {[
                                it.kcal !== null ? `${n(it.kcal)} kcal` : null,
                                it.protein !== null ? `P ${n(it.protein)}` : null,
                                it.carbs !== null ? `C ${n(it.carbs)}` : null,
                                it.fat !== null ? `G ${n(it.fat)}` : null,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                    {t.hasData && meal.options.length > 1 && (
                      <p className="text-muted-foreground text-right text-xs">
                        {macroLine({ min: t, max: t, hasData: true })}
                      </p>
                    )}
                  </div>
                );
              })}

              {range.hasData && (
                <p className="text-muted-foreground border-t pt-2 text-xs">
                  {meal.options.length > 1 ? "Entre opciones: " : "Total: "}
                  {macroLine(range)}
                </p>
              )}
            </Card>
          );
        })
      )}

      {day.hasData && (
        <Card className="border-primary/40 p-4">
          <p className="text-sm">
            <span className="font-semibold">Total del día:</span> {macroLine(day)}
          </p>
        </Card>
      )}
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  FOOD_UNITS,
  MEAL_SUGGESTIONS,
  dayRange,
  emptyItem,
  macroLine,
  mealRange,
  optionLabel,
  optionTotals,
  sanitizeDecimal,
  type PlanInput,
  type PlanItemInput,
} from "@brabus/shared";
import type { ClientSummary, FolderLite } from "@brabus/supabase";

import { savePlan } from "@/lib/actions/nutrition";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type ItemDraft = PlanItemInput & { key: string };
type OptionDraft = { key: string; items: ItemDraft[] };
type MealDraft = { key: string; name: string; time_label: string; options: OptionDraft[] };

const NEW_FOLDER = "__new__";
const TEMPLATE = "__template__";

let seq = 0;
const newKey = () => `k${++seq}`;
const draftItem = (i: PlanItemInput = emptyItem()): ItemDraft => ({ ...i, key: newKey() });
const draftOption = (items: PlanItemInput[] = [emptyItem()]): OptionDraft => ({
  key: newKey(),
  items: items.map(draftItem),
});
const draftMeal = (name = ""): MealDraft => ({
  key: newKey(),
  name,
  time_label: "",
  options: [draftOption()],
});

/** Saca la key interna del borrador. */
const toItemInput = (i: ItemDraft): PlanItemInput => ({
  food: i.food,
  amount: i.amount,
  unit: i.unit,
  kcal: i.kcal,
  protein: i.protein,
  carbs: i.carbs,
  fat: i.fat,
});

const DEFAULT_MEALS = ["Desayuno", "Almuerzo", "Merienda", "Cena"];
const MACROS = [
  ["kcal", "kcal"],
  ["protein", "P (g)"],
  ["carbs", "C (g)"],
  ["fat", "G (g)"],
] as const;
const TARGETS = [
  ["target_kcal", "Calorías (kcal)"],
  ["target_protein", "Proteínas (g)"],
  ["target_carbs", "Carbohidratos (g)"],
  ["target_fat", "Grasas (g)"],
  ["target_water_l", "Agua (L)"],
] as const;

const selectCls =
  "h-9 w-full rounded-xl border border-input bg-input/40 px-2 text-sm outline-none focus-visible:border-ring";

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
  const [target, setTarget] = useState(
    initialClientId && clients.some((c) => c.id === initialClientId) ? initialClientId : TEMPLATE,
  );
  const [folderId, setFolderId] = useState<string | null>(initial?.folder_id ?? null);
  const [newFolderName, setNewFolderName] = useState("");
  const [guidelines, setGuidelines] = useState(initial?.guidelines ?? "");
  const [targets, setTargets] = useState({
    target_kcal: initial?.target_kcal ?? "",
    target_protein: initial?.target_protein ?? "",
    target_carbs: initial?.target_carbs ?? "",
    target_fat: initial?.target_fat ?? "",
    target_water_l: initial?.target_water_l ?? "",
  });
  const [meals, setMeals] = useState<MealDraft[]>(() =>
    initial
      ? initial.meals.map((m) => ({
          key: newKey(),
          name: m.name,
          time_label: m.time_label,
          options: m.options.map((o) => draftOption(o.items)),
        }))
      : DEFAULT_MEALS.map(draftMeal),
  );

  const forClient = isEdit ? Boolean(clientName) : target !== TEMPLATE;
  const targetItems: Record<string, string> = {
    [TEMPLATE]: "Plantilla (en una carpeta)",
    ...Object.fromEntries(clients.map((c) => [c.id, c.name])),
  };
  const folderItems: Record<string, string> = {
    ...Object.fromEntries(folders.map((f) => [f.id, f.name])),
    [NEW_FOLDER]: "➕ Crear carpeta nueva",
  };

  // --- mutadores ---------------------------------------------------------------
  const updateMeal = (key: string, patch: Partial<MealDraft>) =>
    setMeals((ms) => ms.map((m) => (m.key === key ? { ...m, ...patch } : m)));
  const updateOption = (mealKey: string, optKey: string, fn: (o: OptionDraft) => OptionDraft) =>
    setMeals((ms) =>
      ms.map((m) =>
        m.key === mealKey ? { ...m, options: m.options.map((o) => (o.key === optKey ? fn(o) : o)) } : m,
      ),
    );
  const updateItem = (mealKey: string, optKey: string, itemKey: string, patch: Partial<ItemDraft>) =>
    updateOption(mealKey, optKey, (o) => ({
      ...o,
      items: o.items.map((i) => (i.key === itemKey ? { ...i, ...patch } : i)),
    }));

  const addMeal = () => {
    const used = new Set(meals.map((m) => m.name));
    setMeals((ms) => [...ms, draftMeal(MEAL_SUGGESTIONS.find((s) => !used.has(s)) ?? "")]);
  };

  // --- guardar -----------------------------------------------------------------
  const submit = () => {
    let folderPayload: string | null = null;
    let newFolderPayload: string | null = null;
    if (!forClient) {
      if (folderId === NEW_FOLDER) {
        if (!newFolderName.trim()) {
          toast.error("Poné un nombre para la carpeta nueva.");
          return;
        }
        newFolderPayload = newFolderName.trim();
      } else if (folderId) {
        folderPayload = folderId;
      } else {
        toast.error("Elegí o creá una carpeta para guardar la plantilla.");
        return;
      }
    }

    const payload: PlanInput = {
      name,
      folder_id: folderPayload,
      newFolderName: newFolderPayload,
      client_id: !isEdit && forClient ? target : null,
      guidelines,
      ...targets,
      meals: meals.map((m) => ({
        name: m.name,
        time_label: m.time_label,
        options: m.options.map((o) => ({ items: o.items.map(toItemInput) })),
      })),
    };

    startTransition(async () => {
      const result = await savePlan(planId ?? null, payload);
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
          <div className="space-y-2">
            <Label>¿Para quién es?</Label>
            <Select value={target} onValueChange={(v) => setTarget(v ?? TEMPLATE)} items={targetItems}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TEMPLATE}>Plantilla (en una carpeta)</SelectItem>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">
              {forClient
                ? "Es solo de este cliente: cambiarlo no afecta a nadie más."
                : "Las plantillas no las ve nadie: sirven para armarles planes a tus clientes."}
            </p>
          </div>
        )}

        {isEdit && clientName && (
          <p className="text-muted-foreground text-sm">
            Plan de: <span className="text-foreground font-medium">{clientName}</span>
          </p>
        )}

        {!forClient && (
          <div className="space-y-2">
            <Label>Carpeta</Label>
            <Select value={folderId} onValueChange={(v) => setFolderId(v)} items={folderItems}>
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
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Nombre de la carpeta (ej: Volumen)"
                autoFocus
              />
            )}
          </div>
        )}
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div>
            <h2 className="font-sans text-sm font-semibold">Objetivos (opcional)</h2>
            {day.hasData && (
              <p className="text-muted-foreground text-xs">Plan actual: {macroLine(day)}</p>
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
                    setTargets((t) => ({ ...t, [key]: sanitizeDecimal(e.target.value) }))
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
              onChange={(e) => setGuidelines(e.target.value)}
              placeholder="Hidratación, suplementos, alimentos a evitar…"
            />
          </div>
        </CardContent>
      </Card>

      <datalist id="meal-suggestions">
        {MEAL_SUGGESTIONS.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>

      <div className="space-y-4">
        {meals.map((meal) => {
          const range = mealRange(meal.options);
          return (
            <Card key={meal.key}>
              <CardContent className="space-y-4 pt-6">
                <div className="flex items-end gap-2">
                  <div className="flex-1 space-y-1.5">
                    <Label className="text-xs">Comida</Label>
                    <Input
                      list="meal-suggestions"
                      value={meal.name}
                      onChange={(e) => updateMeal(meal.key, { name: e.target.value })}
                      placeholder="Desayuno"
                    />
                  </div>
                  <div className="w-24 space-y-1.5">
                    <Label className="text-xs">Horario</Label>
                    <Input
                      value={meal.time_label}
                      onChange={(e) => updateMeal(meal.key, { time_label: e.target.value })}
                      placeholder="8:00"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Eliminar comida"
                    onClick={() => setMeals((ms) => ms.filter((m) => m.key !== meal.key))}
                    disabled={meals.length === 1}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>

                {meal.options.map((opt, oi) => {
                  const t = optionTotals(opt.items);
                  return (
                    <div
                      key={opt.key}
                      className={cn(
                        "space-y-2",
                        meal.options.length > 1 && "bg-muted/30 rounded-lg border p-3",
                      )}
                    >
                      {meal.options.length > 1 && (
                        <div className="flex items-center justify-between">
                          <span className="text-primary text-xs font-semibold">{optionLabel(oi)}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              updateMeal(meal.key, {
                                options: meal.options.filter((o) => o.key !== opt.key),
                              })
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
                        {MACROS.map(([, l]) => (
                          <span key={l}>{l}</span>
                        ))}
                        <span />
                      </div>
                      {opt.items.map((item) => (
                        <div
                          key={item.key}
                          className="grid grid-cols-[1fr_2.25rem] gap-1.5 sm:grid-cols-[1fr_4.5rem_6rem_repeat(4,3.75rem)_2.25rem]"
                        >
                          <Input
                            className="h-9"
                            value={item.food}
                            onChange={(e) =>
                              updateItem(meal.key, opt.key, item.key, { food: e.target.value })
                            }
                            placeholder="Avena"
                            aria-label="Alimento"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="sm:order-last"
                            aria-label="Quitar alimento"
                            onClick={() =>
                              updateOption(meal.key, opt.key, (o) => ({
                                ...o,
                                items:
                                  o.items.length > 1
                                    ? o.items.filter((i) => i.key !== item.key)
                                    : [draftItem()],
                              }))
                            }
                          >
                            <Trash2 className="size-4" />
                          </Button>
                          <div className="col-span-2 grid grid-cols-6 gap-1.5 sm:contents">
                            <Input
                              className="h-9"
                              inputMode="decimal"
                              value={item.amount}
                              onChange={(e) =>
                                updateItem(meal.key, opt.key, item.key, { amount: e.target.value })
                              }
                              placeholder="60"
                              aria-label="Cantidad"
                            />
                            <select
                              className={selectCls}
                              value={item.unit}
                              onChange={(e) =>
                                updateItem(meal.key, opt.key, item.key, { unit: e.target.value })
                              }
                              aria-label="Unidad"
                            >
                              <option value="">—</option>
                              {item.unit && !FOOD_UNITS.includes(item.unit) ? (
                                <option value={item.unit}>{item.unit}</option>
                              ) : null}
                              {FOOD_UNITS.map((u) => (
                                <option key={u} value={u}>
                                  {u}
                                </option>
                              ))}
                            </select>
                            {MACROS.map(([key, label]) => (
                              <Input
                                key={key}
                                className="h-9 px-2"
                                inputMode="decimal"
                                value={item[key]}
                                onChange={(e) =>
                                  updateItem(meal.key, opt.key, item.key, {
                                    [key]: sanitizeDecimal(e.target.value),
                                  })
                                }
                                placeholder={label.split(" ")[0]}
                                aria-label={label}
                              />
                            ))}
                          </div>
                        </div>
                      ))}

                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="gap-1"
                          onClick={() =>
                            updateOption(meal.key, opt.key, (o) => ({
                              ...o,
                              items: [...o.items, draftItem()],
                            }))
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
                    onClick={() => updateMeal(meal.key, { options: [...meal.options, draftOption()] })}
                  >
                    <Plus className="size-4" /> Opción {String.fromCharCode(65 + meal.options.length)}
                  </Button>
                  {meal.options.length > 1 && range.hasData && (
                    <span className="text-muted-foreground text-xs">Comida: {macroLine(range)}</span>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}

        <Button type="button" variant="secondary" className="w-full" onClick={addMeal}>
          <Plus className="size-4" /> Agregar comida
        </Button>
      </div>

      <div className="bg-background/90 sticky bottom-16 z-20 -mx-4 space-y-2 border-t px-4 py-3 backdrop-blur md:bottom-0 md:mx-0 md:border-0 md:bg-transparent md:px-0 md:py-0">
        {day.hasData && (
          <p className="text-muted-foreground text-center text-xs">Total del día: {macroLine(day)}</p>
        )}
        <Button type="button" className="w-full" onClick={submit} disabled={pending}>
          {pending ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear plan"}
        </Button>
      </div>
    </div>
  );
}

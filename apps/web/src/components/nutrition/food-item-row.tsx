import { Trash2 } from "lucide-react";

import {
  FOOD_UNITS,
  sanitizeDecimal,
  type PlanItemDraft,
  type PlanItemInput,
} from "@brabus/shared";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const PLAN_MACROS = [
  ["kcal", "kcal"],
  ["protein", "P (g)"],
  ["carbs", "C (g)"],
  ["fat", "G (g)"],
] as const;

const selectCls =
  "h-9 w-full rounded-xl border border-input bg-input/40 px-2 text-sm outline-none focus-visible:border-ring";

/** Un alimento: nombre, cantidad, unidad, macros y quitar. */
export function FoodItemRow({
  item,
  onChange,
  onRemove,
}: {
  item: PlanItemDraft;
  onChange: (patch: Partial<PlanItemInput>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="grid grid-cols-[1fr_2.25rem] gap-1.5 sm:grid-cols-[1fr_4.5rem_6rem_repeat(4,3.75rem)_2.25rem]">
      <Input
        className="h-9"
        value={item.food}
        onChange={(e) => onChange({ food: e.target.value })}
        placeholder="Avena"
        aria-label="Alimento"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="sm:order-last"
        aria-label="Quitar alimento"
        onClick={onRemove}
      >
        <Trash2 className="size-4" />
      </Button>
      <div className="col-span-2 grid grid-cols-6 gap-1.5 sm:contents">
        <Input
          className="h-9"
          inputMode="decimal"
          value={item.amount}
          onChange={(e) => onChange({ amount: e.target.value })}
          placeholder="60"
          aria-label="Cantidad"
        />
        <select
          className={selectCls}
          value={item.unit}
          onChange={(e) => onChange({ unit: e.target.value })}
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
        {PLAN_MACROS.map(([key, label]) => (
          <Input
            key={key}
            className="h-9 px-2"
            inputMode="decimal"
            value={item[key]}
            onChange={(e) =>
              onChange({ [key]: sanitizeDecimal(e.target.value) })
            }
            placeholder={label.split(" ")[0]}
            aria-label={label}
          />
        ))}
      </div>
    </div>
  );
}

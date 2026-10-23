import { Text, View } from "react-native";

import {
  dayRange,
  formatRange,
  itemAmount,
  macroLine,
  mealRange,
  optionLabel,
  optionTotals,
} from "@brabus/shared";
import type { PlanDetail } from "@brabus/supabase";

import { Card, Muted } from "@/components/ui";
import { fonts, makeStyles, radius } from "@/lib/theme";

const n = (v: number | null) =>
  v === null ? "" : v.toLocaleString("es-AR", { maximumFractionDigits: 1 });

/** Plan de nutrición en solo lectura (igual que PlanView de la web). */
export function PlanView({ detail }: { detail: PlanDetail }) {
  const styles = useStyles();
  const { plan, meals } = detail;
  const day = dayRange(meals);

  const compare: [
    string,
    number | null,
    "kcal" | "protein" | "carbs" | "fat",
    string,
  ][] = [
    ["Calorías", plan.target_kcal, "kcal", "kcal"],
    ["Proteínas", plan.target_protein, "protein", "g"],
    ["Carbohidratos", plan.target_carbs, "carbs", "g"],
    ["Grasas", plan.target_fat, "fat", "g"],
  ];
  const shown = compare.filter(([, target]) => target !== null || day.hasData);

  return (
    <View style={{ gap: 12 }}>
      {shown.length > 0 || plan.target_water_l !== null ? (
        <Card style={styles.grid}>
          {shown.map(([label, target, key, unit]) => (
            <View key={key} style={styles.cell}>
              <Text style={styles.cellLabel}>{label}</Text>
              <Text style={styles.cellValue}>
                {day.hasData ? formatRange(day, key, unit) : "—"}
              </Text>
              {target !== null ? (
                <Text style={styles.cellLabel}>
                  Objetivo {n(target)} {unit}
                </Text>
              ) : null}
            </View>
          ))}
          {plan.target_water_l !== null ? (
            <View style={styles.cell}>
              <Text style={styles.cellLabel}>Agua</Text>
              <Text style={styles.cellValue}>{n(plan.target_water_l)} L</Text>
            </View>
          ) : null}
        </Card>
      ) : null}

      {plan.guidelines ? (
        <Card style={styles.block}>
          <Text style={styles.cellLabel}>Indicaciones</Text>
          <Text style={styles.text}>{plan.guidelines}</Text>
        </Card>
      ) : null}

      {meals.length === 0 ? (
        <Card style={styles.block}>
          <Muted style={{ textAlign: "center" }}>
            Este plan no tiene comidas.
          </Muted>
        </Card>
      ) : (
        meals.map((meal) => {
          const range = mealRange(meal.options);
          return (
            <Card key={meal.id} style={styles.block}>
              <View style={styles.mealHeader}>
                <Text style={styles.mealName}>
                  {meal.name}
                  {meal.time_label ? (
                    <Text style={styles.time}>{`  ${meal.time_label}`}</Text>
                  ) : null}
                </Text>
                {range.hasData ? (
                  <Text style={styles.cellLabel}>
                    {formatRange(range, "kcal", "kcal")}
                  </Text>
                ) : null}
              </View>

              {meal.options.map((opt, i) => {
                const t = optionTotals(opt.items);
                return (
                  <View key={i} style={{ gap: 6 }}>
                    {meal.options.length > 1 ? (
                      <Text style={styles.option}>{optionLabel(i)}</Text>
                    ) : null}
                    <View style={styles.list}>
                      {opt.items.map((it, j) => {
                        const macros = [
                          it.kcal !== null ? `${n(it.kcal)} kcal` : null,
                          it.protein !== null ? `P ${n(it.protein)}` : null,
                          it.carbs !== null ? `C ${n(it.carbs)}` : null,
                          it.fat !== null ? `G ${n(it.fat)}` : null,
                        ].filter(Boolean);
                        return (
                          <View
                            key={j}
                            style={[styles.row, j > 0 && styles.rowBorder]}
                          >
                            <Text style={styles.food}>
                              {it.food}
                              {itemAmount(it) ? (
                                <Text
                                  style={styles.amount}
                                >{`  ${itemAmount(it)}`}</Text>
                              ) : null}
                            </Text>
                            {macros.length > 0 ? (
                              <Text style={styles.macros}>
                                {macros.join(" · ")}
                              </Text>
                            ) : null}
                          </View>
                        );
                      })}
                    </View>
                    {t.hasData && meal.options.length > 1 ? (
                      <Text style={[styles.cellLabel, { textAlign: "right" }]}>
                        {macroLine({ min: t, max: t, hasData: true })}
                      </Text>
                    ) : null}
                  </View>
                );
              })}

              {range.hasData ? (
                <Text style={styles.total}>
                  {meal.options.length > 1 ? "Entre opciones: " : "Total: "}
                  {macroLine(range)}
                </Text>
              ) : null}
            </Card>
          );
        })
      )}

      {day.hasData ? (
        <Card style={[styles.block, { borderColor: "rgba(249,115,22,0.4)" }]}>
          <Text style={styles.text}>
            <Text style={{ fontFamily: fonts.semibold }}>Total del día: </Text>
            {macroLine(day)}
          </Text>
        </Card>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  grid: { padding: 14, flexDirection: "row", flexWrap: "wrap", rowGap: 12 },
  cell: { width: "50%", paddingRight: 8, gap: 2 },
  cellLabel: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.mutedForeground,
  },
  cellValue: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.foreground,
  },
  block: { padding: 14, gap: 10 },
  text: { fontFamily: fonts.regular, fontSize: 14, color: colors.foreground },
  mealHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 8,
  },
  mealName: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.foreground,
  },
  time: { fontFamily: fonts.semibold, fontSize: 12, color: colors.primaryText },
  option: { fontFamily: fonts.semibold, fontSize: 12, color: colors.primaryText },
  list: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md },
  row: { paddingHorizontal: 12, paddingVertical: 9, gap: 2 },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  food: { fontFamily: fonts.medium, fontSize: 14, color: colors.foreground },
  amount: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.mutedForeground,
  },
  macros: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.mutedForeground,
  },
  total: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.mutedForeground,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
  },
}));

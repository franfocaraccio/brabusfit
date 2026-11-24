import { Ionicons } from "@expo/vector-icons";
import type { Dispatch } from "react";
import { Pressable, Text, View } from "react-native";

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

import { IconButton } from "@/components/routine-editor/icon-button";
import { Button, Card, TextField } from "@/components/ui";
import { fonts, makeStyles, radius, useColors } from "@/lib/theme";

import { FoodItem } from "./food-item";

/**
 * Una comida del plan: nombre (con lista de sugerencias), horario y sus
 * opciones (A, B…) con alimentos y totales.
 */
export function MealCard({
  meal,
  canRemove,
  dispatch,
  newKey,
  onPickName,
  onPickUnit,
}: {
  meal: PlanMealDraft;
  canRemove: boolean;
  dispatch: Dispatch<PlanMealsAction>;
  newKey: () => string;
  /** Abre la lista de nombres sugeridos. */
  onPickName: () => void;
  /** Abre el selector de unidad de un alimento. */
  onPickUnit: (optKey: string, itemKey: string) => void;
}) {
  const colors = useColors();
  const styles = useStyles();
  const mealKey = meal.key;
  const range = mealRange(meal.options);
  const multi = meal.options.length > 1;
  return (
    <Card style={styles.card}>
      <View style={styles.mealHeader}>
        <View style={{ flex: 1 }}>
          <TextField
            label="Comida"
            value={meal.name}
            onChangeText={(v) =>
              dispatch({ type: "updateMeal", mealKey, patch: { name: v } })
            }
            placeholder="Desayuno"
          />
        </View>
        <View style={{ width: 84 }}>
          <TextField
            label="Horario"
            value={meal.time_label}
            onChangeText={(v) =>
              dispatch({
                type: "updateMeal",
                mealKey,
                patch: { time_label: v },
              })
            }
            placeholder="8:00"
          />
        </View>
        <IconButton
          narrow
          icon="list-outline"
          label="Elegir nombre"
          onPress={onPickName}
        />
        <IconButton
          narrow
          icon="trash-outline"
          label="Eliminar comida"
          onPress={() => dispatch({ type: "removeMeal", mealKey })}
          disabled={!canRemove}
        />
      </View>

      {meal.options.map((opt, oi) => {
        const t = optionTotals(opt.items);
        const optKey = opt.key;
        return (
          <View key={optKey} style={[{ gap: 10 }, multi && styles.optionBox]}>
            {multi ? (
              <View style={styles.optionHeader}>
                <Text style={styles.optionLabel}>{optionLabel(oi)}</Text>
                <Pressable
                  onPress={() =>
                    dispatch({ type: "removeOption", mealKey, optKey })
                  }
                  hitSlop={8}
                >
                  <Text style={styles.link}>Quitar opción</Text>
                </Pressable>
              </View>
            ) : null}

            {opt.items.map((item) => (
              <FoodItem
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
                onPickUnit={() => onPickUnit(optKey, item.key)}
              />
            ))}

            <View style={styles.optionFooter}>
              <Pressable
                onPress={() =>
                  dispatch({
                    type: "addItem",
                    mealKey,
                    optKey,
                    item: draftPlanItem(newKey),
                  })
                }
                hitSlop={8}
                style={styles.addItem}
              >
                <Ionicons name="add" size={18} color={colors.primaryText} />
                <Text style={styles.link}>Alimento</Text>
              </Pressable>
              {t.hasData ? (
                <Text style={styles.hint}>
                  {macroLine({ min: t, max: t, hasData: true })}
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}

      <Button
        title={`Agregar opción ${optionLetter(meal.options.length)}`}
        variant="outline"
        onPress={() =>
          dispatch({
            type: "addOption",
            mealKey,
            option: draftPlanOption(newKey),
          })
        }
        icon={<Ionicons name="add" size={18} color={colors.foreground} />}
      />
      {multi && range.hasData ? (
        <Text style={styles.hint}>Comida: {macroLine(range)}</Text>
      ) : null}
    </Card>
  );
}

const useStyles = makeStyles((colors) => ({
  card: { padding: 14, gap: 12 },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.mutedForeground,
  },
  mealHeader: { flexDirection: "row", alignItems: "flex-end", gap: 6 },
  optionBox: {
    padding: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.subtle,
  },
  optionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  optionLabel: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.primaryText,
  },
  optionFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  addItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  link: { fontFamily: fonts.medium, fontSize: 14, color: colors.primaryText },
}));

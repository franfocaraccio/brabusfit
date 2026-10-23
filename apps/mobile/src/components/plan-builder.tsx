import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
import {
  savePlan,
  type ClientSummary,
  type FolderLite,
} from "@brabus/supabase";

import { ErrorText } from "@/components/forms";
import { OptionList, Sheet } from "@/components/sheet";
import { Button, Card, TextField } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { fonts, makeStyles, radius, useColors } from "@/lib/theme";

type ItemDraft = PlanItemInput & { key: string };
type OptionDraft = { key: string; items: ItemDraft[] };
type MealDraft = {
  key: string;
  name: string;
  time_label: string;
  options: OptionDraft[];
};

const NEW_FOLDER = "__new__";
const TEMPLATE = "__template__";

let seq = 0;
const newKey = () => `p${Date.now().toString(36)}${(seq++).toString(36)}`;
const draftItem = (i: PlanItemInput = emptyItem()): ItemDraft => ({
  ...i,
  key: newKey(),
});
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
  ["protein", "Prot."],
  ["carbs", "Carb."],
  ["fat", "Grasas"],
] as const;
const TARGETS = [
  ["target_kcal", "Calorías"],
  ["target_protein", "Proteínas (g)"],
  ["target_carbs", "Carbohidratos (g)"],
  ["target_fat", "Grasas (g)"],
  ["target_water_l", "Agua (L)"],
] as const;

type Picker =
  | { kind: "target" }
  | { kind: "folder" }
  | { kind: "meal"; mealKey: string }
  | { kind: "unit"; mealKey: string; optKey: string; itemKey: string }
  | null;

/** Crear / editar un plan de nutrición (igual que PlanBuilder de la web). */
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
  clientName?: string | null;
  folders: FolderLite[];
  clients?: ClientSummary[];
  initialClientId?: string;
}) {
  const colors = useColors();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const isEdit = Boolean(planId);

  const [name, setName] = useState(initial?.name ?? "");
  const [target, setTarget] = useState(
    initialClientId && clients.some((c) => c.id === initialClientId)
      ? initialClientId
      : TEMPLATE,
  );
  const [folderId, setFolderId] = useState<string | null>(
    initial?.folder_id ?? null,
  );
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
  const [picker, setPicker] = useState<Picker>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const forClient = isEdit ? Boolean(clientName) : target !== TEMPLATE;
  const targetLabel =
    target === TEMPLATE
      ? "Plantilla (en una carpeta)"
      : (clients.find((c) => c.id === target)?.name ?? "Cliente");
  const folderLabel =
    folderId === NEW_FOLDER
      ? "Crear carpeta nueva"
      : (folders.find((f) => f.id === folderId)?.name ?? null);

  // --- mutadores ---------------------------------------------------------------
  const updateMeal = (key: string, patch: Partial<MealDraft>) =>
    setMeals((ms) => ms.map((m) => (m.key === key ? { ...m, ...patch } : m)));
  const updateOption = (
    mealKey: string,
    optKey: string,
    fn: (o: OptionDraft) => OptionDraft,
  ) =>
    setMeals((ms) =>
      ms.map((m) =>
        m.key === mealKey
          ? {
              ...m,
              options: m.options.map((o) => (o.key === optKey ? fn(o) : o)),
            }
          : m,
      ),
    );
  const updateItem = (
    mealKey: string,
    optKey: string,
    itemKey: string,
    patch: Partial<ItemDraft>,
  ) =>
    updateOption(mealKey, optKey, (o) => ({
      ...o,
      items: o.items.map((i) => (i.key === itemKey ? { ...i, ...patch } : i)),
    }));
  const addMeal = () => {
    const used = new Set(meals.map((m) => m.name));
    setMeals((ms) => [
      ...ms,
      draftMeal(MEAL_SUGGESTIONS.find((s) => !used.has(s)) ?? ""),
    ]);
  };

  // --- guardar -----------------------------------------------------------------
  const submit = async () => {
    setError(null);
    let folderPayload: string | null = null;
    let newFolderPayload: string | null = null;
    if (!forClient) {
      if (folderId === NEW_FOLDER) {
        if (!newFolderName.trim())
          return setError("Poné un nombre para la carpeta nueva.");
        newFolderPayload = newFolderName.trim();
      } else if (folderId) {
        folderPayload = folderId;
      } else {
        return setError("Elegí o creá una carpeta para guardar la plantilla.");
      }
    }

    setSaving(true);
    const result = await savePlan(supabase, planId ?? null, {
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
    });
    setSaving(false);
    if (!result.ok) return setError(result.error);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {},
    );
    if (isEdit) router.back();
    else router.replace(`/nutricion/${result.data.id}`);
  };

  const day = dayRange(meals);

  const select = (
    label: string,
    value: string | null,
    placeholder: string,
    onPress: () => void,
  ) => (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        onPress={onPress}
        style={styles.select}
        accessibilityRole="button"
      >
        <Text
          style={[
            styles.selectText,
            !value && { color: colors.mutedForeground },
          ]}
          numberOfLines={1}
        >
          {value ?? placeholder}
        </Text>
        <Ionicons
          name="chevron-down"
          size={18}
          color={colors.mutedForeground}
        />
      </Pressable>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <TextField
          label="Nombre del plan"
          value={name}
          onChangeText={setName}
          placeholder="Volumen 2800 kcal"
        />

        {!isEdit ? (
          <View style={{ gap: 4 }}>
            {select("¿Para quién es?", targetLabel, "", () =>
              setPicker({ kind: "target" }),
            )}
            <Text style={styles.hint}>
              {forClient
                ? "Es solo de este cliente: cambiarlo no afecta a nadie más."
                : "Las plantillas no las ve nadie: sirven para armarles planes a tus clientes."}
            </Text>
          </View>
        ) : null}

        {isEdit && clientName ? (
          <Text style={styles.hint}>
            Plan de:{" "}
            <Text
              style={{ color: colors.foreground, fontFamily: fonts.medium }}
            >
              {clientName}
            </Text>
          </Text>
        ) : null}

        {!forClient ? (
          <View style={{ gap: 8 }}>
            {select("Carpeta", folderLabel, "Elegí una carpeta", () =>
              setPicker({ kind: "folder" }),
            )}
            {folderId === NEW_FOLDER ? (
              <TextField
                value={newFolderName}
                onChangeText={setNewFolderName}
                placeholder="Nombre de la carpeta (ej: Volumen)"
                autoFocus
              />
            ) : null}
          </View>
        ) : null}

        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Objetivos (opcional)</Text>
          {day.hasData ? (
            <Text style={styles.hint}>Plan actual: {macroLine(day)}</Text>
          ) : null}
          <View style={styles.targetGrid}>
            {TARGETS.map(([key, label]) => (
              <View key={key} style={styles.targetCell}>
                <TextField
                  label={label}
                  value={targets[key]}
                  onChangeText={(v) =>
                    setTargets((t) => ({ ...t, [key]: sanitizeDecimal(v) }))
                  }
                  keyboardType="decimal-pad"
                  inputMode="decimal"
                  style={styles.compact}
                />
              </View>
            ))}
          </View>
          <TextField
            label="Indicaciones generales (opcional)"
            value={guidelines}
            onChangeText={setGuidelines}
            multiline
            style={styles.multiline}
            placeholder="Hidratación, suplementos, alimentos a evitar…"
          />
        </Card>

        {meals.map((meal) => {
          const range = mealRange(meal.options);
          return (
            <Card key={meal.key} style={styles.card}>
              <View style={styles.mealHeader}>
                <View style={{ flex: 1 }}>
                  <TextField
                    label="Comida"
                    value={meal.name}
                    onChangeText={(v) => updateMeal(meal.key, { name: v })}
                    placeholder="Desayuno"
                  />
                </View>
                <View style={{ width: 84 }}>
                  <TextField
                    label="Horario"
                    value={meal.time_label}
                    onChangeText={(v) =>
                      updateMeal(meal.key, { time_label: v })
                    }
                    placeholder="8:00"
                  />
                </View>
                <IconButton
                  icon="list-outline"
                  label="Elegir nombre"
                  onPress={() => setPicker({ kind: "meal", mealKey: meal.key })}
                />
                <IconButton
                  icon="trash-outline"
                  label="Eliminar comida"
                  onPress={() =>
                    setMeals((ms) => ms.filter((m) => m.key !== meal.key))
                  }
                  disabled={meals.length === 1}
                />
              </View>

              {meal.options.map((opt, oi) => {
                const t = optionTotals(opt.items);
                return (
                  <View
                    key={opt.key}
                    style={[
                      { gap: 10 },
                      meal.options.length > 1 && styles.optionBox,
                    ]}
                  >
                    {meal.options.length > 1 ? (
                      <View style={styles.optionHeader}>
                        <Text style={styles.optionLabel}>
                          {optionLabel(oi)}
                        </Text>
                        <Pressable
                          onPress={() =>
                            updateMeal(meal.key, {
                              options: meal.options.filter(
                                (o) => o.key !== opt.key,
                              ),
                            })
                          }
                          hitSlop={8}
                        >
                          <Text style={styles.link}>Quitar opción</Text>
                        </Pressable>
                      </View>
                    ) : null}

                    {opt.items.map((item) => (
                      <View key={item.key} style={styles.item}>
                        <View style={styles.itemRow}>
                          <View style={{ flex: 1 }}>
                            <TextField
                              value={item.food}
                              onChangeText={(v) =>
                                updateItem(meal.key, opt.key, item.key, {
                                  food: v,
                                })
                              }
                              placeholder="Alimento (ej: Avena)"
                              style={styles.compact}
                              accessibilityLabel="Alimento"
                            />
                          </View>
                          <IconButton
                            icon="close"
                            label="Quitar alimento"
                            onPress={() =>
                              updateOption(meal.key, opt.key, (o) => ({
                                ...o,
                                items:
                                  o.items.length > 1
                                    ? o.items.filter((i) => i.key !== item.key)
                                    : [draftItem()],
                              }))
                            }
                          />
                        </View>
                        <View style={styles.itemRow}>
                          <View style={{ width: 80 }}>
                            <TextField
                              value={item.amount}
                              onChangeText={(v) =>
                                updateItem(meal.key, opt.key, item.key, {
                                  amount: v,
                                })
                              }
                              placeholder="Cant."
                              keyboardType="decimal-pad"
                              inputMode="decimal"
                              style={styles.compact}
                              accessibilityLabel="Cantidad"
                            />
                          </View>
                          <Pressable
                            onPress={() =>
                              setPicker({
                                kind: "unit",
                                mealKey: meal.key,
                                optKey: opt.key,
                                itemKey: item.key,
                              })
                            }
                            style={[styles.select, styles.unit]}
                            accessibilityRole="button"
                            accessibilityLabel="Unidad"
                          >
                            <Text
                              style={[
                                styles.selectText,
                                styles.unitText,
                                !item.unit && { color: colors.mutedForeground },
                              ]}
                              numberOfLines={1}
                            >
                              {item.unit || "Unidad"}
                            </Text>
                            <Ionicons
                              name="chevron-down"
                              size={16}
                              color={colors.mutedForeground}
                            />
                          </Pressable>
                        </View>
                        <View style={styles.itemRow}>
                          {MACROS.map(([key, label]) => (
                            <View key={key} style={{ flex: 1, gap: 2 }}>
                              <Text style={styles.macroLabel}>{label}</Text>
                              <TextField
                                value={item[key]}
                                onChangeText={(v) =>
                                  updateItem(meal.key, opt.key, item.key, {
                                    [key]: sanitizeDecimal(v),
                                  })
                                }
                                placeholder="—"
                                keyboardType="decimal-pad"
                                inputMode="decimal"
                                style={[styles.compact, styles.macro]}
                                accessibilityLabel={label}
                              />
                            </View>
                          ))}
                        </View>
                      </View>
                    ))}

                    <View style={styles.optionFooter}>
                      <Pressable
                        onPress={() =>
                          updateOption(meal.key, opt.key, (o) => ({
                            ...o,
                            items: [...o.items, draftItem()],
                          }))
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
                title={`Agregar opción ${String.fromCharCode(65 + meal.options.length)}`}
                variant="outline"
                onPress={() =>
                  updateMeal(meal.key, {
                    options: [...meal.options, draftOption()],
                  })
                }
                icon={
                  <Ionicons name="add" size={18} color={colors.foreground} />
                }
              />
              {meal.options.length > 1 && range.hasData ? (
                <Text style={styles.hint}>Comida: {macroLine(range)}</Text>
              ) : null}
            </Card>
          );
        })}

        <Button
          title="Agregar comida"
          variant="secondary"
          onPress={addMeal}
          icon={<Ionicons name="add" size={18} color={colors.foreground} />}
        />
      </ScrollView>

      <View
        style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}
      >
        {day.hasData ? (
          <Text style={[styles.hint, { textAlign: "center" }]}>
            Total del día: {macroLine(day)}
          </Text>
        ) : null}
        {error ? <ErrorText>{error}</ErrorText> : null}
        <Button
          title={isEdit ? "Guardar cambios" : "Crear plan"}
          onPress={submit}
          loading={saving}
        />
      </View>

      <Sheet
        visible={picker !== null}
        onClose={() => setPicker(null)}
        title={
          picker?.kind === "target"
            ? "¿Para quién es?"
            : picker?.kind === "folder"
              ? "Carpeta"
              : picker?.kind === "meal"
                ? "Comida"
                : "Unidad"
        }
      >
        <ScrollView style={{ maxHeight: 420 }}>
          {picker?.kind === "target" ? (
            <OptionList
              value={target}
              options={[
                {
                  value: TEMPLATE,
                  label: "Plantilla (en una carpeta)",
                  icon: "albums-outline" as const,
                },
                ...clients.map((c) => ({
                  value: c.id,
                  label: c.name,
                  icon: "person-outline" as const,
                })),
              ]}
              onSelect={(v) => {
                setTarget(v);
                setPicker(null);
              }}
            />
          ) : picker?.kind === "folder" ? (
            <OptionList
              value={folderId}
              options={[
                ...folders.map((f) => ({
                  value: f.id,
                  label: f.name,
                  icon: "folder-outline" as const,
                })),
                {
                  value: NEW_FOLDER,
                  label: "Crear carpeta nueva",
                  icon: "add" as const,
                },
              ]}
              onSelect={(v) => {
                setFolderId(v);
                setPicker(null);
              }}
            />
          ) : picker?.kind === "meal" ? (
            <OptionList
              value={meals.find((m) => m.key === picker.mealKey)?.name ?? null}
              options={MEAL_SUGGESTIONS.map((s) => ({ value: s, label: s }))}
              onSelect={(v) => {
                updateMeal(picker.mealKey, { name: v });
                setPicker(null);
              }}
            />
          ) : picker?.kind === "unit" ? (
            <OptionList
              value={
                meals
                  .find((m) => m.key === picker.mealKey)
                  ?.options.find((o) => o.key === picker.optKey)
                  ?.items.find((i) => i.key === picker.itemKey)?.unit ?? null
              }
              options={FOOD_UNITS.map((u) => ({ value: u, label: u }))}
              onSelect={(v) => {
                updateItem(picker.mealKey, picker.optKey, picker.itemKey, {
                  unit: v,
                });
                setPicker(null);
              }}
            />
          ) : null}
        </ScrollView>
      </Sheet>
    </KeyboardAvoidingView>
  );
}

function IconButton({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      accessibilityRole="button"
      hitSlop={8}
      style={[styles.iconButton, disabled && { opacity: 0.35 }]}
    >
      <Ionicons name={icon} size={20} color={colors.mutedForeground} />
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 32, gap: 16 },
  label: { fontFamily: fonts.medium, fontSize: 14, color: colors.foreground },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.mutedForeground,
  },
  select: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.input,
    backgroundColor: colors.field,
  },
  selectText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.foreground,
  },
  card: { padding: 14, gap: 12 },
  cardTitle: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.foreground,
  },
  targetGrid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4 },
  targetCell: { width: "50%", paddingHorizontal: 4, paddingBottom: 8 },
  multiline: { minHeight: 72, textAlignVertical: "top", paddingTop: 12 },
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
  item: {
    gap: 6,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  compact: { minHeight: 40, paddingVertical: 6, fontSize: 15 },
  macro: { paddingHorizontal: 8, textAlign: "center" },
  macroLabel: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.mutedForeground,
    textAlign: "center",
  },
  unit: { flex: 1, minHeight: 40 },
  unitText: { fontSize: 15 },
  optionFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  addItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  link: { fontFamily: fonts.medium, fontSize: 14, color: colors.primaryText },
  iconButton: {
    width: 36,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
}));

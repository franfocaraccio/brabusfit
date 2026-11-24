import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useReducer, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  buildPlanPayload,
  dayRange,
  draftPlanMeal,
  findPlanItem,
  initialPlanMeals,
  initialPlanTargets,
  initialRoutineTarget,
  macroLine,
  NEW_FOLDER,
  nextMealName,
  planIsForClient,
  planMealsReducer,
  planTargetHint,
  ROUTINE_TEMPLATE,
  ROUTINE_TEMPLATE_LABEL,
  type PlanInput,
} from "@brabus/shared";
import {
  savePlan,
  type ClientSummary,
  type FolderLite,
} from "@brabus/supabase";

import { ErrorText } from "@/components/forms";
import { MealCard } from "@/components/plan-editor/meal-card";
import {
  PlanPickerSheet,
  type PlanPicker,
} from "@/components/plan-editor/plan-picker-sheet";
import { PlanTargetsCard } from "@/components/plan-editor/plan-targets-card";
import { SelectField } from "@/components/routine-editor/select-field";
import { Button, TextField } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { fonts, makeStyles, useColors } from "@/lib/theme";

let seq = 0;
const newKey = () => `p${Date.now().toString(36)}${(seq++).toString(36)}`;

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
  const [picker, setPicker] = useState<PlanPicker>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const forClient = planIsForClient(isEdit, clientName, target);
  const targetLabel =
    target === ROUTINE_TEMPLATE
      ? ROUTINE_TEMPLATE_LABEL
      : (clients.find((c) => c.id === target)?.name ?? "Cliente");
  const folderLabel =
    folderId === NEW_FOLDER
      ? "Crear carpeta nueva"
      : (folders.find((f) => f.id === folderId)?.name ?? null);

  const submit = async () => {
    setError(null);
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
    if (!built.ok) return setError(built.error);

    setSaving(true);
    const result = await savePlan(supabase, planId ?? null, built.payload);
    setSaving(false);
    if (!result.ok) return setError(result.error);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {},
    );
    if (isEdit) router.back();
    else router.replace(`/nutricion/${result.data.id}`);
  };

  // Lo elegido hoy en el selector abierto.
  const pickerValue =
    picker?.kind === "target"
      ? target
      : picker?.kind === "folder"
        ? folderId
        : picker?.kind === "meal"
          ? (meals.find((m) => m.key === picker.mealKey)?.name ?? null)
          : picker?.kind === "unit"
            ? (findPlanItem(
                meals,
                picker.mealKey,
                picker.optKey,
                picker.itemKey,
              )?.unit ?? null)
            : null;

  const onPick = (v: string) => {
    if (picker?.kind === "target") setTarget(v);
    else if (picker?.kind === "folder") setFolderId(v);
    else if (picker?.kind === "meal")
      dispatch({
        type: "updateMeal",
        mealKey: picker.mealKey,
        patch: { name: v },
      });
    else if (picker?.kind === "unit")
      dispatch({
        type: "updateItem",
        mealKey: picker.mealKey,
        optKey: picker.optKey,
        itemKey: picker.itemKey,
        patch: { unit: v },
      });
    setPicker(null);
  };

  const day = dayRange(meals);

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
            <SelectField
              label="¿Para quién es?"
              value={targetLabel}
              onPress={() => setPicker({ kind: "target" })}
            />
            <Text style={styles.hint}>{planTargetHint(forClient)}</Text>
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
            <SelectField
              label="Carpeta"
              value={folderLabel}
              placeholder="Elegí una carpeta"
              onPress={() => setPicker({ kind: "folder" })}
            />
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

        <PlanTargetsCard
          day={day}
          targets={targets}
          guidelines={guidelines}
          onTargetChange={(field, value) =>
            setTargets((t) => ({ ...t, [field]: value }))
          }
          onGuidelinesChange={setGuidelines}
        />

        {meals.map((meal) => (
          <MealCard
            key={meal.key}
            meal={meal}
            canRemove={meals.length > 1}
            dispatch={dispatch}
            newKey={newKey}
            onPickName={() => setPicker({ kind: "meal", mealKey: meal.key })}
            onPickUnit={(optKey, itemKey) =>
              setPicker({ kind: "unit", mealKey: meal.key, optKey, itemKey })
            }
          />
        ))}

        <Button
          title="Agregar comida"
          variant="secondary"
          onPress={() =>
            dispatch({
              type: "addMeal",
              meal: draftPlanMeal(newKey, nextMealName(meals)),
            })
          }
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

      <PlanPickerSheet
        picker={picker}
        value={pickerValue}
        clients={clients}
        folders={folders}
        onClose={() => setPicker(null)}
        onSelect={onPick}
      />
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 32, gap: 16 },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.mutedForeground,
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

import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { CatalogEntry, RoutineDayInput } from "@brabus/shared";
import {
  createRoutine,
  updateRoutine,
  type EditableRoutine,
  type FolderLite,
  type ClientSummary,
} from "@brabus/supabase";

import { ExercisePicker } from "@/components/exercise-picker";
import { ErrorText } from "@/components/forms";
import { OptionList, Sheet } from "@/components/sheet";
import { Button, Card, TextField } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { colors, fonts, radius } from "@/lib/theme";

type ExerciseDraft = {
  key: string;
  id?: string;
  catalog: CatalogEntry | null;
  variant: string;
  sets_reps: string;
};
type DayDraft = {
  key: string;
  id?: string;
  name: string;
  exercises: ExerciseDraft[];
};

const NEW_FOLDER = "__new__";
/** Destino "plantilla" (en vez de un cliente). */
const TEMPLATE = "__template__";
let keySeq = 0;
const newKey = () => `k${Date.now().toString(36)}${(keySeq++).toString(36)}`;

const emptyExercise = (): ExerciseDraft => ({
  key: newKey(),
  catalog: null,
  variant: "",
  sets_reps: "",
});
const emptyDay = (): DayDraft => ({
  key: newKey(),
  name: "",
  exercises: [emptyExercise()],
});

/** Mueve el elemento `index` una posición (-1 arriba, +1 abajo). */
function move<T>(list: T[], index: number, delta: -1 | 1): T[] {
  const to = index + delta;
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}

/**
 * Crear / editar rutina (mismo comportamiento que RoutineBuilder de la web):
 * nombre, destino del coach (plantilla en una carpeta o rutina de un cliente),
 * días y ejercicios.
 */
export function RoutineBuilder({
  folders,
  catalog,
  isCoach,
  initial,
  clients = [],
  initialClientId,
}: {
  folders: FolderLite[];
  /** Catálogo de ejercicios disponible (general + propios). */
  catalog: CatalogEntry[];
  isCoach: boolean;
  initial?: EditableRoutine;
  /** Coach, al crear: clientes a los que se le puede armar la rutina. */
  clients?: ClientSummary[];
  /** Alumno elegido de entrada (viene de su pantalla). */
  initialClientId?: string;
}) {
  const insets = useSafeAreaInsets();
  const isEdit = Boolean(initial);

  const [name, setName] = useState(initial?.name ?? "");
  const [folderId, setFolderId] = useState<string | null>(
    initial?.folderId ?? null,
  );
  const [newFolderName, setNewFolderName] = useState("");
  const [folderSheet, setFolderSheet] = useState(false);
  const [target, setTarget] = useState<string>(
    initialClientId && clients.some((c) => c.id === initialClientId)
      ? initialClientId
      : TEMPLATE,
  );
  const [targetSheet, setTargetSheet] = useState(false);
  const forClient = isEdit ? Boolean(initial?.clientName) : target !== TEMPLATE;
  const usesFolder = isCoach && !forClient;
  const targetLabel =
    target === TEMPLATE
      ? "Plantilla (en una carpeta)"
      : (clients.find((c) => c.id === target)?.name ?? "Cliente");
  const [days, setDays] = useState<DayDraft[]>(
    initial
      ? initial.days.map((d) => ({
          key: d.id,
          id: d.id,
          name: d.name,
          exercises: d.exercises.map((e) => ({
            key: e.id,
            id: e.id,
            catalog: e.catalog,
            variant: e.variant ?? "",
            sets_reps: e.sets_reps,
          })),
        }))
      : [emptyDay()],
  );
  // Catálogo local: suma los ejercicios propios que se crean en el momento.
  const [catalogList, setCatalogList] = useState<CatalogEntry[]>(catalog);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const folderLabel =
    folderId === NEW_FOLDER
      ? "Crear carpeta nueva"
      : (folders.find((f) => f.id === folderId)?.name ?? null);

  // --- mutadores ---------------------------------------------------------------
  const updateDay = (key: string, patch: Partial<DayDraft>) =>
    setDays((d) =>
      d.map((day) => (day.key === key ? { ...day, ...patch } : day)),
    );
  const removeDay = (key: string) =>
    setDays((d) => d.filter((day) => day.key !== key));
  const moveDay = (index: number, delta: -1 | 1) =>
    setDays((d) => move(d, index, delta));
  const moveExercise = (dayKey: string, index: number, delta: -1 | 1) =>
    setDays((d) =>
      d.map((day) =>
        day.key === dayKey
          ? { ...day, exercises: move(day.exercises, index, delta) }
          : day,
      ),
    );
  const addExercise = (dayKey: string) =>
    setDays((d) =>
      d.map((day) =>
        day.key === dayKey
          ? { ...day, exercises: [...day.exercises, emptyExercise()] }
          : day,
      ),
    );
  const updateExercise = (
    dayKey: string,
    exKey: string,
    patch: Partial<ExerciseDraft>,
  ) =>
    setDays((d) =>
      d.map((day) =>
        day.key === dayKey
          ? {
              ...day,
              exercises: day.exercises.map((ex) =>
                ex.key === exKey ? { ...ex, ...patch } : ex,
              ),
            }
          : day,
      ),
    );
  const removeExercise = (dayKey: string, exKey: string) =>
    setDays((d) =>
      d.map((day) =>
        day.key === dayKey
          ? {
              ...day,
              exercises: day.exercises.filter((ex) => ex.key !== exKey),
            }
          : day,
      ),
    );

  // --- guardar -----------------------------------------------------------------
  const submit = async () => {
    setError(null);
    let folderIdPayload: string | null = null;
    let newFolderNamePayload: string | null = null;
    if (usesFolder) {
      if (folderId === NEW_FOLDER) {
        if (!newFolderName.trim()) {
          setError("Poné un nombre para la carpeta nueva.");
          return;
        }
        newFolderNamePayload = newFolderName.trim();
      } else if (folderId) {
        folderIdPayload = folderId;
      } else {
        setError("Elegí o creá una carpeta para guardar la rutina.");
        return;
      }
    }

    const payloadDays: RoutineDayInput[] = days.map((day) => ({
      id: day.id,
      name: day.name.trim(),
      exercises: day.exercises.map((ex) => ({
        id: ex.id,
        catalog_id: ex.catalog?.id,
        variant: ex.variant.trim() || null,
        sets_reps: ex.sets_reps.trim(),
      })),
    }));
    const payload = {
      name: name.trim(),
      folderId: folderIdPayload,
      newFolderName: newFolderNamePayload,
      clientId: !isEdit && forClient ? target : null,
      days: payloadDays,
    };

    setSaving(true);
    const result = isEdit
      ? await updateRoutine(supabase, initial!.id, payload)
      : await createRoutine(supabase, payload);
    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {},
    );
    if (isEdit) router.back();
    else router.replace(`/rutina/${result.data.id}`);
  };

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
          label="Nombre de la rutina"
          value={name}
          onChangeText={setName}
          placeholder="Junio 2026 4 días"
        />

        {isCoach && !isEdit ? (
          <View style={{ gap: 6 }}>
            <Text style={styles.label}>¿Para quién es?</Text>
            <Pressable
              onPress={() => setTargetSheet(true)}
              style={styles.select}
              accessibilityRole="button"
            >
              <Ionicons
                name={forClient ? "person-outline" : "albums-outline"}
                size={18}
                color={colors.mutedForeground}
              />
              <Text style={styles.selectText} numberOfLines={1}>
                {targetLabel}
              </Text>
              <Ionicons
                name="chevron-down"
                size={18}
                color={colors.mutedForeground}
              />
            </Pressable>
            <Text style={styles.hint}>
              {forClient
                ? "Es solo de este cliente: cambiarla no afecta a nadie más."
                : "Las plantillas no las ve nadie: sirven para armarles rutinas a tus clientes."}
            </Text>
          </View>
        ) : null}

        {isCoach && isEdit && initial?.clientName ? (
          <Text style={styles.hint}>
            Rutina de:{" "}
            <Text
              style={{ color: colors.foreground, fontFamily: fonts.medium }}
            >
              {initial.clientName}
            </Text>
          </Text>
        ) : null}

        {usesFolder ? (
          <View style={{ gap: 6 }}>
            <Text style={styles.label}>Carpeta</Text>
            <Pressable
              onPress={() => setFolderSheet(true)}
              style={styles.select}
              accessibilityRole="button"
            >
              <Ionicons
                name="folder-outline"
                size={18}
                color={colors.mutedForeground}
              />
              <Text
                style={[
                  styles.selectText,
                  !folderLabel && { color: colors.mutedForeground },
                ]}
                numberOfLines={1}
              >
                {folderLabel ?? "Elegí una carpeta"}
              </Text>
              <Ionicons
                name="chevron-down"
                size={18}
                color={colors.mutedForeground}
              />
            </Pressable>
            {folderId === NEW_FOLDER ? (
              <TextField
                value={newFolderName}
                onChangeText={setNewFolderName}
                placeholder="Nombre de la carpeta (ej: Fuerza)"
                autoFocus
              />
            ) : null}
          </View>
        ) : null}

        {days.map((day, dayIdx) => (
          <Card key={day.key} style={styles.dayCard}>
            <View style={styles.dayHeader}>
              <View style={{ flex: 1 }}>
                <TextField
                  label={`Día ${dayIdx + 1}`}
                  value={day.name}
                  onChangeText={(v) => updateDay(day.key, { name: v })}
                  placeholder="Día 1 - Piernas"
                />
              </View>
              <IconButton
                icon="chevron-up"
                label="Subir día"
                onPress={() => moveDay(dayIdx, -1)}
                disabled={dayIdx === 0}
              />
              <IconButton
                icon="chevron-down"
                label="Bajar día"
                onPress={() => moveDay(dayIdx, 1)}
                disabled={dayIdx === days.length - 1}
              />
              <IconButton
                icon="trash-outline"
                label="Eliminar día"
                onPress={() => removeDay(day.key)}
                disabled={days.length === 1}
              />
            </View>

            {day.exercises.map((ex, exIdx) => (
              <View key={ex.key} style={styles.exercise}>
                <View style={{ flex: 1, gap: 8 }}>
                  <ExercisePicker
                    value={ex.catalog}
                    catalog={catalogList}
                    onChange={(entry) =>
                      updateExercise(day.key, ex.key, { catalog: entry })
                    }
                    onCreated={(entry) =>
                      setCatalogList((list) => [...list, entry])
                    }
                  />
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <TextField
                        value={ex.sets_reps}
                        onChangeText={(v) =>
                          updateExercise(day.key, ex.key, { sets_reps: v })
                        }
                        placeholder="4 x (10 a 12)"
                        accessibilityLabel="Series y repeticiones"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <TextField
                        value={ex.variant}
                        onChangeText={(v) =>
                          updateExercise(day.key, ex.key, { variant: v })
                        }
                        placeholder="Variante"
                        accessibilityLabel="Variante"
                      />
                    </View>
                  </View>
                </View>
                <View style={styles.exerciseActions}>
                  <IconButton
                    compact
                    icon="chevron-up"
                    label="Subir ejercicio"
                    onPress={() => moveExercise(day.key, exIdx, -1)}
                    disabled={exIdx === 0}
                  />
                  <IconButton
                    compact
                    icon="trash-outline"
                    label="Eliminar ejercicio"
                    onPress={() => removeExercise(day.key, ex.key)}
                    disabled={day.exercises.length === 1}
                  />
                  <IconButton
                    compact
                    icon="chevron-down"
                    label="Bajar ejercicio"
                    onPress={() => moveExercise(day.key, exIdx, 1)}
                    disabled={exIdx === day.exercises.length - 1}
                  />
                </View>
              </View>
            ))}

            <Button
              title="Agregar ejercicio"
              variant="outline"
              onPress={() => addExercise(day.key)}
              icon={<Ionicons name="add" size={18} color={colors.foreground} />}
            />
          </Card>
        ))}

        <Button
          title="Agregar día"
          variant="secondary"
          onPress={() => setDays((d) => [...d, emptyDay()])}
          icon={<Ionicons name="add" size={18} color={colors.foreground} />}
        />
      </ScrollView>

      <View
        style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}
      >
        {error ? <ErrorText>{error}</ErrorText> : null}
        <Button
          title={isEdit ? "Guardar cambios" : "Crear rutina"}
          onPress={submit}
          loading={saving}
        />
      </View>

      <Sheet
        visible={targetSheet}
        onClose={() => setTargetSheet(false)}
        title="¿Para quién es?"
      >
        <ScrollView style={{ maxHeight: 420 }}>
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
              setTargetSheet(false);
            }}
          />
        </ScrollView>
      </Sheet>

      <Sheet
        visible={folderSheet}
        onClose={() => setFolderSheet(false)}
        title="Carpeta"
      >
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
            setFolderSheet(false);
          }}
        />
      </Sheet>
    </KeyboardAvoidingView>
  );
}

function IconButton({
  icon,
  label,
  onPress,
  disabled,
  compact,
}: {
  /** Más bajo (columna de acciones de un ejercicio). */
  compact?: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      accessibilityRole="button"
      hitSlop={8}
      style={[
        styles.iconButton,
        compact && { height: 32 },
        disabled && { opacity: 0.35 },
      ]}
    >
      <Ionicons name={icon} size={20} color={colors.mutedForeground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  exerciseActions: {
    justifyContent: "space-between",
    alignItems: "center",
    gap: 6,
  },
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 32, gap: 16 },
  label: { fontFamily: fonts.medium, fontSize: 14, color: colors.foreground },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 13,
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
    backgroundColor: "rgba(43,51,61,0.4)",
  },
  selectText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.foreground,
  },
  dayCard: { padding: 14, gap: 12 },
  dayHeader: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  exercise: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(32,38,47,0.3)",
  },
  iconButton: {
    width: 44,
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
});

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
  buildRoutinePayload,
  emptyRoutineDay,
  initialRoutineTarget,
  NEW_FOLDER,
  ROUTINE_TEMPLATE,
  ROUTINE_TEMPLATE_LABEL,
  routineDaysReducer,
  routineDaysToDrafts,
  routineIsForClient,
  routineTargetHint,
  type CatalogEntry,
} from "@brabus/shared";
import {
  createRoutine,
  updateRoutine,
  type EditableRoutine,
  type FolderLite,
  type ClientSummary,
} from "@brabus/supabase";

import { ErrorText } from "@/components/forms";
import { DayCard } from "@/components/routine-editor/day-card";
import {
  FolderSheet,
  RestSheet,
  TargetSheet,
} from "@/components/routine-editor/routine-sheets";
import { SelectField } from "@/components/routine-editor/select-field";
import { Button, TextField } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { fonts, makeStyles, useColors } from "@/lib/theme";

let keySeq = 0;
const newKey = () => `k${Date.now().toString(36)}${(keySeq++).toString(36)}`;

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
  const colors = useColors();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const isEdit = Boolean(initial);

  const [name, setName] = useState(initial?.name ?? "");
  const [folderId, setFolderId] = useState<string | null>(
    initial?.folderId ?? null,
  );
  const [newFolderName, setNewFolderName] = useState("");
  const [folderSheet, setFolderSheet] = useState(false);
  const [target, setTarget] = useState<string>(() =>
    initialRoutineTarget(initialClientId, clients),
  );
  const [targetSheet, setTargetSheet] = useState(false);
  // Ejercicio al que se le elige el descanso.
  const [restFor, setRestFor] = useState<{
    dayKey: string;
    exKey: string;
    value: number | null;
  } | null>(null);
  const forClient = routineIsForClient(isEdit, initial?.clientName, target);
  const usesFolder = isCoach && !forClient;
  const targetLabel =
    target === ROUTINE_TEMPLATE
      ? ROUTINE_TEMPLATE_LABEL
      : (clients.find((c) => c.id === target)?.name ?? "Cliente");
  const [days, dispatch] = useReducer(routineDaysReducer, initial, (r) =>
    r ? routineDaysToDrafts(r.days) : [emptyRoutineDay(newKey)],
  );
  // Catálogo local: suma los ejercicios propios que se crean en el momento.
  const [catalogList, setCatalogList] = useState<CatalogEntry[]>(catalog);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const folderLabel =
    folderId === NEW_FOLDER
      ? "Crear carpeta nueva"
      : (folders.find((f) => f.id === folderId)?.name ?? null);

  const submit = async () => {
    setError(null);
    const built = buildRoutinePayload({
      name,
      days,
      isEdit,
      forClient,
      target,
      usesFolder,
      folderId,
      newFolderName,
    });
    if (!built.ok) {
      setError(built.error);
      return;
    }

    setSaving(true);
    const result = isEdit
      ? await updateRoutine(supabase, initial!.id, built.payload)
      : await createRoutine(supabase, built.payload);
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
          <SelectField
            label="¿Para quién es?"
            icon={forClient ? "person-outline" : "albums-outline"}
            value={targetLabel}
            onPress={() => setTargetSheet(true)}
          >
            <Text style={styles.hint}>{routineTargetHint(forClient)}</Text>
          </SelectField>
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
          <SelectField
            label="Carpeta"
            icon="folder-outline"
            value={folderLabel}
            placeholder="Elegí una carpeta"
            onPress={() => setFolderSheet(true)}
          >
            {folderId === NEW_FOLDER ? (
              <TextField
                value={newFolderName}
                onChangeText={setNewFolderName}
                placeholder="Nombre de la carpeta (ej: Fuerza)"
                autoFocus
              />
            ) : null}
          </SelectField>
        ) : null}

        {days.map((day, dayIdx) => (
          <DayCard
            key={day.key}
            day={day}
            index={dayIdx}
            total={days.length}
            catalog={catalogList}
            dispatch={dispatch}
            newKey={newKey}
            onCatalogCreated={(entry) =>
              setCatalogList((list) => [...list, entry])
            }
            onPickRest={(exKey, value) =>
              setRestFor({ dayKey: day.key, exKey, value })
            }
          />
        ))}

        <Button
          title="Agregar día"
          variant="secondary"
          onPress={() =>
            dispatch({ type: "addDay", day: emptyRoutineDay(newKey) })
          }
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

      <TargetSheet
        visible={targetSheet}
        target={target}
        clients={clients}
        onClose={() => setTargetSheet(false)}
        onSelect={(v) => {
          setTarget(v);
          setTargetSheet(false);
        }}
      />

      <RestSheet
        visible={restFor !== null}
        value={restFor?.value ?? null}
        onClose={() => setRestFor(null)}
        onSelect={(rest) => {
          if (restFor) {
            dispatch({
              type: "updateExercise",
              dayKey: restFor.dayKey,
              exKey: restFor.exKey,
              patch: { rest },
            });
          }
          setRestFor(null);
        }}
      />

      <FolderSheet
        visible={folderSheet}
        folderId={folderId}
        folders={folders}
        onClose={() => setFolderSheet(false)}
        onSelect={(v) => {
          setFolderId(v);
          setFolderSheet(false);
        }}
      />
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 32, gap: 16 },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 13,
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

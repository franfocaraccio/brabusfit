import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  formatSessionDate,
  NOTE_MAX_LENGTH,
  parseSetRows,
  sanitizeDecimal,
  setsToRows,
  summarizeHistory,
  type SessionLogUpdate,
} from "@brabus/shared";
import {
  deleteSession,
  getSessionDetail,
  updateSession,
  type SessionDetail,
} from "@brabus/supabase";

import { FieldHint } from "@/components/forms";
import { Loading, NotFound } from "@/components/loading";
import { Button, Card, Muted, TextField, Title } from "@/components/ui";
import { confirm, notify } from "@/lib/confirm";
import { supabase } from "@/lib/supabase";
import { colors, fonts, radius } from "@/lib/theme";
import { useAuth } from "@/providers/auth";

type Row = { key: string; weight: string; reps: string };
type LogState = { id: string; exerciseName: string; setsReps: string; note: string; rows: Row[] };

let keySeq = 0;
const newKey = () => `s${++keySeq}`;

function initialState(s: SessionDetail): LogState[] {
  return s.logs.map((l) => ({
    id: l.id,
    exerciseName: l.exerciseName,
    setsReps: l.setsReps,
    note: l.note ?? "",
    rows: (l.sets.length ? setsToRows(l.sets) : [{ weight: "", reps: "" }]).map((r) => ({
      key: newKey(),
      ...r,
    })),
  }));
}

const toPayload = (logs: LogState[]): SessionLogUpdate[] =>
  logs.map((l) => ({ log_id: l.id, note: l.note.trim() || null, sets: parseSetRows(l.rows) }));

/** Sesión pasada: editable para quien entrenó, solo lectura para el coach. */
export default function SesionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session: auth } = useAuth();
  const [detail, setDetail] = useState<SessionDetail | null | undefined>(undefined);

  useEffect(() => {
    getSessionDetail(supabase, id).then(setDetail);
  }, [id]);

  if (detail === undefined) return <Loading />;
  if (detail === null) return <NotFound text="No se encontró la sesión." />;

  const header = (
    <View style={{ gap: 2 }}>
      <Title>{detail.dayName}</Title>
      <Muted>
        {detail.routineName} · {formatSessionDate(detail.date)}
      </Muted>
    </View>
  );

  if (detail.userId !== auth?.user.id) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        {header}
        {detail.logs.map((l) => (
          <Card key={l.id} style={styles.card}>
            <Text style={styles.exName}>{l.exerciseName}</Text>
            <Muted>{summarizeHistory({ sets: l.sets, note: l.note }) || "Sin series"}</Muted>
          </Card>
        ))}
      </ScrollView>
    );
  }

  return <SessionEditor session={detail} header={header} />;
}

function SessionEditor({ session, header }: { session: SessionDetail; header: React.ReactNode }) {
  const [logs, setLogs] = useState<LogState[]>(() => initialState(session));
  const [savedPayload, setSavedPayload] = useState(() =>
    JSON.stringify(toPayload(initialState(session))),
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = JSON.stringify(toPayload(logs)) !== savedPayload;

  const updateLog = useCallback(
    (id: string, patch: (l: LogState) => LogState) => {
      setSaved(false);
      setLogs((ls) => ls.map((l) => (l.id === id ? patch(l) : l)));
    },
    [],
  );
  const setRow = (logId: string, key: string, patch: Partial<Row>) =>
    updateLog(logId, (l) => ({
      ...l,
      rows: l.rows.map((r) => (r.key === key ? { ...r, ...patch } : r)),
    }));

  const save = async () => {
    setSaving(true);
    setError(null);
    const payload = toPayload(logs);
    const result = await updateSession(supabase, session.id, payload);
    setSaving(false);
    if (!result.ok) return setError(result.error);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setSavedPayload(JSON.stringify(payload));
    setSaved(true);
  };

  const onDelete = () =>
    confirm({
      title: "Eliminar sesión",
      message: "Se eliminará este entrenamiento con todas sus series. Esta acción no se puede deshacer.",
      confirmText: "Eliminar",
      destructive: true,
      onConfirm: async () => {
        const result = await deleteSession(supabase, session.id);
        if (!result.ok) return notify("No se pudo eliminar", result.error);
        router.back();
      },
    });

  return (
    <SafeAreaView style={styles.screen} edges={["bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={90}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {header}
          {logs.map((l) => (
            <Card key={l.id} style={styles.card}>
              <View>
                <Text style={styles.exName}>{l.exerciseName}</Text>
                {l.setsReps ? <Text style={styles.exSets}>{l.setsReps}</Text> : null}
              </View>

              {l.rows.map((row, i) => (
                <View key={row.key} style={styles.setRow}>
                  <Text style={styles.setLabel}>Serie {i + 1}</Text>
                  <View style={{ flex: 1 }}>
                    <TextField
                      value={row.weight}
                      onChangeText={(v) => setRow(l.id, row.key, { weight: sanitizeDecimal(v) })}
                      placeholder="Peso"
                      keyboardType="decimal-pad"
                      suffix={row.weight.trim() !== "" ? "Kg" : undefined}
                      style={styles.compactInput}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <TextField
                      value={row.reps}
                      onChangeText={(v) => setRow(l.id, row.key, { reps: v.replace(/[^0-9]/g, "") })}
                      placeholder="Reps"
                      keyboardType="number-pad"
                      style={styles.compactInput}
                    />
                  </View>
                  <Pressable
                    onPress={() =>
                      updateLog(l.id, (x) => ({ ...x, rows: x.rows.filter((r) => r.key !== row.key) }))
                    }
                    disabled={l.rows.length === 1}
                    hitSlop={8}
                    accessibilityLabel="Quitar serie"
                    style={{ opacity: l.rows.length === 1 ? 0.3 : 1 }}
                  >
                    <Ionicons name="trash-outline" size={20} color={colors.foreground} />
                  </Pressable>
                </View>
              ))}

              <Button
                title="Agregar serie"
                variant="outline"
                onPress={() =>
                  updateLog(l.id, (x) => ({
                    ...x,
                    rows: [...x.rows, { key: newKey(), weight: "", reps: "" }],
                  }))
                }
                icon={<Ionicons name="add" size={18} color={colors.foreground} />}
                style={{ minHeight: 40 }}
              />

              <View style={{ gap: 6 }}>
                <Text style={styles.noteLabel}>Detalle (opcional)</Text>
                <TextInput
                  value={l.note}
                  onChangeText={(v) => updateLog(l.id, (x) => ({ ...x, note: v }))}
                  maxLength={NOTE_MAX_LENGTH}
                  placeholder="Ej: hecho en Smith"
                  placeholderTextColor={colors.mutedForeground}
                  selectionColor={colors.primary}
                  multiline
                  style={styles.note}
                />
              </View>
            </Card>
          ))}
          {logs.length === 0 ? <Muted>Esta sesión no tiene ejercicios.</Muted> : null}
        </ScrollView>

        <View style={styles.footer}>
          {error ? <FieldHint tone="error">{error}</FieldHint> : null}
          {saved && !dirty ? <FieldHint tone="success">Sesión actualizada</FieldHint> : null}
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Button
              title="Eliminar"
              variant="destructive"
              onPress={onDelete}
              icon={<Ionicons name="trash-outline" size={18} color={colors.destructive} />}
              style={{ minHeight: 44 }}
            />
            <Button
              title="Guardar cambios"
              onPress={save}
              disabled={!dirty}
              loading={saving}
              style={{ flex: 1, minHeight: 44 }}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 32, gap: 14 },
  card: { padding: 14, gap: 10 },
  exName: { fontFamily: fonts.semibold, fontSize: 16, color: colors.foreground },
  exSets: { fontFamily: fonts.regular, fontSize: 13, color: colors.mutedForeground },
  setRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  setLabel: { width: 54, fontFamily: fonts.regular, fontSize: 13, color: colors.mutedForeground },
  compactInput: { minHeight: 40, paddingVertical: 6, fontSize: 15 },
  noteLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.mutedForeground },
  note: {
    minHeight: 38,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.input,
    backgroundColor: "rgba(43,51,61,0.4)",
    paddingHorizontal: 14,
    paddingTop: 9,
    paddingBottom: 9,
    color: colors.foreground,
    fontFamily: fonts.regular,
    fontSize: 15,
    textAlignVertical: "top",
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
});

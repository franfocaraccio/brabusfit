import { Ionicons } from "@expo/vector-icons";
import { router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import {
  deleteRoutine,
  getRoutineDetail,
  getRoutineExport,
  type RoutineDetail,
} from "@brabus/supabase";

import { AccessBadge } from "@/components/clients";
import { Loading, NotFound } from "@/components/loading";
import { Tile } from "@/components/tile";
import { Button, Card, Muted, SectionLabel, Title } from "@/components/ui";
import { confirm, notify } from "@/lib/confirm";
import { shareRoutinePdf, shareRoutineXlsx } from "@/lib/export";
import { supabase } from "@/lib/supabase";
import { colors, fonts } from "@/lib/theme";
import { useAuth } from "@/providers/auth";

export default function RutinaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, profile } = useAuth();
  const [detail, setDetail] = useState<RoutineDetail | null | undefined>(undefined);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState<"pdf" | "xlsx" | null>(null);

  useFocusEffect(
    useCallback(() => {
      getRoutineDetail(supabase, id).then(setDetail);
    }, [id]),
  );

  if (detail === undefined) return <Loading />;
  if (detail === null) return <NotFound text="No se encontró la rutina." />;

  const { routine, days, client } = detail;
  const isOwner = routine.owner_id === session?.user.id;
  // Plantilla del coach: se asigna a un cliente creándole una copia propia.
  const canAssign = isOwner && (profile?.is_coach ?? false) && !routine.client_id;

  const onExport = async (kind: "pdf" | "xlsx") => {
    setExporting(kind);
    try {
      const data = await getRoutineExport(supabase, id, detail);
      if (data) await (kind === "pdf" ? shareRoutinePdf(data) : shareRoutineXlsx(data));
    } catch {
      notify("No se pudo exportar", "Probá de nuevo en un momento.");
    } finally {
      setExporting(null);
    }
  };

  const onDelete = () =>
    confirm({
      title: "Eliminar rutina",
      message: `Se eliminará «${routine.name}» y todos sus días y ejercicios. Esta acción no se puede deshacer.`,
      confirmText: "Eliminar",
      destructive: true,
      onConfirm: async () => {
        setDeleting(true);
        const result = await deleteRoutine(supabase, id);
        setDeleting(false);
        if (!result.ok) return notify("No se pudo eliminar", result.error);
        router.back();
      },
    });

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: "" }} />
      <View style={{ gap: 4 }}>
        <Title>{routine.name}</Title>
        {!isOwner ? (
          <Muted>
            Compartida por:{" "}
            <Text style={{ color: colors.foreground, fontFamily: fonts.medium }}>
              {detail.ownerName ?? "tu coach"}
            </Text>
          </Muted>
        ) : null}
        {isOwner && client ? (
          <View style={styles.studentRow}>
            <Muted>
              Rutina de:{" "}
              <Text
                style={{ color: colors.foreground, fontFamily: fonts.medium }}
                onPress={() => router.push(`/cliente/${client.id}`)}
              >
                {client.name}
              </Text>
            </Muted>
            <AccessBadge status={client.status} />
            {client.archived ? <Text style={styles.badge}>Archivado</Text> : null}
          </View>
        ) : null}
        {canAssign ? (
          <Muted style={{ fontSize: 13 }}>
            Plantilla: asignala a un cliente para crearle su propia copia.
          </Muted>
        ) : null}
      </View>

      <View style={styles.actions}>
        {isOwner ? (
          <Button
            title="Editar"
            variant="outline"
            style={styles.action}
            onPress={() => router.push(`/rutina/${id}/editar`)}
            icon={<Ionicons name="create-outline" size={18} color={colors.foreground} />}
          />
        ) : null}
        {canAssign ? (
          <Button
            title="Asignar a cliente"
            variant="outline"
            style={styles.action}
            onPress={() => router.push(`/rutina/${id}/asignar`)}
            icon={<Ionicons name="person-add-outline" size={18} color={colors.foreground} />}
          />
        ) : null}
        <Button
          title="PDF"
          variant="outline"
          style={styles.action}
          onPress={() => onExport("pdf")}
          loading={exporting === "pdf"}
          disabled={exporting !== null}
          icon={<Ionicons name="document-text-outline" size={18} color={colors.foreground} />}
        />
        <Button
          title="Excel"
          variant="outline"
          style={styles.action}
          onPress={() => onExport("xlsx")}
          loading={exporting === "xlsx"}
          disabled={exporting !== null}
          icon={<Ionicons name="grid-outline" size={18} color={colors.foreground} />}
        />
        <Button
          title="Historial"
          variant="outline"
          style={styles.action}
          onPress={() => router.push(`/rutina/${id}/historial`)}
          icon={<Ionicons name="time-outline" size={18} color={colors.foreground} />}
        />
        {isOwner ? (
          <Button
            title="Eliminar"
            variant="destructive"
            style={styles.action}
            onPress={onDelete}
            loading={deleting}
            icon={<Ionicons name="trash-outline" size={18} color={colors.destructive} />}
          />
        ) : null}
      </View>

      <View style={styles.section}>
        <SectionLabel>{client ? "Días" : "Elegí un día para entrenar"}</SectionLabel>
        {days.length > 0 ? (
          days.map((day, i) => (
            <Tile
              key={day.id}
              title={day.name}
              subtitle={`${day.exerciseCount} ejercicios`}
              chip={i + 1}
              accent
              onPress={() => router.push(`/rutina/${id}/dia/${day.id}`)}
            />
          ))
        ) : (
          <Card style={{ padding: 18 }}>
            <Muted>Esta rutina no tiene días.</Muted>
          </Card>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 40, gap: 20 },
  section: { gap: 10 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  action: { minHeight: 40, paddingHorizontal: 14, flexGrow: 1 },
  studentRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  badge: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    color: colors.mutedForeground,
    backgroundColor: colors.muted,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: "hidden",
  },
});

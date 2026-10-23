import { Ionicons } from "@expo/vector-icons";
import {
  router,
  Stack,
  useFocusEffect,
  useLocalSearchParams,
} from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { STUDENTS_CAN_EDIT_PLANS } from "@brabus/shared";
import {
  copyPlan,
  deletePlan,
  getPlanDetail,
  planExport,
  setCurrentPlan,
  type PlanDetail,
} from "@brabus/supabase";

import { AccessBadge } from "@/components/clients";
import { Loading, NotFound } from "@/components/loading";
import { PlanView } from "@/components/plan-view";
import { Button, Muted, Title } from "@/components/ui";
import { confirm, notify } from "@/lib/confirm";
import { sharePlanPdf, sharePlanXlsx } from "@/lib/export";
import { supabase } from "@/lib/supabase";
import { fonts, makeStyles, useColors } from "@/lib/theme";
import { useAuth } from "@/providers/auth";

/** Plan de nutrición (igual que /nutricion/[id] en la web). */
export default function PlanScreen() {
  const colors = useColors();
  const styles = useStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, profile } = useAuth();
  const [detail, setDetail] = useState<PlanDetail | null | undefined>(
    undefined,
  );
  const [busy, setBusy] = useState<
    "pdf" | "xlsx" | "current" | "delete" | "copy" | null
  >(null);

  const load = useCallback(() => {
    getPlanDetail(supabase, id).then(setDetail);
  }, [id]);

  useFocusEffect(load);

  if (detail === undefined) return <Loading />;
  if (detail === null) return <NotFound text="No se encontró el plan." />;

  const { plan, client, ownerName } = detail;
  const isCoach = profile?.is_coach ?? false;
  const isOwner = plan.owner_id === session?.user.id;
  const canEdit = isOwner && (isCoach || STUDENTS_CAN_EDIT_PLANS);
  const canAssign = isOwner && isCoach && !plan.client_id;

  // Plantilla: copia con "(copia)" en el nombre.
  const onDuplicate = async () => {
    setBusy("copy");
    const result = await copyPlan(supabase, id, null);
    setBusy(null);
    if (!result.ok) return notify("No se pudo duplicar", result.error);
    router.push(`/nutricion/${result.data.id}`);
  };

  const onExport = async (kind: "pdf" | "xlsx") => {
    setBusy(kind);
    try {
      const data = planExport(detail);
      await (kind === "pdf" ? sharePlanPdf(data) : sharePlanXlsx(data));
    } catch {
      notify("No se pudo exportar", "Probá de nuevo en un momento.");
    } finally {
      setBusy(null);
    }
  };

  const onSetCurrent = async () => {
    setBusy("current");
    const result = await setCurrentPlan(supabase, id);
    setBusy(null);
    if (!result.ok) return notify("No se pudo marcar", result.error);
    load();
  };

  const onDelete = () =>
    confirm({
      title: "Eliminar plan",
      message: `Se eliminará «${plan.name}» con todas sus comidas. Esta acción no se puede deshacer.`,
      confirmText: "Eliminar",
      destructive: true,
      onConfirm: async () => {
        setBusy("delete");
        const result = await deletePlan(supabase, id);
        setBusy(null);
        if (!result.ok) return notify("No se pudo eliminar", result.error);
        router.back();
      },
    });

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: "" }} />
      <View style={{ gap: 4 }}>
        <Title>{plan.name}</Title>
        <View style={styles.metaRow}>
          {plan.is_current ? <Text style={styles.current}>Vigente</Text> : null}
          {!isOwner ? (
            <Muted>
              De:{" "}
              <Text
                style={{ color: colors.foreground, fontFamily: fonts.medium }}
              >
                {ownerName ?? "tu coach"}
              </Text>
            </Muted>
          ) : null}
          {isOwner && client ? (
            <>
              <Muted>
                Plan de:{" "}
                <Text
                  style={{ color: colors.foreground, fontFamily: fonts.medium }}
                  onPress={() => router.push(`/cliente/${client.id}`)}
                >
                  {client.name}
                </Text>
              </Muted>
              <AccessBadge status={client.status} />
            </>
          ) : null}
        </View>
        {canAssign ? (
          <Muted style={{ fontSize: 13 }}>
            Plantilla: asignala a un cliente para crearle su propia copia.
          </Muted>
        ) : null}
      </View>

      <View style={styles.actions}>
        {canEdit ? (
          <Button
            title="Editar"
            variant="outline"
            style={styles.action}
            onPress={() => router.push(`/nutricion/${id}/editar`)}
            icon={
              <Ionicons
                name="create-outline"
                size={18}
                color={colors.foreground}
              />
            }
          />
        ) : null}
        {canAssign ? (
          <Button
            title="Duplicar"
            variant="outline"
            style={styles.action}
            onPress={onDuplicate}
            loading={busy === "copy"}
            icon={
              <Ionicons
                name="copy-outline"
                size={18}
                color={colors.foreground}
              />
            }
          />
        ) : null}
        {canAssign ? (
          <Button
            title="Asignar a cliente"
            variant="outline"
            style={styles.action}
            onPress={() => router.push(`/nutricion/${id}/asignar`)}
            icon={
              <Ionicons
                name="person-add-outline"
                size={18}
                color={colors.foreground}
              />
            }
          />
        ) : null}
        {isOwner && plan.client_id && !plan.is_current ? (
          <Button
            title="Marcar vigente"
            variant="outline"
            style={styles.action}
            onPress={onSetCurrent}
            loading={busy === "current"}
            icon={
              <Ionicons
                name="star-outline"
                size={18}
                color={colors.foreground}
              />
            }
          />
        ) : null}
        <Button
          title="PDF"
          variant="outline"
          style={styles.action}
          onPress={() => onExport("pdf")}
          loading={busy === "pdf"}
          disabled={busy !== null}
          icon={
            <Ionicons
              name="document-text-outline"
              size={18}
              color={colors.foreground}
            />
          }
        />
        <Button
          title="Excel"
          variant="outline"
          style={styles.action}
          onPress={() => onExport("xlsx")}
          loading={busy === "xlsx"}
          disabled={busy !== null}
          icon={
            <Ionicons name="grid-outline" size={18} color={colors.foreground} />
          }
        />
        {canEdit ? (
          <Button
            title="Eliminar"
            variant="destructive"
            style={styles.action}
            onPress={onDelete}
            loading={busy === "delete"}
            icon={
              <Ionicons
                name="trash-outline"
                size={18}
                color={colors.destructive}
              />
            }
          />
        ) : null}
      </View>

      <PlanView detail={detail} />
    </ScrollView>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 40, gap: 16 },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  current: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    color: colors.primaryText,
    backgroundColor: "rgba(249,115,22,0.15)",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: "hidden",
  },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  action: { minHeight: 40, paddingHorizontal: 14, flexGrow: 1 },
}));

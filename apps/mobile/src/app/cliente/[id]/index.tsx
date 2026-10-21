import { Ionicons } from "@expo/vector-icons";
import { router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import {
  ageFrom,
  formatDate,
  formatDisplayDate,
  formatSessionDate,
  goalLabel,
  levelLabel,
  sexLabel,
  summarizeHistory,
  type ProgressSession,
} from "@brabus/shared";
import {
  copyPlan,
  copyRoutine,
  deleteClient,
  getClient,
  getClientPlans,
  getNutritionOverview,
  getProgressSessions,
  getRoutinesOverview,
  removeClientAccess,
  setClientArchived,
  visibleLogs,
  type ClientDetail,
  type FolderLite,
  type RoutineLite,
} from "@brabus/supabase";

import { AccessBadge, Fact, FactCard, InviteClientSheet } from "@/components/clients";
import { Loading, NotFound } from "@/components/loading";
import { ProgressView } from "@/components/progress-view";
import { Segmented } from "@/components/segmented";
import { Sheet } from "@/components/sheet";
import { Tile } from "@/components/tile";
import { Button, Card, Muted, Title } from "@/components/ui";
import { confirm, notify } from "@/lib/confirm";
import { supabase } from "@/lib/supabase";
import { colors, fonts, radius } from "@/lib/theme";
import { useAuth } from "@/providers/auth";

type Tab = "ficha" | "rutinas" | "nutricion" | "progreso" | "entrenamientos";
type Kind = "routines" | "nutrition";
type Templates = { folders: FolderLite[]; items: RoutineLite[] };
const NO_TEMPLATES: Templates = { folders: [], items: [] };

/** Ficha del cliente: datos, rutinas, progreso y entrenamientos (igual que /clientes/[id]). */
export default function ClienteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const [tab, setTab] = useState<Tab>("ficha");
  const [detail, setDetail] = useState<ClientDetail | null | undefined>(undefined);
  const [progress, setProgress] = useState<ProgressSession[]>([]);
  const [templates, setTemplates] = useState<Record<Kind, Templates>>({
    routines: NO_TEMPLATES,
    nutrition: NO_TEMPLATES,
  });
  const [plans, setPlans] = useState<{ id: string; name: string; isCurrent: boolean }[]>([]);
  const [inviting, setInviting] = useState(false);
  // Hoja "Nueva rutina" / "Nuevo plan" (null = cerrada).
  const [newSheet, setNewSheet] = useState<Kind | null>(null);
  const [copying, setCopying] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    const [d, o, nu, p] = await Promise.all([
      getClient(supabase, session.user.id, id),
      getRoutinesOverview(supabase, session.user.id),
      getNutritionOverview(supabase, session.user.id),
      getClientPlans(supabase, id),
    ]);
    setDetail(d);
    setPlans(p);
    setTemplates({
      routines: { folders: o.folders, items: o.routines },
      nutrition: { folders: nu.folders, items: nu.plans },
    });
    setProgress(
      d?.appAccess === "active" && d.studentId ? await getProgressSessions(supabase, d.studentId) : [],
    );
  }, [id, session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (detail === undefined) return <Loading />;
  if (detail === null) return <NotFound text="No se encontró el cliente." />;

  const { name, data, appAccess, routines, sessions } = detail;
  const hasApp = appAccess === "active" && Boolean(detail.studentId);
  const n = routines.length;
  const keepsCopy =
    appAccess === "active" && n > 0
      ? ` Se queda con una copia propia de ${n === 1 ? "la rutina" : `las ${n} rutinas`} que le armaste, y vos conservás las tuyas.`
      : "";

  const run = async (action: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) => {
    const result = await action();
    if (!result.ok) return notify("No se pudo completar", result.error ?? "");
    if (after) after();
    else load();
  };

  const onRemoveAccess = () =>
    confirm({
      title: appAccess === "pending" ? "Cancelar invitación" : `Quitarle la app a ${name}`,
      message:
        appAccess === "pending"
          ? "La ficha queda como cliente sin app."
          : `Ya no vas a ver su progreso ni sus entrenamientos. La ficha queda como cliente sin app.${keepsCopy}`,
      confirmText: appAccess === "pending" ? "Cancelar invitación" : "Quitar acceso",
      destructive: true,
      onConfirm: () => run(() => removeClientAccess(supabase, id)),
    });

  const onArchive = () =>
    confirm({
      title: detail.archived ? `Reactivar a ${name}` : `Archivar a ${name}`,
      message: detail.archived
        ? "Vuelve a tu lista de clientes activos."
        : `Pasa a Archivados con sus datos y rutinas.${appAccess !== "none" ? " También se le quita el acceso a la app." : ""}${keepsCopy}`,
      confirmText: detail.archived ? "Reactivar" : "Archivar",
      destructive: !detail.archived,
      onConfirm: () => run(() => setClientArchived(supabase, id, !detail.archived)),
    });

  const onDelete = () =>
    confirm({
      title: `Eliminar a ${name}`,
      message: `Se borra la ficha y ${n === 1 ? "la rutina que le armaste" : `las ${n} rutinas que le armaste`}. No se puede deshacer.${keepsCopy ? " Como usa la app, antes se queda con su copia." : ""}`,
      confirmText: "Eliminar",
      destructive: true,
      onConfirm: () => run(() => deleteClient(supabase, id), () => router.back()),
    });

  const fromTemplate = async (templateId: string) => {
    if (!newSheet) return;
    setCopying(templateId);
    const result =
      newSheet === "nutrition"
        ? await copyPlan(supabase, templateId, id)
        : await copyRoutine(supabase, templateId, id);
    setCopying(null);
    if (!result.ok) return notify("No se pudo crear", result.error);
    const kind = newSheet;
    setNewSheet(null);
    router.push(kind === "nutrition" ? `/nutricion/${result.data.id}` : `/rutina/${result.data.id}`);
  };

  const sheetTemplates = templates[newSheet ?? "routines"];
  const templateGroups = [
    ...sheetTemplates.folders.map((f) => ({
      id: f.id,
      name: f.name,
      items: sheetTemplates.items.filter((r) => r.folder_id === f.id),
    })),
    { id: "__root__", name: "Sin carpeta", items: sheetTemplates.items.filter((r) => !r.folder_id) },
  ].filter((g) => g.items.length > 0);

  const age = ageFrom(data.birth_date);
  const empty = (text: string) => (
    <Card style={{ padding: 20 }}>
      <Muted style={{ textAlign: "center" }}>{text}</Muted>
    </Card>
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen
        options={{
          title: "",
          headerRight: () => (
            <Pressable onPress={() => router.push(`/cliente/${id}/editar`)} hitSlop={10}>
              <Text style={styles.headerAction}>Editar ficha</Text>
            </Pressable>
          ),
        }}
      />
      <View style={{ gap: 6 }}>
        <Title>{name}</Title>
        <View style={styles.badges}>
          <AccessBadge access={appAccess} />
          {detail.archived ? <Text style={styles.archived}>Archivado</Text> : null}
          {detail.username ? <Muted style={{ fontSize: 13 }}>@{detail.username}</Muted> : null}
        </View>
      </View>

      <View style={styles.actions}>
        {!detail.archived && appAccess === "none" ? (
          <Button
            title="Invitar a la app"
            variant="outline"
            style={styles.action}
            onPress={() => setInviting(true)}
            icon={<Ionicons name="phone-portrait-outline" size={18} color={colors.foreground} />}
          />
        ) : null}
        {appAccess !== "none" ? (
          <Button
            title={appAccess === "pending" ? "Cancelar invitación" : "Quitar acceso"}
            variant="outline"
            style={styles.action}
            onPress={onRemoveAccess}
            icon={<Ionicons name="person-remove-outline" size={18} color={colors.foreground} />}
          />
        ) : null}
        <Button
          title={detail.archived ? "Reactivar" : "Archivar"}
          variant="outline"
          style={styles.action}
          onPress={onArchive}
          icon={<Ionicons name="archive-outline" size={18} color={colors.foreground} />}
        />
        <Button
          title="Eliminar"
          variant="destructive"
          style={styles.action}
          onPress={onDelete}
          icon={<Ionicons name="trash-outline" size={18} color={colors.destructive} />}
        />
      </View>

      {appAccess === "pending" ? (
        <Card style={styles.pending}>
          <Text style={styles.pendingText}>
            <Text style={{ fontFamily: fonts.semibold }}>Invitación pendiente. </Text>
            Ya podés armarle rutinas: las va a ver cuando acepte. Su progreso aparece después de
            aceptar.
          </Text>
        </Card>
      ) : null}

      <Segmented
        fill
        value={tab}
        onChange={setTab}
        options={[
          { value: "ficha", label: "Ficha" },
          { value: "rutinas", label: "Rutinas" },
          { value: "nutricion", label: "Nutrición" },
          { value: "progreso", label: "Progreso" },
          { value: "entrenamientos", label: "Entren." },
        ]}
      />

      {tab === "ficha" ? (
        <>
          <FactCard>
            <Fact label="Teléfono" value={data.phone || null} />
            <Fact label="Email" value={data.email || null} />
            <Fact
              label="Nacimiento"
              value={
                data.birth_date
                  ? `${formatDisplayDate(data.birth_date)}${age !== null ? ` (${age})` : ""}`
                  : null
              }
            />
            <Fact label="Sexo" value={sexLabel(data.sex || null)} />
            <Fact
              label="Estatura"
              value={data.height_cm ? `${data.height_cm.replace(".", ",")} cm` : null}
            />
            <Fact
              label="Peso inicial"
              value={data.initial_weight_kg ? `${data.initial_weight_kg.replace(".", ",")} kg` : null}
            />
            <Fact label="Objetivo" value={goalLabel(data.goal || null)} />
            <Fact label="Nivel" value={levelLabel(data.level || null)} />
            <Fact label="Cliente desde" value={formatDate(detail.createdAt)} />
          </FactCard>
          {data.injuries ? (
            <Card style={styles.note}>
              <Text style={styles.noteLabel}>Lesiones / patologías</Text>
              <Text style={styles.noteText}>{data.injuries}</Text>
            </Card>
          ) : null}
          {data.notes ? (
            <Card style={styles.note}>
              <Text style={styles.noteLabel}>Notas privadas</Text>
              <Text style={styles.noteText}>{data.notes}</Text>
            </Card>
          ) : null}
        </>
      ) : tab === "rutinas" ? (
        <>
          <Button
            title="Nueva rutina"
            onPress={() => setNewSheet("routines")}
            icon={<Ionicons name="add" size={18} color={colors.primaryForeground} />}
          />
          {n === 0
            ? empty("Todavía no le armaste rutinas. Creale una desde cero o a partir de una plantilla.")
            : routines.map((r) => (
                <Tile
                  key={r.id}
                  title={r.name}
                  icon="barbell"
                  onPress={() => router.push(`/rutina/${r.id}`)}
                />
              ))}
        </>
      ) : tab === "nutricion" ? (
        <>
          <Button
            title="Nuevo plan"
            onPress={() => setNewSheet("nutrition")}
            icon={<Ionicons name="add" size={18} color={colors.primaryForeground} />}
          />
          {plans.length === 0
            ? empty("Todavía no le armaste planes de nutrición. Crealo desde cero o a partir de una plantilla.")
            : plans.map((p) => (
                <Tile
                  key={p.id}
                  title={p.name}
                  subtitle={p.isCurrent ? "Vigente" : undefined}
                  icon="nutrition-outline"
                  accent={p.isCurrent}
                  onPress={() => router.push(`/nutricion/${p.id}`)}
                />
              ))}
        </>
      ) : tab === "progreso" ? (
        hasApp ? (
          <ProgressView
            sessions={progress}
            emptyText="Este cliente todavía no registró entrenamientos en tus rutinas."
          />
        ) : (
          empty(
            appAccess === "pending"
              ? "Vas a ver su progreso cuando acepte la invitación."
              : "Sin app: el progreso se ve cuando el cliente registra sus entrenamientos en la app.",
          )
        )
      ) : !hasApp ? (
        empty(
          appAccess === "pending"
            ? "Vas a ver sus entrenamientos cuando acepte la invitación."
            : "Sin app: sus entrenamientos no se registran. Invitalo a la app para seguir su progreso.",
        )
      ) : sessions.length === 0 ? (
        empty("Todavía no registró entrenamientos.")
      ) : (
        sessions.map((s) => {
          const logs = visibleLogs(s);
          return (
            <Pressable
              key={s.id}
              onPress={() => router.push(`/sesion/${s.id}`)}
              accessibilityRole="button"
            >
              <Card style={styles.session}>
                <View style={styles.sessionHeader}>
                  <Text style={styles.sessionTitle} numberOfLines={2}>
                    {s.routine?.name} · {s.day?.name}
                  </Text>
                  <Text style={styles.sessionDate}>
                    {formatSessionDate(s.finished_at ?? s.started_at)}
                  </Text>
                </View>
                {logs.length === 0 ? (
                  <Muted style={{ fontSize: 13 }}>Sin series registradas.</Muted>
                ) : (
                  logs.map((l, i) => (
                    <Text key={i} style={styles.exercise}>
                      {l.exercise?.name ?? "Ejercicio"}
                      <Text style={styles.sets}>
                        {"  "}
                        {summarizeHistory({
                          sets: [...l.set_logs].sort((a, b) => a.set_number - b.set_number),
                          note: l.note,
                        })}
                      </Text>
                    </Text>
                  ))
                )}
              </Card>
            </Pressable>
          );
        })
      )}

      <InviteClientSheet
        visible={inviting}
        onClose={() => setInviting(false)}
        clientId={id}
        name={name}
        defaultEmail={data.email}
        onInvited={load}
      />

      <Sheet
        visible={newSheet !== null}
        onClose={() => setNewSheet(null)}
        title={`${newSheet === "nutrition" ? "Nuevo plan" : "Nueva rutina"} para ${name}`}
        description="Armala desde cero o partí de una de tus plantillas (se crea una copia propia del cliente)."
      >
        <Button
          title="Desde cero"
          variant="outline"
          onPress={() => {
            const kind = newSheet;
            setNewSheet(null);
            router.push(
              kind === "nutrition" ? `/nutricion/crear?cliente=${id}` : `/rutina/crear?cliente=${id}`,
            );
          }}
          icon={<Ionicons name="create-outline" size={18} color={colors.foreground} />}
        />
        {templateGroups.length === 0 ? (
          <Muted style={{ fontSize: 13 }}>
            Todavía no tenés plantillas. Las plantillas se crean desde Planes.
          </Muted>
        ) : (
          <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ gap: 12 }}>
            <Muted style={{ fontSize: 13 }}>Desde una plantilla</Muted>
            {templateGroups.map((g) => (
              <View key={g.id} style={{ gap: 6 }}>
                <Text style={styles.groupName}>{g.name}</Text>
                <View style={styles.templateList}>
                  {g.items.map((t, i) => (
                    <Pressable
                      key={t.id}
                      onPress={() => fromTemplate(t.id)}
                      disabled={copying !== null}
                      style={[styles.templateRow, i > 0 && styles.templateBorder]}
                      accessibilityRole="button"
                    >
                      <Ionicons
                        name={newSheet === "nutrition" ? "nutrition-outline" : "barbell-outline"}
                        size={18}
                        color={colors.mutedForeground}
                      />
                      <Text style={styles.templateName} numberOfLines={1}>
                        {t.name}
                      </Text>
                      {copying === t.id ? (
                        <ActivityIndicator color={colors.primary} />
                      ) : (
                        <Ionicons name="copy-outline" size={18} color={colors.mutedForeground} />
                      )}
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>
        )}
      </Sheet>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 40, gap: 14 },
  headerAction: { fontFamily: fonts.medium, fontSize: 15, color: colors.primary },
  badges: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  archived: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    color: colors.mutedForeground,
    backgroundColor: colors.muted,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: "hidden",
  },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  action: { minHeight: 40, paddingHorizontal: 14, flexGrow: 1 },
  pending: {
    padding: 14,
    borderColor: "rgba(245,158,11,0.4)",
    backgroundColor: "rgba(245,158,11,0.1)",
  },
  pendingText: { fontFamily: fonts.regular, fontSize: 14, color: colors.foreground },
  note: { padding: 14, gap: 4 },
  noteLabel: { fontFamily: fonts.regular, fontSize: 12, color: colors.mutedForeground },
  noteText: { fontFamily: fonts.regular, fontSize: 14, color: colors.foreground },
  session: { padding: 14, gap: 10 },
  sessionHeader: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  sessionTitle: { flex: 1, fontFamily: fonts.semibold, fontSize: 15, color: colors.foreground },
  sessionDate: { fontFamily: fonts.regular, fontSize: 12, color: colors.mutedForeground },
  exercise: { fontFamily: fonts.medium, fontSize: 14, color: colors.foreground },
  sets: { fontFamily: fonts.regular, fontSize: 13, color: colors.mutedForeground },
  groupName: { fontFamily: fonts.medium, fontSize: 12, color: colors.mutedForeground },
  templateList: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md },
  templateRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12 },
  templateBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  templateName: { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.foreground },
});

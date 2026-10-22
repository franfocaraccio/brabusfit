import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import type { ComponentProps, ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { clientGrowth, shortMonth, trainedThisWeek } from "@brabus/shared";
import type { CoachHome as CoachHomeData } from "@brabus/supabase";

import { Card } from "@/components/ui";
import { colors, fonts } from "@/lib/theme";

const PREVIEW = 4;
const CHART_H = 96;

/** Inicio del coach (igual que CoachHome de la web): pendientes, semana y clientes. */
export function CoachHome({ data }: { data: CoachHomeData }) {
  return (
    <View style={{ gap: 12 }}>
      <PendingCard
        title="Rutinas pendientes"
        icon="barbell-outline"
        hint="sin rutina vigente"
        empty="Todos tus clientes tienen una rutina vigente."
        clients={data.noRoutine}
      />
      <PendingCard
        title="Dietas pendientes"
        icon="nutrition-outline"
        hint="sin plan vigente"
        empty="Todos tus clientes tienen un plan vigente."
        clients={data.noPlan}
      />
      <WeekCard data={data} />
      <GrowthCard data={data} />
    </View>
  );
}

function ClientRow({
  name,
  onPress,
  right,
}: {
  name: string;
  onPress: () => void;
  right?: ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
      accessibilityRole="button"
    >
      <Text style={styles.rowName} numberOfLines={1}>
        {name}
      </Text>
      {right ?? (
        <Ionicons
          name="chevron-forward"
          size={16}
          color={colors.mutedForeground}
        />
      )}
    </Pressable>
  );
}

function PendingCard({
  title,
  icon,
  hint,
  empty,
  clients,
}: {
  title: string;
  icon: ComponentProps<typeof Ionicons>["name"];
  hint: string;
  empty: string;
  clients: { id: string; name: string }[];
}) {
  return (
    <Card style={styles.card}>
      <View style={styles.rowBetween}>
        <Text style={styles.label}>{title}</Text>
        <Ionicons name={icon} size={16} color={colors.primary} />
      </View>
      {clients.length === 0 ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Ionicons name="checkmark-circle" size={16} color={colors.success} />
          <Text style={[styles.label, { fontSize: 13, flex: 1 }]}>{empty}</Text>
        </View>
      ) : (
        <>
          <Text style={styles.big}>
            {clients.length}
            <Text style={styles.bigHint}>
              {" "}
              {clients.length === 1 ? "cliente" : "clientes"} {hint}
            </Text>
          </Text>
          <View>
            {clients.slice(0, PREVIEW).map((c, i) => (
              <View key={c.id} style={i > 0 && styles.divider}>
                <ClientRow
                  name={c.name}
                  onPress={() => router.push(`/cliente/${c.id}`)}
                />
              </View>
            ))}
          </View>
          {clients.length > PREVIEW ? (
            <Pressable onPress={() => router.push("/clientes")} hitSlop={8}>
              <Text style={styles.link}>
                Ver {clients.length - PREVIEW} más
              </Text>
            </Pressable>
          ) : null}
        </>
      )}
    </Card>
  );
}

function WeekCard({ data }: { data: CoachHomeData }) {
  const withApp = data.clients.filter(
    (c) => c.archivedAt === null && c.studentId,
  );
  const days = trainedThisWeek(data.sessions);
  const rows = withApp
    .map((c) => ({ ...c, days: days.get(c.studentId!) ?? 0 }))
    .sort((a, b) => b.days - a.days || a.name.localeCompare(b.name, "es"));
  const trained = rows.filter((r) => r.days > 0).length;

  return (
    <Card style={styles.card}>
      <Text style={styles.label}>Entrenaron esta semana</Text>
      {withApp.length === 0 ? (
        <Text style={[styles.label, { fontSize: 13 }]}>
          Ninguno de tus clientes usa la app todavía. Invitalos desde su ficha.
        </Text>
      ) : (
        <>
          <Text style={styles.big}>
            {trained}
            <Text style={[styles.bigHint, { fontSize: 16 }]}>
              {" "}
              / {withApp.length}
            </Text>
            <Text style={styles.bigHint}> con app</Text>
          </Text>
          <View style={styles.progress}>
            <View
              style={[
                styles.progressFill,
                { width: `${(trained / withApp.length) * 100}%` },
              ]}
            />
          </View>
          <View>
            {rows.slice(0, 6).map((r, i) => (
              <View key={r.id} style={i > 0 && styles.divider}>
                <ClientRow
                  name={r.name}
                  onPress={() => router.push(`/cliente/${r.id}`)}
                  right={
                    <Text style={[styles.pill, r.days > 0 && styles.pillOn]}>
                      {r.days > 0
                        ? `${r.days} ${r.days === 1 ? "día" : "días"}`
                        : "Sin entrenar"}
                    </Text>
                  }
                />
              </View>
            ))}
          </View>
          {rows.length > 6 ? (
            <Pressable onPress={() => router.push("/clientes")} hitSlop={8}>
              <Text style={styles.link}>Ver todos</Text>
            </Pressable>
          ) : null}
        </>
      )}
    </Card>
  );
}

function GrowthCard({ data }: { data: CoachHomeData }) {
  const months = clientGrowth(data.clients);
  const current = months[months.length - 1];
  const delta = current.count - months[0].count;
  const max = Math.max(...months.map((m) => m.count), 1);

  return (
    <Card style={styles.card}>
      <View style={styles.rowBetween}>
        <Text style={styles.label}>Clientes activos · 6 meses</Text>
        {delta !== 0 ? (
          <Text
            style={[
              styles.label,
              { color: delta > 0 ? colors.success : colors.destructive },
            ]}
          >
            {delta > 0 ? "+" : ""}
            {delta} en 6 meses
          </Text>
        ) : null}
      </View>
      <Text style={styles.big}>{current.count}</Text>
      <View style={[styles.chart, { height: CHART_H + 18 }]}>
        {months.map((m, i) => (
          <View key={i} style={styles.barCol}>
            <Text style={styles.axis}>{m.count}</Text>
            <View
              style={[
                styles.bar,
                {
                  height: Math.max(
                    (m.count / max) * CHART_H * 0.85,
                    m.count ? 6 : 2,
                  ),
                  opacity: i === months.length - 1 ? 1 : 0.45,
                },
              ]}
            />
          </View>
        ))}
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {months.map((m, i) => (
          <Text key={i} style={[styles.axis, { flex: 1, textAlign: "center" }]}>
            {shortMonth(m.start)}
          </Text>
        ))}
      </View>
      <Text style={styles.label}>
        Este mes: {current.added} {current.added === 1 ? "alta" : "altas"} ·{" "}
        {current.removed} {current.removed === 1 ? "baja" : "bajas"}{" "}
        (archivados)
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, gap: 10 },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.mutedForeground,
  },
  big: { fontFamily: fonts.semibold, fontSize: 30, color: colors.foreground },
  bigHint: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.mutedForeground,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 10,
  },
  rowName: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.foreground,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  link: { fontFamily: fonts.semibold, fontSize: 14, color: colors.primary },
  pill: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.mutedForeground,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: "hidden",
  },
  pillOn: { color: colors.primary, backgroundColor: "rgba(249,115,22,0.15)" },
  progress: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.muted,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  chart: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  barCol: { flex: 1, alignItems: "center", justifyContent: "flex-end", gap: 4 },
  bar: {
    alignSelf: "stretch",
    backgroundColor: colors.primary,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  axis: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.mutedForeground,
  },
});

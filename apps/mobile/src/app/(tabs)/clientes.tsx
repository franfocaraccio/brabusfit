import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { formatDate } from "@brabus/shared";
import { getClients, type ClientSummary } from "@brabus/supabase";

import { AccessBadge } from "@/components/clients";
import { Loading } from "@/components/loading";
import { Segmented } from "@/components/segmented";
import { Button, Card, Muted } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { colors, fonts, radius } from "@/lib/theme";
import { useAuth } from "@/providers/auth";

function subtitle(c: ClientSummary) {
  const routines = `${c.routineCount} ${c.routineCount === 1 ? "rutina" : "rutinas"}`;
  if (c.appAccess !== "active") return routines;
  return `${routines} · ${
    c.lastActivity ? `última actividad ${formatDate(c.lastActivity)}` : "sin entrenamientos aún"
  }`;
}

/** Clientes del coach (igual que /clientes en la web). */
export default function ClientesScreen() {
  const { session } = useAuth();
  const [clients, setClients] = useState<ClientSummary[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"activos" | "archivados">("activos");

  const load = useCallback(async () => {
    if (session) setClients(await getClients(supabase, session.user.id));
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!clients) return <Loading />;

  const q = query.trim().toLowerCase();
  const archivedCount = clients.filter((c) => c.archived).length;
  const list = clients.filter(
    (c) =>
      c.archived === (view === "archivados") &&
      (!q ||
        c.name.toLowerCase().includes(q) ||
        (c.email ?? "").includes(q) ||
        (c.phone ?? "").includes(q) ||
        (c.username ?? "").includes(q)),
  );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
          tintColor={colors.primary}
        />
      }
    >
      <Muted>La ficha de cada cliente, sus rutinas y su progreso (si usa la app).</Muted>
      <Button
        title="Nuevo cliente"
        onPress={() => router.push("/cliente/nuevo")}
        icon={<Ionicons name="person-add-outline" size={18} color={colors.primaryForeground} />}
      />

      {clients.length === 0 ? (
        <Card style={styles.empty}>
          <Ionicons name="people-outline" size={32} color={colors.mutedForeground} />
          <Muted style={{ textAlign: "center" }}>
            Todavía no tenés clientes. Creá su ficha: no hace falta que usen la app.
          </Muted>
        </Card>
      ) : (
        <>
          <View style={styles.search}>
            <Ionicons name="search" size={18} color={colors.mutedForeground} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Buscar por nombre, email o teléfono…"
              placeholderTextColor={colors.mutedForeground}
              selectionColor={colors.primary}
              style={styles.searchInput}
              autoCapitalize="none"
              clearButtonMode="while-editing"
            />
          </View>
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: "activos", label: `Activos (${clients.length - archivedCount})` },
              { value: "archivados", label: `Archivados (${archivedCount})` },
            ]}
          />

          {list.length === 0 ? (
            <Muted>
              {q
                ? "No se encontraron resultados."
                : view === "archivados"
                  ? "No hay clientes archivados."
                  : "No hay clientes activos."}
            </Muted>
          ) : (
            <Card style={{ overflow: "hidden" }}>
              {list.map((c, i) => (
                <Pressable
                  key={c.id}
                  onPress={() => router.push(`/cliente/${c.id}`)}
                  style={[styles.row, i > 0 && styles.rowBorder]}
                  accessibilityRole="button"
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={styles.nameRow}>
                      <Text style={styles.name} numberOfLines={1}>
                        {c.name}
                      </Text>
                      <AccessBadge access={c.appAccess} />
                    </View>
                    <Text style={styles.meta} numberOfLines={1}>
                      {c.username ? `@${c.username} · ` : c.phone ? `${c.phone} · ` : ""}
                      {subtitle(c)}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
                </Pressable>
              ))}
            </Card>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 40, gap: 14 },
  empty: { padding: 24, gap: 12, alignItems: "center" },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.input,
    backgroundColor: "rgba(43,51,61,0.4)",
  },
  searchInput: {
    flex: 1,
    color: colors.foreground,
    fontFamily: fonts.regular,
    fontSize: 16,
    paddingVertical: 10,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: { flexShrink: 1, fontFamily: fonts.semibold, fontSize: 15, color: colors.foreground },
  meta: { fontFamily: fonts.regular, fontSize: 12, color: colors.mutedForeground },
});

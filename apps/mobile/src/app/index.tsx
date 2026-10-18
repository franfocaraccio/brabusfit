import { Ionicons } from "@expo/vector-icons";
import { router, Stack, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  getRoutinesOverview,
  type FolderLite,
  type RoutineLite,
  type SharedRoutineLite,
} from "@brabus/supabase";

import { Tile } from "@/components/tile";
import { Card, Muted, SectionLabel } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { colors, fonts, radius } from "@/lib/theme";
import { useAuth } from "@/providers/auth";

const ROOT_GROUP = "__root__";

type Overview = {
  folders: FolderLite[];
  routines: RoutineLite[];
  shared: SharedRoutineLite[];
};

export default function RutinasScreen() {
  const { session, profile, signOut } = useAuth();
  const isCoach = profile?.is_coach ?? false;

  const [data, setData] = useState<Overview | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!session) return;
    setData(await getRoutinesOverview(supabase, session.user.id));
  }, [session]);

  // Recarga cada vez que la pantalla vuelve a estar visible.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const confirmSignOut = () =>
    Alert.alert("Cerrar sesión", "¿Querés salir de tu cuenta?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Salir", style: "destructive", onPress: signOut },
    ]);

  const q = query.trim().toLowerCase();
  const matches = (text: string) => text.toLowerCase().includes(q);
  const open = (routineId: string) => router.push(`/rutina/${routineId}`);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const header = (
    <Stack.Screen
      options={{
        title: "Rutinas",
        headerRight: () => (
          <Pressable onPress={confirmSignOut} hitSlop={12} accessibilityLabel="Cerrar sesión">
            <Ionicons name="log-out-outline" size={24} color={colors.foreground} />
          </Pressable>
        ),
      }}
    />
  );

  if (!data) {
    return (
      <View style={styles.center}>
        {header}
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const { folders, routines, shared } = data;
  const sharedFiltered = shared.filter(
    (s) => !q || matches(s.name) || (s.coachName ? matches(s.coachName) : false),
  );

  // Coach: carpetas (+ "Sin carpeta" para rutinas viejas). Alumno: lista plana.
  const rootRoutines = routines.filter((r) => !r.folder_id);
  const groups = [
    ...folders.map((f) => ({
      id: f.id,
      name: f.name,
      items: routines.filter((r) => r.folder_id === f.id),
    })),
    ...(rootRoutines.length > 0
      ? [{ id: ROOT_GROUP, name: "Sin carpeta", items: rootRoutines }]
      : []),
  ].filter((g) => !q || matches(g.name) || g.items.some((r) => matches(r.name)));

  const ownFlat = routines.filter((r) => !q || matches(r.name));
  const hasNothing =
    routines.length === 0 && folders.length === 0 && shared.length === 0;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
        />
      }
    >
      {header}

      {profile ? (
        <Text style={styles.greeting}>Hola, {profile.first_name}</Text>
      ) : null}

      {hasNothing ? (
        <Card style={styles.empty}>
          <Muted>
            Todavía no tenés rutinas. Cuando tu coach te comparta una (o crees
            la tuya desde la web) va a aparecer acá.
          </Muted>
        </Card>
      ) : (
        <>
          <View style={styles.search}>
            <Ionicons name="search" size={18} color={colors.mutedForeground} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={isCoach ? "Buscar por carpeta o rutina…" : "Buscar rutina…"}
              placeholderTextColor={colors.mutedForeground}
              selectionColor={colors.primary}
              style={styles.searchInput}
              autoCapitalize="none"
              clearButtonMode="while-editing"
            />
          </View>

          {sharedFiltered.length > 0 && (
            <View style={styles.section}>
              <SectionLabel>Compartidas conmigo</SectionLabel>
              {sharedFiltered.map((s) => (
                <Tile
                  key={s.id}
                  title={s.name}
                  subtitle={s.coachName ? `Coach: ${s.coachName}` : "Compartida"}
                  icon="barbell"
                  accent
                  onPress={() => open(s.routineId)}
                />
              ))}
            </View>
          )}

          {isCoach ? (
            <View style={styles.section}>
              <SectionLabel>Carpetas</SectionLabel>
              {groups.length === 0 ? (
                <Muted>No se encontraron resultados.</Muted>
              ) : (
                groups.map((g) => {
                  const nameMatch = !q || matches(g.name);
                  const items = nameMatch
                    ? g.items
                    : g.items.filter((r) => matches(r.name));
                  const isOpen = q ? true : expanded.has(g.id);
                  return (
                    <View key={g.id} style={styles.group}>
                      <Pressable
                        onPress={() => toggle(g.id)}
                        style={styles.folder}
                        accessibilityRole="button"
                        accessibilityState={{ expanded: isOpen }}
                      >
                        <View style={styles.folderIcon}>
                          <Ionicons name="folder-outline" size={20} color={colors.foreground} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.folderName} numberOfLines={1}>
                            {g.name}
                          </Text>
                          <Text style={styles.folderCount}>
                            {g.items.length} rutina(s)
                          </Text>
                        </View>
                        <Ionicons
                          name={isOpen ? "chevron-up" : "chevron-down"}
                          size={20}
                          color={colors.mutedForeground}
                        />
                      </Pressable>
                      {isOpen && (
                        <View style={styles.groupItems}>
                          {items.length > 0 ? (
                            items.map((r) => (
                              <Tile
                                key={r.id}
                                title={r.name}
                                icon="barbell"
                                onPress={() => open(r.id)}
                              />
                            ))
                          ) : (
                            <Muted>Carpeta vacía.</Muted>
                          )}
                        </View>
                      )}
                    </View>
                  );
                })
              )}
            </View>
          ) : (
            <View style={styles.section}>
              <SectionLabel>Mis rutinas</SectionLabel>
              {ownFlat.length > 0 ? (
                ownFlat.map((r) => (
                  <Tile key={r.id} title={r.name} icon="barbell" onPress={() => open(r.id)} />
                ))
              ) : (
                <Muted>
                  {q ? "No se encontraron resultados." : "Todavía no creaste rutinas."}
                </Muted>
              )}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 40, gap: 20 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  greeting: { fontFamily: fonts.heading, fontSize: 28, color: colors.foreground },
  empty: { padding: 20 },
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
  section: { gap: 10 },
  group: { gap: 8 },
  groupItems: { gap: 8, paddingLeft: 12 },
  folder: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: "rgba(244,246,250,0.08)",
  },
  folderIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  folderName: { fontFamily: fonts.semibold, fontSize: 16, color: colors.foreground },
  folderCount: { fontFamily: fonts.regular, fontSize: 13, color: colors.mutedForeground },
});

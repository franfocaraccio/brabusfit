import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  createFolder,
  deleteFolder,
  getRoutinesOverview,
  type FolderLite,
  type RoutineLite,
  type SharedRoutineLite,
} from "@brabus/supabase";

import { ErrorText } from "@/components/forms";
import { Sheet } from "@/components/sheet";
import { Tile } from "@/components/tile";
import { Button, Card, Muted, SectionLabel, TextField } from "@/components/ui";
import { confirm, notify } from "@/lib/confirm";
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
  const { session, profile } = useAuth();
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

  // --- carpetas (solo coach) --------------------------------------------------
  const [folderSheet, setFolderSheet] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [folderError, setFolderError] = useState<string | null>(null);
  const [folderSaving, setFolderSaving] = useState(false);

  const closeFolderSheet = () => {
    setFolderSheet(false);
    setFolderName("");
    setFolderError(null);
  };

  const createNewFolder = async () => {
    if (!folderName.trim() || folderSaving) return;
    setFolderSaving(true);
    const result = await createFolder(supabase, folderName);
    setFolderSaving(false);
    if (!result.ok) return setFolderError(result.error);
    closeFolderSheet();
    load();
  };

  const onDeleteFolder = (folderId: string, name: string) =>
    confirm({
      title: "Eliminar carpeta",
      message: `Se eliminará la carpeta «${name}». Las rutinas que contiene no se borran: pasan a "Sin carpeta".`,
      confirmText: "Eliminar",
      destructive: true,
      onConfirm: async () => {
        const result = await deleteFolder(supabase, folderId);
        if (!result.ok) return notify("No se pudo eliminar", result.error);
        load();
      },
    });

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

  if (!data) {
    return (
      <View style={styles.center}>
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
      {hasNothing ? (
        <Card style={styles.empty}>
          <Muted style={{ textAlign: "center" }}>Todavía no tenés rutinas.</Muted>
          <Button
            title="Crear mi primera rutina"
            onPress={() => router.push("/rutina/crear")}
            icon={<Ionicons name="add" size={18} color={colors.primaryForeground} />}
          />
        </Card>
      ) : (
        <>
          <Button
            title="Crear rutina"
            onPress={() => router.push("/rutina/crear")}
            icon={<Ionicons name="add" size={18} color={colors.primaryForeground} />}
          />

          <View style={styles.searchRow}>
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
            {isCoach ? (
              <Pressable
                onPress={() => setFolderSheet(true)}
                style={styles.folderButton}
                accessibilityRole="button"
                accessibilityLabel="Nueva carpeta"
              >
                <Ionicons name="folder-open-outline" size={20} color={colors.foreground} />
                <Ionicons name="add" size={14} color={colors.primary} style={styles.folderPlus} />
              </Pressable>
            ) : null}
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
                      <View style={styles.folder}>
                        <Pressable
                          onPress={() => toggle(g.id)}
                          style={styles.folderToggle}
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
                        {g.id !== ROOT_GROUP ? (
                          <Pressable
                            onPress={() => onDeleteFolder(g.id, g.name)}
                            hitSlop={10}
                            accessibilityRole="button"
                            accessibilityLabel="Eliminar carpeta"
                            style={styles.folderTrash}
                          >
                            <Ionicons name="trash-outline" size={18} color={colors.mutedForeground} />
                          </Pressable>
                        ) : null}
                      </View>
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

      <Sheet visible={folderSheet} onClose={closeFolderSheet} title="Nueva carpeta">
        <TextField
          label="Nombre"
          value={folderName}
          onChangeText={setFolderName}
          placeholder="Alumnos 2026"
          autoFocus
          onSubmitEditing={createNewFolder}
        />
        {folderError ? <ErrorText>{folderError}</ErrorText> : null}
        <Button
          title="Crear carpeta"
          onPress={createNewFolder}
          disabled={!folderName.trim()}
          loading={folderSaving}
        />
      </Sheet>
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
  empty: { padding: 20, gap: 16 },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  folderButton: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.input,
    alignItems: "center",
    justifyContent: "center",
  },
  folderPlus: { position: "absolute", right: 8, top: 8 },
  folderToggle: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  folderTrash: { paddingLeft: 4 },
  search: {
    flex: 1,
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

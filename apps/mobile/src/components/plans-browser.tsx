import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, type Href } from "expo-router";
import { useCallback, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { STUDENTS_CAN_EDIT_PLANS } from "@brabus/shared";
import {
  createFolder,
  createNutritionFolder,
  deleteFolder,
  deleteNutritionFolder,
  getNutritionOverview,
  getRoutinesOverview,
  type FolderLite,
} from "@brabus/supabase";

import { ErrorText } from "@/components/forms";
import { Sheet } from "@/components/sheet";
import { Tile } from "@/components/tile";
import { Button, Card, Muted, SectionLabel, TextField } from "@/components/ui";
import { confirm, notify } from "@/lib/confirm";
import { supabase } from "@/lib/supabase";
import { fonts, makeStyles, radius, useColors } from "@/lib/theme";
import { useAuth } from "@/providers/auth";

const ROOT_GROUP = "__root__";

type Item = { id: string; name: string; isCurrent?: boolean };
type Overview = {
  folders: FolderLite[];
  /** Plantillas (coach) o rutinas/planes propios (alumno). */
  routines: (Item & { folder_id: string | null })[];
  clients: {
    clientId: string;
    name: string;
    archived: boolean;
    items: Item[];
  }[];
  fromCoaches: (Item & { coachName: string | null })[];
};

export type PlansKind = "routines" | "nutrition";

const TEXT = {
  routines: {
    one: "rutina",
    many: "rutinas",
    icon: "barbell" as const,
    path: "/rutina",
    create: "/rutina/crear",
    createLabel: "Crear rutina",
    search: "Buscar cliente, carpeta o rutina…",
    searchOwn: "Buscar rutina…",
    empty: "Todavía no tenés rutinas.",
    firstOwn: "Crear mi primera rutina",
    clients: "Rutinas de clientes",
    clientsEmpty:
      "Todavía no armaste rutinas para clientes. Entrá a una plantilla y tocá «Asignar a cliente», o creala desde Clientes.",
    mine: "Mis rutinas",
    mineEmpty: "Todavía no creaste rutinas.",
    folderItems: "Las rutinas",
  },
  nutrition: {
    one: "plan",
    many: "planes",
    icon: "nutrition-outline" as const,
    path: "/nutricion",
    create: "/nutricion/crear",
    createLabel: "Crear plan",
    search: "Buscar cliente, carpeta o plan…",
    searchOwn: "Buscar plan…",
    empty: "Todavía no tenés planes de nutrición.",
    firstOwn: null,
    clients: "Planes de clientes",
    clientsEmpty:
      "Todavía no armaste planes para clientes. Entrá a una plantilla y tocá «Asignar a cliente», o crealo desde Clientes.",
    mine: "Mis planes",
    mineEmpty: "Tu coach te los va a armar acá.",
    folderItems: "Los planes",
  },
};

async function loadOverview(
  kind: PlansKind,
  userId: string,
): Promise<Overview> {
  if (kind === "nutrition") {
    const o = await getNutritionOverview(supabase, userId);
    return {
      folders: o.folders,
      routines: o.plans,
      clients: o.clients.map((c) => ({ ...c, items: c.plans })),
      fromCoaches: o.fromCoaches,
    };
  }
  const o = await getRoutinesOverview(supabase, userId);
  return {
    folders: o.folders,
    routines: o.routines,
    clients: o.clients.map((c) => ({ ...c, items: c.routines })),
    fromCoaches: o.fromCoaches,
  };
}

type Group = {
  id: string;
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  badge?: { text: string; pending: boolean };
  deletable: boolean;
  items: Item[];
};

/** Plantillas en carpetas + lo de cada cliente (coach), o lo del alumno. */
export function PlansBrowser({
  kind,
  header,
}: {
  kind: PlansKind;
  header?: ReactNode;
}) {
  const colors = useColors();
  const styles = useStyles();
  const { session, profile } = useAuth();
  const isCoach = profile?.is_coach ?? false;
  const t = TEXT[kind];
  const canCreate = kind === "routines" || isCoach || STUDENTS_CAN_EDIT_PLANS;
  const countLabel = (n: number) => `${n} ${n === 1 ? t.one : t.many}`;

  const [data, setData] = useState<Overview | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // Secciones del coach: plantillas contraídas y clientes expandidos por defecto.
  const [openSections, setOpenSections] = useState({
    templates: false,
    clients: true,
  });

  const load = useCallback(async () => {
    if (!session) return;
    setData(await loadOverview(kind, session.user.id));
  }, [session, kind]);

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
    const result =
      kind === "nutrition"
        ? await createNutritionFolder(supabase, folderName)
        : await createFolder(supabase, folderName);
    setFolderSaving(false);
    if (!result.ok) return setFolderError(result.error);
    closeFolderSheet();
    load();
  };

  const onDeleteFolder = (folderId: string, name: string) =>
    confirm({
      title: "Eliminar carpeta",
      message: `Se eliminará la carpeta «${name}». ${t.folderItems} que contiene no se borran: pasan a "Sin carpeta".`,
      confirmText: "Eliminar",
      destructive: true,
      onConfirm: async () => {
        const result =
          kind === "nutrition"
            ? await deleteNutritionFolder(supabase, folderId)
            : await deleteFolder(supabase, folderId);
        if (!result.ok) return notify("No se pudo eliminar", result.error);
        load();
      },
    });

  const q = query.trim().toLowerCase();
  const matches = (text: string) => text.toLowerCase().includes(q);
  const open = (id: string) => router.push(`${t.path}/${id}` as Href);
  const tile = (r: Item, subtitle?: string, accent?: boolean) => (
    <Tile
      key={r.id}
      title={r.name}
      subtitle={subtitle ?? (r.isCurrent ? "Vigente" : undefined)}
      icon={t.icon}
      accent={accent ?? r.isCurrent}
      onPress={() => open(r.id)}
    />
  );

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (!data) {
    return (
      <View style={styles.screen}>
        {header ? <View style={{ padding: 16 }}>{header}</View> : null}
        <View style={styles.center}>
          <ActivityIndicator color={colors.primaryText} />
        </View>
      </View>
    );
  }

  const { folders, routines, clients, fromCoaches } = data;
  const coachList = fromCoaches.filter(
    (s) =>
      !q || matches(s.name) || (s.coachName ? matches(s.coachName) : false),
  );

  // Coach: rutinas por cliente + plantillas en carpetas. Alumno: lista plana.
  const visible = (groups: Group[]) =>
    groups.filter(
      (g) => !q || matches(g.name) || g.items.some((r) => matches(r.name)),
    );

  const clientGroups = visible(
    clients.map((c) => ({
      id: `client:${c.clientId}`,
      name: c.name,
      icon: "person-outline" as const,
      badge: c.archived ? { text: "Archivado", pending: false } : undefined,
      deletable: false,
      items: c.items,
    })),
  );

  const rootRoutines = routines.filter((r) => !r.folder_id);
  const templateGroups = visible([
    ...folders.map((f) => ({
      id: f.id,
      name: f.name,
      icon: "folder-outline" as const,
      deletable: true,
      items: routines.filter((r) => r.folder_id === f.id),
    })),
    ...(rootRoutines.length > 0
      ? [
          {
            id: ROOT_GROUP,
            name: "Sin carpeta",
            icon: "folder-outline" as const,
            deletable: false,
            items: rootRoutines,
          },
        ]
      : []),
  ]);

  const ownFlat = routines.filter((r) => !q || matches(r.name));
  const hasNothing =
    routines.length === 0 &&
    folders.length === 0 &&
    clients.length === 0 &&
    fromCoaches.length === 0;

  const renderGroups = (groups: Group[], empty: string) =>
    groups.length === 0 ? (
      <Muted>{q ? "No se encontraron resultados." : empty}</Muted>
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
                  <Ionicons name={g.icon} size={20} color={colors.foreground} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.folderTitleRow}>
                    <Text
                      style={[styles.folderName, { flexShrink: 1 }]}
                      numberOfLines={1}
                    >
                      {g.name}
                    </Text>
                    {g.badge ? (
                      <Text
                        style={[
                          styles.badge,
                          g.badge.pending && styles.badgePending,
                        ]}
                      >
                        {g.badge.text}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={styles.folderCount}>
                    {countLabel(g.items.length)}
                  </Text>
                </View>
                <Ionicons
                  name={isOpen ? "chevron-up" : "chevron-down"}
                  size={20}
                  color={colors.mutedForeground}
                />
              </Pressable>
              {g.deletable ? (
                <Pressable
                  onPress={() => onDeleteFolder(g.id, g.name)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Eliminar carpeta"
                  style={styles.folderTrash}
                >
                  <Ionicons
                    name="trash-outline"
                    size={18}
                    color={colors.mutedForeground}
                  />
                </Pressable>
              ) : null}
            </View>
            {isOpen && (
              <View style={styles.groupItems}>
                {items.length > 0 ? (
                  items.map((r) => tile(r))
                ) : (
                  <Muted>Carpeta vacía.</Muted>
                )}
              </View>
            )}
          </View>
        );
      })
    );

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
      {hasNothing ? (
        <Card style={styles.empty}>
          <Muted style={{ textAlign: "center" }}>{t.empty}</Muted>
          {canCreate ? (
            <Button
              title={
                isCoach
                  ? "Crear mi primera plantilla"
                  : (t.firstOwn ?? t.createLabel)
              }
              onPress={() => router.push(t.create as Href)}
              icon={
                <Ionicons
                  name="add"
                  size={18}
                  color={colors.primaryForeground}
                />
              }
            />
          ) : (
            <Muted style={{ textAlign: "center" }}>{t.mineEmpty}</Muted>
          )}
        </Card>
      ) : (
        <>
          {canCreate ? (
            <Button
              title={t.createLabel}
              onPress={() => router.push(t.create as Href)}
              icon={
                <Ionicons
                  name="add"
                  size={18}
                  color={colors.primaryForeground}
                />
              }
            />
          ) : null}

          <View style={styles.searchRow}>
            <View style={styles.search}>
              <Ionicons
                name="search"
                size={18}
                color={colors.mutedForeground}
              />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={isCoach ? t.search : t.searchOwn}
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
                <Ionicons
                  name="folder-open-outline"
                  size={20}
                  color={colors.foreground}
                />
                <Ionicons
                  name="add"
                  size={14}
                  color={colors.primaryText}
                  style={styles.folderPlus}
                />
              </Pressable>
            ) : null}
          </View>

          {!isCoach && coachList.length > 0 && (
            <View style={styles.section}>
              <SectionLabel>De mis coaches</SectionLabel>
              {coachList.map((s) =>
                tile(
                  s,
                  `${s.isCurrent ? "Vigente · " : ""}${s.coachName ? `Coach: ${s.coachName}` : "De tu coach"}`,
                  true,
                ),
              )}
            </View>
          )}

          {isCoach ? (
            <>
              {(
                [
                  [
                    "templates",
                    "Plantillas",
                    templateGroups,
                    "Todavía no tenés plantillas.",
                  ],
                  ["clients", t.clients, clientGroups, t.clientsEmpty],
                ] as const
              ).map(([key, title, groups, empty]) => {
                // Buscando, se muestran las dos secciones abiertas.
                const isOpen = q ? true : openSections[key];
                const count = groups.reduce((n, g) => n + g.items.length, 0);
                return (
                  <View key={key} style={styles.section}>
                    <Pressable
                      onPress={() =>
                        setOpenSections((o) => ({ ...o, [key]: !o[key] }))
                      }
                      style={styles.sectionToggle}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: isOpen }}
                      hitSlop={8}
                    >
                      <SectionLabel>{`${title} (${count})`}</SectionLabel>
                      <Ionicons
                        name={isOpen ? "chevron-up" : "chevron-down"}
                        size={18}
                        color={colors.mutedForeground}
                      />
                    </Pressable>
                    {isOpen ? renderGroups(groups, empty) : null}
                  </View>
                );
              })}
            </>
          ) : ownFlat.length > 0 ||
            kind === "routines" ||
            coachList.length === 0 ? (
            <View style={styles.section}>
              <SectionLabel>{t.mine}</SectionLabel>
              {ownFlat.length > 0 ? (
                ownFlat.map((r) => tile(r))
              ) : (
                <Muted>
                  {q ? "No se encontraron resultados." : t.mineEmpty}
                </Muted>
              )}
            </View>
          ) : null}
        </>
      )}

      <Sheet
        visible={folderSheet}
        onClose={closeFolderSheet}
        title="Nueva carpeta"
      >
        <TextField
          label="Nombre"
          value={folderName}
          onChangeText={setFolderName}
          placeholder={kind === "nutrition" ? "Volumen" : "Fuerza"}
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

const useStyles = makeStyles((colors) => ({
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
  folderToggle: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
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
    backgroundColor: colors.field,
  },
  searchInput: {
    flex: 1,
    color: colors.foreground,
    fontFamily: fonts.regular,
    fontSize: 16,
    paddingVertical: 10,
  },
  section: { gap: 10 },
  sectionToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
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
    borderColor: colors.overlay,
  },
  folderIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  folderName: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.foreground,
  },
  folderCount: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.mutedForeground,
  },
  folderTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
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
  badgePending: { color: "#f59e0b", backgroundColor: "rgba(245,158,11,0.15)" },
}));

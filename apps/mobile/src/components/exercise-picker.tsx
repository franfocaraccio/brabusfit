import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import {
  findCatalogByName,
  MUSCLE_GROUPS,
  muscleGroupLabel,
  searchCatalog,
  type CatalogEntry,
  type MuscleGroup,
} from "@brabus/shared";
import { createCatalogEntry } from "@brabus/supabase";

import { ErrorText } from "@/components/forms";
import { Sheet } from "@/components/sheet";
import { Button, Muted, TextField } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { fonts, makeStyles, radius, useColors } from "@/lib/theme";

/** Máximo de resultados que se dibujan (el resto aparece al buscar). */
const MAX_RESULTS = 60;

/**
 * Selector de ejercicio del catálogo (igual que ExercisePicker de la web):
 * buscador, filtro por grupo muscular y "Crear" un ejercicio propio.
 */
export function ExercisePicker({
  value,
  catalog,
  onChange,
  onCreated,
}: {
  value: CatalogEntry | null;
  catalog: CatalogEntry[];
  onChange: (entry: CatalogEntry) => void;
  onCreated: (entry: CatalogEntry) => void;
}) {
  const colors = useColors();
  const styles = useStyles();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<MuscleGroup | null>(null);
  const [creating, setCreating] = useState(false);
  const [newGroup, setNewGroup] = useState<MuscleGroup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const results = searchCatalog(catalog, query, group);
  const canCreate = query.trim() !== "" && !findCatalogByName(catalog, query);

  const openPicker = () => {
    setQuery("");
    setGroup(null);
    setCreating(false);
    setNewGroup(null);
    setError(null);
    setOpen(true);
  };

  const pick = (entry: CatalogEntry) => {
    onChange(entry);
    setOpen(false);
  };

  const create = async () => {
    if (!newGroup) return setError("Elegí el grupo muscular.");
    setSaving(true);
    const result = await createCatalogEntry(
      supabase,
      { name: query, muscleGroup: newGroup },
      catalog,
    );
    setSaving(false);
    if (!result.ok) return setError(result.error);
    onCreated(result.data);
    pick(result.data);
  };

  return (
    <>
      <Pressable
        onPress={openPicker}
        style={styles.trigger}
        accessibilityRole="button"
      >
        <Text
          style={[
            styles.triggerText,
            !value && { color: colors.mutedForeground },
          ]}
          numberOfLines={1}
        >
          {value ? value.name : "Elegí un ejercicio"}
        </Text>
        <Ionicons
          name="chevron-down"
          size={18}
          color={colors.mutedForeground}
        />
      </Pressable>

      <Sheet
        visible={open}
        onClose={() => setOpen(false)}
        title={creating ? "Nuevo ejercicio" : "Elegí un ejercicio"}
      >
        {creating ? (
          <View style={{ gap: 12 }}>
            <TextField value={query} onChangeText={setQuery} autoFocus />
            <Muted style={{ fontSize: 13 }}>
              Grupo muscular. Este ejercicio solo lo vas a ver vos.
            </Muted>
            <GroupChips value={newGroup} onChange={setNewGroup} />
            {error ? <ErrorText>{error}</ErrorText> : null}
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Button
                title="Volver"
                variant="ghost"
                onPress={() => setCreating(false)}
              />
              <Button
                title="Crear y elegir"
                onPress={create}
                loading={saving}
                disabled={!query.trim()}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            <TextField
              value={query}
              onChangeText={setQuery}
              placeholder="Buscar ejercicio…"
              autoCorrect={false}
            />
            <GroupChips value={group} onChange={setGroup} allowAll />

            <View>
              {results.slice(0, MAX_RESULTS).map((e) => (
                <Pressable
                  key={e.id}
                  onPress={() => pick(e)}
                  style={({ pressed }) => [
                    styles.option,
                    (pressed || value?.id === e.id) && {
                      backgroundColor: colors.muted,
                    },
                  ]}
                >
                  <Text style={styles.optionText} numberOfLines={1}>
                    {e.name}
                  </Text>
                  {e.owner_id ? <Text style={styles.own}>Propio</Text> : null}
                  <Text style={styles.optionGroup}>
                    {muscleGroupLabel(e.muscle_group)}
                  </Text>
                </Pressable>
              ))}
              {results.length === 0 ? (
                <Muted style={{ textAlign: "center", paddingVertical: 12 }}>
                  No se encontró ningún ejercicio.
                </Muted>
              ) : null}
            </View>

            {canCreate ? (
              <Button
                title={`Crear «${query.trim()}»`}
                variant="outline"
                onPress={() => {
                  setCreating(true);
                  setNewGroup(group);
                  setError(null);
                }}
                icon={
                  <Ionicons name="add" size={18} color={colors.foreground} />
                }
              />
            ) : null}
          </View>
        )}
      </Sheet>
    </>
  );
}

function GroupChips({
  value,
  onChange,
  allowAll,
}: {
  value: MuscleGroup | null;
  onChange: (g: MuscleGroup | null) => void;
  allowAll?: boolean;
}) {
  const styles = useStyles();
  const options: { value: MuscleGroup | null; label: string }[] = [
    ...(allowAll ? [{ value: null, label: "Todos" }] : []),
    ...MUSCLE_GROUPS.filter((g) => allowAll || g.value !== "otros"),
  ];
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 6 }}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value ?? "all"}
            onPress={() => onChange(o.value)}
            style={[styles.chip, on && styles.chipOn]}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
          >
            <Text style={[styles.chipText, on && styles.chipTextOn]}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const useStyles = makeStyles((colors) => ({
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.input,
    backgroundColor: colors.field,
  },
  triggerText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.foreground,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 11,
    borderRadius: radius.sm,
  },
  optionText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.foreground,
  },
  optionGroup: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.mutedForeground,
  },
  own: {
    fontFamily: fonts.semibold,
    fontSize: 10,
    color: colors.primaryText,
    backgroundColor: "rgba(249,115,22,0.15)",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: "hidden",
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.mutedForeground,
  },
  chipTextOn: { color: colors.primaryForeground },
}));

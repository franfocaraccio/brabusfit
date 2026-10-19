import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, fonts, radius } from "@/lib/theme";

/** Panel inferior modal (equivalente a los Dialog de la web). */
export function Sheet({
  visible,
  onClose,
  title,
  description,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Cerrar" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.title}>{title}</Text>
              {description ? <Text style={styles.description}>{description}</Text> : null}
            </View>
            <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Cerrar">
              <Ionicons name="close" size={24} color={colors.mutedForeground} />
            </Pressable>
          </View>
          <ScrollView
            style={{ flexGrow: 0 }}
            contentContainerStyle={{ gap: 14 }}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Lista de opciones para elegir una (ej. carpeta). */
export function OptionList<T extends string>({
  options,
  value,
  onSelect,
}: {
  options: { value: T; label: string; icon?: keyof typeof Ionicons.glyphMap }[];
  value: T | null;
  onSelect: (v: T) => void;
}) {
  return (
    <View style={styles.options}>
      {options.map((o, i) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onSelect(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={[styles.option, i > 0 && styles.optionBorder]}
          >
            {o.icon ? (
              <Ionicons name={o.icon} size={18} color={colors.mutedForeground} />
            ) : null}
            <Text style={styles.optionText} numberOfLines={1}>
              {o.label}
            </Text>
            {selected ? <Ionicons name="checkmark" size={20} color={colors.primary} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 18,
    paddingTop: 8,
    gap: 14,
    maxHeight: "85%",
    borderWidth: 1,
    borderColor: colors.border,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  title: { fontFamily: fonts.heading, fontSize: 24, color: colors.foreground },
  description: { fontFamily: fonts.regular, fontSize: 14, color: colors.mutedForeground },
  options: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    minHeight: 50,
  },
  optionBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  optionText: { flex: 1, fontFamily: fonts.medium, fontSize: 16, color: colors.foreground },
});

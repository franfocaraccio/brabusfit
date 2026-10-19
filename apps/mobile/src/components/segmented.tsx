import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, fonts, radius } from "@/lib/theme";

/** Selector de opciones tipo "pastillas" (período, pestañas). */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <View style={styles.wrap}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[styles.item, on && styles.itemOn]}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
          >
            <Text style={[styles.text, on && styles.textOn]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignSelf: "flex-start",
    padding: 3,
    borderRadius: radius.md,
    backgroundColor: colors.muted,
  },
  item: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.sm },
  itemOn: { backgroundColor: colors.card },
  text: { fontFamily: fonts.medium, fontSize: 14, color: colors.mutedForeground },
  textOn: { color: colors.foreground },
});

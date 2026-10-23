import { Pressable, Text, View } from "react-native";

import { fonts, makeStyles, radius } from "@/lib/theme";

/** Selector de opciones tipo "pastillas" (período, pestañas). */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  fill = false,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  /** Ocupa todo el ancho con opciones del mismo tamaño (muchas opciones en un teléfono). */
  fill?: boolean;
}) {
  const styles = useStyles();
  return (
    <View style={[styles.wrap, fill && styles.wrapFill]}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[styles.item, fill && styles.itemFill, on && styles.itemOn]}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
          >
            <Text
              style={[
                styles.text,
                fill && styles.textFill,
                on && styles.textOn,
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit={fill}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  wrap: {
    flexDirection: "row",
    alignSelf: "flex-start",
    padding: 3,
    borderRadius: radius.md,
    backgroundColor: colors.muted,
  },
  item: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.sm },
  itemOn: { backgroundColor: colors.card },
  wrapFill: { alignSelf: "stretch" },
  itemFill: { flex: 1, paddingHorizontal: 4, alignItems: "center" },
  textFill: { fontSize: 13 },
  text: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.mutedForeground,
  },
  textOn: { color: colors.foreground },
}));

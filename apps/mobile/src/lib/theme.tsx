import { createContext, useContext, useState, type ReactNode } from "react";
import { StyleSheet, useColorScheme, type ViewStyle } from "react-native";

import { authStorage } from "@/lib/storage";

/**
 * Tema "performance" de Brabus Fit (mismos valores que la web).
 * Oscuro: slate con tarjetas de borde fino. Claro: gris crema con tarjetas
 * apoyadas en una sombra suave.
 */
const dark = {
  background: "#0e1116",
  card: "#161b22",
  foreground: "#f4f6fa",
  muted: "#20262f",
  mutedForeground: "#97a3b4",
  border: "#283039",
  input: "#2b333d",
  /** Fondo de los campos de texto. */
  field: "rgba(43,51,61,0.4)",
  /** Relleno apenas marcado (filas, bloques dentro de una tarjeta). */
  subtle: "rgba(32,38,47,0.4)",
  /** Velo sobre una superficie (presionado, separadores suaves). */
  overlay: "rgba(244,246,250,0.08)",
  primary: "#f97316",
  primaryLight: "#fb923c",
  primaryForeground: "#14110a",
  /** Naranja para textos y links (en claro se oscurece para que se lea). */
  primaryText: "#f97316",
  success: "#22c55e",
  successForeground: "#07140b",
  destructive: "#ef4444",
};

export type Palette = typeof dark;

const light: Palette = {
  background: "#f6f3ee",
  card: "#fffdfa",
  foreground: "#1d1a16",
  muted: "#eee9e1",
  mutedForeground: "#6f685e",
  border: "#e7e1d6",
  input: "#ddd6ca",
  field: "#f9f6f1",
  subtle: "rgba(238,233,225,0.6)",
  overlay: "rgba(60,45,25,0.06)",
  primary: "#f97316",
  primaryLight: "#fb923c",
  primaryForeground: "#14110a",
  primaryText: "#c2410c",
  success: "#16a34a",
  successForeground: "#f0fdf4",
  destructive: "#dc2626",
};

export const fonts = {
  regular: "Barlow_400Regular",
  medium: "Barlow_500Medium",
  semibold: "Barlow_600SemiBold",
  bold: "Barlow_700Bold",
  heading: "BarlowCondensed_700Bold",
  headingSemibold: "BarlowCondensed_600SemiBold",
  logo: "Unbounded_700Bold",
} as const;

export const radius = { sm: 8, md: 12, lg: 16 } as const;

// ---------------------------------------------------------------------------
// Preferencia del usuario (Oscuro · Claro · Automático), guardada en el teléfono
// ---------------------------------------------------------------------------

export type ThemePreference = "dark" | "light" | "system";
export type Scheme = "dark" | "light";

const STORAGE_KEY = "brabus-theme";

function readPreference(): ThemePreference {
  try {
    const v = authStorage.getItem(STORAGE_KEY);
    return v === "light" || v === "system" ? v : "dark";
  } catch {
    return "dark";
  }
}

type ThemeValue = {
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
  scheme: Scheme;
  colors: Palette;
};

const ThemeContext = createContext<ThemeValue>({
  preference: "dark",
  setPreference: () => {},
  scheme: "dark",
  colors: dark,
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [preference, setPref] = useState<ThemePreference>(readPreference);
  const scheme: Scheme =
    preference === "system"
      ? system === "light"
        ? "light"
        : "dark"
      : preference;

  const setPreference = (p: ThemePreference) => {
    setPref(p);
    try {
      authStorage.setItem(STORAGE_KEY, p);
    } catch {
      // Si no se puede guardar, igual se aplica hasta cerrar la app.
    }
  };

  return (
    <ThemeContext.Provider
      value={{
        preference,
        setPreference,
        scheme,
        colors: scheme === "light" ? light : dark,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
export const useColors = () => useContext(ThemeContext).colors;

type Styles = Parameters<typeof StyleSheet.create>[0];

/**
 * Hoja de estilos que depende del tema: `const useStyles = makeStyles((colors) => ({...}))`
 * y adentro del componente `const styles = useStyles()`. Se arma una vez por tema.
 */
export function makeStyles<S extends Styles>(factory: (colors: Palette) => S & Styles) {
  const cache = new Map<Palette, Readonly<S>>();
  return function useStyles(): Readonly<S> {
    const colors = useColors();
    let styles = cache.get(colors);
    if (!styles) {
      styles = StyleSheet.create(factory(colors));
      cache.set(colors, styles);
    }
    return styles;
  };
}

/** Separación de las tarjetas: borde en oscuro, sombra suave en claro. */
export function cardElevation(scheme: Scheme, colors: Palette): ViewStyle {
  return scheme === "light"
    ? {
        borderColor: "transparent",
        shadowColor: "#3c2d19",
        shadowOpacity: 0.08,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 3 },
        elevation: 2,
      }
    : { borderColor: colors.border };
}

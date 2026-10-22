/** Tema "performance" de Brabus Fit (mismos valores que la web). */
export const colors = {
  background: "#0e1116",
  card: "#161b22",
  foreground: "#f4f6fa",
  muted: "#20262f",
  mutedForeground: "#97a3b4",
  border: "#283039",
  input: "#2b333d",
  primary: "#f97316",
  primaryLight: "#fb923c",
  primaryForeground: "#14110a",
  success: "#22c55e",
  successForeground: "#07140b",
  destructive: "#ef4444",
} as const;

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

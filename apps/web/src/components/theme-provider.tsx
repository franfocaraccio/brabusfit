"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Tema claro / oscuro / automático (clase "dark" en <html>). Se guarda por
 * dispositivo; por defecto oscuro, la identidad original de la app.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
      storageKey="brabus-theme"
    >
      {children}
    </NextThemesProvider>
  );
}

/**
 * En el navegador (solo para pruebas con `npm run dev:local`) se usa el
 * localStorage nativo: expo-sqlite en web requiere configuración extra.
 */
export const authStorage = typeof window === "undefined" ? undefined : window.localStorage;

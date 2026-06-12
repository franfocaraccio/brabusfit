/** Reglas de formato para el nombre de usuario. */
export const USERNAME_RE = /^[a-z0-9_.]{3,20}$/;

/** Devuelve un mensaje de error de formato, o null si es válido. */
export function usernameError(value: string): string | null {
  const v = value.trim().toLowerCase();
  if (v.length < 3) return "Mínimo 3 caracteres.";
  if (v.length > 20) return "Máximo 20 caracteres.";
  if (!USERNAME_RE.test(v)) {
    return "Solo minúsculas, números, punto y guión bajo.";
  }
  return null;
}

/**
 * Números decimales que aceptan coma o punto como separador.
 *
 * Los teclados numéricos en español (ej. iPhone con región Argentina) muestran
 * la coma, y un <input type="number"> la descarta. Por eso usamos inputs de
 * texto con inputMode="decimal" y normalizamos nosotros.
 */

/** Deja solo dígitos y un único separador decimal (el primero que aparezca). */
export function sanitizeDecimal(raw: string): string {
  let out = "";
  let hasSeparator = false;
  for (const ch of raw) {
    if (ch >= "0" && ch <= "9") {
      out += ch;
    } else if ((ch === "," || ch === ".") && !hasSeparator) {
      hasSeparator = true;
      out += ch;
    }
  }
  return out;
}

/** Convierte "12,5" o "12.5" a 12.5. Devuelve null si está vacío o no es válido. */
export function parseDecimal(value: string | null | undefined): number | null {
  const v = (value ?? "").trim().replace(",", ".");
  if (v === "" || v === ".") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

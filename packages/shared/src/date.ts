/**
 * Fechas escritas a mano como DD/MM/AAAA (mobile no tiene <input type="date">).
 * En la base se guardan como ISO (AAAA-MM-DD).
 */

/** Formatea mientras se escribe: solo dígitos, inserta las barras. */
export function maskDisplayDate(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/** "20/02/1998" → "1998-02-20". null si está incompleta o no existe. */
export function parseDisplayDate(value: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const d = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
  if (
    d.getUTCFullYear() !== Number(yyyy) ||
    d.getUTCMonth() !== Number(mm) - 1 ||
    d.getUTCDate() !== Number(dd)
  ) {
    return null;
  }
  return `${yyyy}-${mm}-${dd}`;
}

/** "1998-02-20" → "20/02/1998". */
export function formatDisplayDate(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

/** Mensaje de error para un campo de fecha opcional (vacío = válido). */
export function displayDateError(value: string): string | null {
  if (value.trim() === "") return null;
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(value.trim())) return "Usá el formato DD/MM/AAAA.";
  return parseDisplayDate(value) ? null : "Esa fecha no existe.";
}

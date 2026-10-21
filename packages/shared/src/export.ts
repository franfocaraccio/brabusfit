import { buildXlsx, type XlsxCell } from "./xlsx";

/** Rutina lista para exportar (solo ejercicios: sin pesos registrados). */
export type RoutineExport = {
  name: string;
  clientName: string | null;
  coachName: string | null;
  /** ISO de cuando se exporta. */
  date: string;
  days: { name: string; exercises: { name: string; setsReps: string }[] }[];
};

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

/** Encabezado común de los archivos exportados (rutinas y dietas). */
export type ExportHeader = {
  name: string;
  clientName: string | null;
  coachName: string | null;
  date: string;
};

/** Líneas de encabezado: "Cliente: …", "Coach: …", "Fecha: …". */
export function exportMeta(r: ExportHeader): string[] {
  return [
    r.clientName ? `Cliente: ${r.clientName}` : null,
    r.coachName ? `Coach: ${r.coachName}` : null,
    `Fecha: ${fmtDate(r.date)}`,
  ].filter((l): l is string => l !== null);
}

/** Nombre de archivo sin caracteres problemáticos: "Rutina - Fuerza - Andrés.pdf". */
export function exportFileName(
  r: ExportHeader,
  ext: "pdf" | "xlsx",
  prefix: "Rutina" | "Dieta" = "Rutina",
): string {
  const clean = (s: string) => s.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
  return `${[prefix, clean(r.name), r.clientName ? clean(r.clientName) : null]
    .filter(Boolean)
    .join(" - ")}.${ext}`;
}

/** Excel: una hoja por día con N°, ejercicio y series x repeticiones. */
export function routineXlsx(r: RoutineExport): Uint8Array {
  const meta = exportMeta(r);
  const days = r.days.length > 0 ? r.days : [{ name: "Rutina", exercises: [] }];
  return buildXlsx(
    days.map((day) => {
      const rows: XlsxCell[][] = [
        [{ value: r.name, style: "title" }],
        ...meta.map((m) => [m]),
        [],
        [{ value: day.name, style: "bold" }],
        [
          { value: "N°", style: "bold" },
          { value: "Ejercicio", style: "bold" },
          { value: "Series x repeticiones", style: "bold" },
        ],
        ...day.exercises.map((e, i): XlsxCell[] => [i + 1, e.name, e.setsReps]),
      ];
      return { name: day.name, widths: [6, 42, 26], rows };
    }),
  );
}

export const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** HTML imprimible (A4) para generar el PDF en mobile (expo-print). */
export function routineHtml(r: RoutineExport): string {
  const days = r.days
    .map(
      (day, d) => `
      <section>
        <h2><span class="n">${d + 1}</span>${escapeHtml(day.name)}</h2>
        <table>
          <thead><tr><th class="num">N°</th><th>Ejercicio</th><th class="sets">Series x reps</th></tr></thead>
          <tbody>${day.exercises
            .map(
              (e, i) =>
                `<tr><td class="num">${i + 1}</td><td>${escapeHtml(e.name)}</td><td class="sets">${escapeHtml(e.setsReps)}</td></tr>`,
            )
            .join("")}</tbody>
        </table>
      </section>`,
    )
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8" />
  <style>
    @page { size: A4; margin: 18mm 16mm; }
    body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #111; font-size: 12px; }
    header { border-bottom: 3px solid #f97316; padding-bottom: 10px; margin-bottom: 18px; }
    .brand { font-size: 11px; font-weight: 700; letter-spacing: 2px; color: #f97316; }
    h1 { font-size: 22px; margin: 4px 0 6px; }
    .meta { color: #555; font-size: 12px; }
    section { margin-bottom: 18px; page-break-inside: avoid; }
    h2 { font-size: 15px; margin: 0 0 6px; display: flex; align-items: center; gap: 8px; }
    .n { display: inline-block; background: #f97316; color: #fff; border-radius: 4px; padding: 1px 7px; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; background: #f4f4f5; font-size: 11px; text-transform: uppercase; color: #555; }
    th, td { padding: 7px 8px; border-bottom: 1px solid #e4e4e7; }
    .num { width: 32px; color: #777; }
    .sets { width: 140px; }
  </style></head><body>
  <header>
    <div class="brand">BRABUS FIT</div>
    <h1>${escapeHtml(r.name)}</h1>
    <div class="meta">${exportMeta(r).map(escapeHtml).join(" &nbsp;·&nbsp; ")}</div>
  </header>
  ${days || "<p>Esta rutina no tiene días.</p>"}
  </body></html>`;
}

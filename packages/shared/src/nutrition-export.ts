import { escapeHtml as h, exportMeta, type ExportHeader } from "./export";
import { dayRange, formatRange, macroLine, mealRange, optionLabel, optionTotals } from "./nutrition";
import { buildXlsx, type XlsxCell } from "./xlsx";

/** Plan listo para exportar (todo: objetivos, indicaciones, comidas y macros). */
export type PlanExport = ExportHeader & {
  guidelines: string | null;
  /** [["Calorías", "2.800 kcal"], …] */
  targets: [string, string][];
  meals: {
    name: string;
    time: string | null;
    options: {
      items: {
        food: string;
        /** "60 g", "2 unidades", "a gusto" o "". */
        amount: string;
        kcal: number | null;
        protein: number | null;
        carbs: number | null;
        fat: number | null;
      }[];
    }[];
  }[];
};

const num = (v: number | null) => (v === null ? "" : v);
const fmt = (v: number | null) =>
  v === null ? "" : v.toLocaleString("es-AR", { maximumFractionDigits: 1 });
const mealTitle = (m: PlanExport["meals"][number]) => (m.time ? `${m.name} (${m.time})` : m.name);

/** Excel: una hoja con objetivos, indicaciones y cada comida con sus opciones. */
export function planXlsx(p: PlanExport): Uint8Array {
  const bold = (v: string): XlsxCell => ({ value: v, style: "bold" });
  const rows: XlsxCell[][] = [[{ value: p.name, style: "title" }], ...exportMeta(p).map((m) => [m])];

  if (p.targets.length > 0) {
    rows.push([], [bold("Objetivos")], ...p.targets.map(([k, v]) => [k, v]));
  }
  if (p.guidelines) {
    rows.push([], [bold("Indicaciones")], ...p.guidelines.split("\n").map((l) => [l]));
  }

  for (const meal of p.meals) {
    rows.push([], [{ value: mealTitle(meal), style: "title" }]);
    meal.options.forEach((opt, i) => {
      if (meal.options.length > 1) rows.push([bold(optionLabel(i))]);
      rows.push(["Alimento", "Cantidad", "kcal", "Prot. (g)", "Carb. (g)", "Grasas (g)"].map(bold));
      for (const it of opt.items) {
        rows.push([it.food, it.amount, num(it.kcal), num(it.protein), num(it.carbs), num(it.fat)]);
      }
      const t = optionTotals(opt.items);
      if (t.hasData) {
        rows.push([bold("Total"), "", t.kcal, t.protein, t.carbs, t.fat].map((v) =>
          typeof v === "number" ? Math.round(v * 10) / 10 : v,
        ));
      }
    });
  }

  const day = dayRange(p.meals);
  if (day.hasData) {
    rows.push(
      [],
      [bold("Total del día"), "", formatRange(day, "kcal"), formatRange(day, "protein"), formatRange(day, "carbs"), formatRange(day, "fat")],
    );
  }

  return buildXlsx([{ name: "Plan", widths: [38, 16, 10, 10, 10, 10], rows }]);
}

/** HTML imprimible (A4) para el PDF en mobile (expo-print). */
export function planHtml(p: PlanExport): string {
  const day = dayRange(p.meals);
  const meals = p.meals
    .map((meal) => {
      const r = mealRange(meal.options);
      const options = meal.options
        .map((opt, i) => {
          const t = optionTotals(opt.items);
          return `
          ${meal.options.length > 1 ? `<div class="opt">${optionLabel(i)}</div>` : ""}
          <table>
            <thead><tr><th>Alimento</th><th>Cantidad</th><th class="n">kcal</th><th class="n">P</th><th class="n">C</th><th class="n">G</th></tr></thead>
            <tbody>${opt.items
              .map(
                (it) =>
                  `<tr><td>${h(it.food)}</td><td>${h(it.amount)}</td><td class="n">${fmt(it.kcal)}</td><td class="n">${fmt(it.protein)}</td><td class="n">${fmt(it.carbs)}</td><td class="n">${fmt(it.fat)}</td></tr>`,
              )
              .join("")}
            ${t.hasData ? `<tr class="tot"><td colspan="2">Total</td><td class="n">${fmt(Math.round(t.kcal))}</td><td class="n">${fmt(Math.round(t.protein))}</td><td class="n">${fmt(Math.round(t.carbs))}</td><td class="n">${fmt(Math.round(t.fat))}</td></tr>` : ""}
            </tbody>
          </table>`;
        })
        .join("");
      return `
      <section>
        <h2>${h(meal.name)}${meal.time ? ` <span class="time">${h(meal.time)}</span>` : ""}</h2>
        ${options}
        ${meal.options.length > 1 && r.hasData ? `<p class="range">Entre opciones: ${h(macroLine(r))}</p>` : ""}
      </section>`;
    })
    .join("");

  return `<!doctype html><html><head><meta charset="utf-8" />
  <style>
    @page { size: A4; margin: 16mm 14mm; }
    body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #111; font-size: 11.5px; }
    header { border-bottom: 3px solid #f97316; padding-bottom: 10px; margin-bottom: 14px; }
    .brand { font-size: 11px; font-weight: 700; letter-spacing: 2px; color: #f97316; }
    h1 { font-size: 22px; margin: 4px 0 6px; }
    .meta { color: #555; }
    .box { background: #f4f4f5; border-radius: 6px; padding: 8px 10px; margin-bottom: 12px; }
    .box b { display: block; font-size: 11px; text-transform: uppercase; color: #555; margin-bottom: 4px; }
    .targets span { display: inline-block; margin-right: 16px; }
    .guide { white-space: pre-line; }
    section { margin-bottom: 14px; page-break-inside: avoid; }
    h2 { font-size: 15px; margin: 0 0 6px; color: #111; }
    .time { font-size: 12px; color: #f97316; font-weight: 600; }
    .opt { font-weight: 700; font-size: 11px; color: #f97316; margin: 6px 0 3px; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; background: #f4f4f5; font-size: 10px; text-transform: uppercase; color: #555; }
    th, td { padding: 5px 7px; border-bottom: 1px solid #e4e4e7; }
    .n { text-align: right; width: 46px; }
    .tot td { font-weight: 700; }
    .range { color: #555; margin: 4px 0 0; }
    .day { border-top: 2px solid #f97316; padding-top: 8px; font-weight: 700; font-size: 13px; }
  </style></head><body>
  <header>
    <div class="brand">BRABUS FIT · PLAN DE ALIMENTACIÓN</div>
    <h1>${h(p.name)}</h1>
    <div class="meta">${exportMeta(p).map(h).join(" &nbsp;·&nbsp; ")}</div>
  </header>
  ${
    p.targets.length > 0
      ? `<div class="box targets"><b>Objetivos</b>${p.targets.map(([k, v]) => `<span>${h(k)}: <strong>${h(v)}</strong></span>`).join("")}</div>`
      : ""
  }
  ${p.guidelines ? `<div class="box"><b>Indicaciones</b><div class="guide">${h(p.guidelines)}</div></div>` : ""}
  ${meals || "<p>Este plan no tiene comidas.</p>"}
  ${day.hasData ? `<p class="day">Total del día: ${h(macroLine(day))}</p>` : ""}
  </body></html>`;
}

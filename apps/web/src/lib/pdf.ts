import {
  dayRange,
  exportMeta,
  macroLine,
  mealRange,
  optionLabel,
  optionTotals,
  type ExportHeader,
  type PlanExport,
  type RoutineExport,
} from "@brabus/shared";

// PDFs de la web (jsPDF, se carga solo al exportar). En mobile se usa el HTML
// de @brabus/shared con expo-print.

type Doc = import("jspdf").jsPDF;
type RGB = [number, number, number];

const ORANGE: RGB = [249, 115, 22];
const MARGIN = 16;
const PAGE_BOTTOM = 280;

async function load() {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  return { doc: new jsPDF({ unit: "mm", format: "a4" }), autoTable };
}

/** Encabezado común. Devuelve la altura donde sigue el contenido. */
function header(doc: Doc, h: ExportHeader, kicker: string): number {
  doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(...ORANGE);
  doc.text(kicker, MARGIN, 18);
  doc.setFontSize(18).setTextColor(17, 17, 17);
  doc.text(h.name, MARGIN, 27);
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(90, 90, 90);
  doc.text(exportMeta(h).join("   ·   "), MARGIN, 34);
  doc.setDrawColor(...ORANGE).setLineWidth(0.8);
  doc.line(MARGIN, 38, 210 - MARGIN, 38);
  return 46;
}

const lastY = (doc: Doc) => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

function ensureSpace(doc: Doc, y: number, needed = 20): number {
  if (y + needed <= PAGE_BOTTOM) return y;
  doc.addPage();
  return 20;
}

const TABLE_STYLE = {
  headStyles: { fillColor: [244, 244, 245] as RGB, textColor: [85, 85, 85] as RGB, fontStyle: "bold" as const },
  styles: { fontSize: 10, cellPadding: 2.5 },
  theme: "grid" as const,
};

/** Rutina: una tabla por día (solo ejercicios). */
export async function routinePdf(r: RoutineExport): Promise<Blob> {
  const { doc, autoTable } = await load();
  let y = header(doc, r, "BRABUS FIT");

  r.days.forEach((day, d) => {
    y = ensureSpace(doc, y);
    doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(17, 17, 17);
    doc.text(`${d + 1}. ${day.name}`, MARGIN, y);
    autoTable(doc, {
      ...TABLE_STYLE,
      startY: y + 3,
      margin: { left: MARGIN, right: MARGIN },
      head: [["N°", "Ejercicio", "Series x reps"]],
      body: day.exercises.map((e, i) => [String(i + 1), e.name, e.setsReps]),
      columnStyles: { 0: { cellWidth: 12, textColor: [120, 120, 120] }, 2: { cellWidth: 40 } },
    });
    y = lastY(doc) + 10;
  });
  if (r.days.length === 0) doc.text("Esta rutina no tiene días.", MARGIN, y);
  return doc.output("blob");
}

const n = (v: number | null) =>
  v === null ? "" : v.toLocaleString("es-AR", { maximumFractionDigits: 1 });

/** Plan de nutrición: objetivos, indicaciones y cada comida con sus opciones y macros. */
export async function planPdf(p: PlanExport): Promise<Blob> {
  const { doc, autoTable } = await load();
  let y = header(doc, p, "BRABUS FIT · PLAN DE ALIMENTACIÓN");
  const width = 210 - MARGIN * 2;

  if (p.targets.length > 0) {
    doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(85, 85, 85);
    doc.text("OBJETIVOS", MARGIN, y);
    doc.setFont("helvetica", "normal").setTextColor(17, 17, 17);
    doc.text(p.targets.map(([k, v]) => `${k}: ${v}`).join("    "), MARGIN, y + 6);
    y += 14;
  }
  if (p.guidelines) {
    doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(85, 85, 85);
    doc.text("INDICACIONES", MARGIN, y);
    doc.setFont("helvetica", "normal").setTextColor(17, 17, 17);
    const lines = doc.splitTextToSize(p.guidelines, width) as string[];
    doc.text(lines, MARGIN, y + 6);
    y += 8 + lines.length * 5;
  }

  for (const meal of p.meals) {
    y = ensureSpace(doc, y + 2, 30);
    doc.setFont("helvetica", "bold").setFontSize(13).setTextColor(17, 17, 17);
    doc.text(meal.name, MARGIN, y);
    if (meal.time) {
      doc.setFontSize(10).setTextColor(...ORANGE);
      doc.text(meal.time, MARGIN + doc.getTextWidth(meal.name) * (13 / 10) + 3, y);
    }
    y += 2;

    meal.options.forEach((opt, i) => {
      if (meal.options.length > 1) {
        y = ensureSpace(doc, y + 4);
        doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(...ORANGE);
        doc.text(optionLabel(i), MARGIN, y + 2);
        y += 2;
      }
      const t = optionTotals(opt.items);
      autoTable(doc, {
        ...TABLE_STYLE,
        startY: y + 2,
        margin: { left: MARGIN, right: MARGIN },
        head: [["Alimento", "Cantidad", "kcal", "P", "C", "G"]],
        body: opt.items.map((it) => [it.food, it.amount, n(it.kcal), n(it.protein), n(it.carbs), n(it.fat)]),
        foot: t.hasData
          ? [["Total", "", n(Math.round(t.kcal)), n(Math.round(t.protein)), n(Math.round(t.carbs)), n(Math.round(t.fat))]]
          : undefined,
        footStyles: { fillColor: [255, 255, 255], textColor: [17, 17, 17], fontStyle: "bold" },
        columnStyles: {
          1: { cellWidth: 30 },
          2: { cellWidth: 16, halign: "right" },
          3: { cellWidth: 14, halign: "right" },
          4: { cellWidth: 14, halign: "right" },
          5: { cellWidth: 14, halign: "right" },
        },
      });
      y = lastY(doc) + 2;
    });

    const r = mealRange(meal.options);
    if (meal.options.length > 1 && r.hasData) {
      doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(90, 90, 90);
      doc.text(`Entre opciones: ${macroLine(r)}`, MARGIN, y + 4);
      y += 6;
    }
    y += 6;
  }

  const day = dayRange(p.meals);
  if (day.hasData) {
    y = ensureSpace(doc, y, 12);
    doc.setDrawColor(...ORANGE).setLineWidth(0.6);
    doc.line(MARGIN, y, 210 - MARGIN, y);
    doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(17, 17, 17);
    doc.text(`Total del día: ${macroLine(day)}`, MARGIN, y + 7);
  }
  return doc.output("blob");
}

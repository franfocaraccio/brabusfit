import { describe, expect, it } from "vitest";

import {
  escapeHtml,
  exportFileName,
  exportMeta,
  routineHtml,
  routineXlsx,
  type RoutineExport,
} from "./export";
import { planHtml, planXlsx, type PlanExport } from "./nutrition-export";
import { buildXlsx } from "./xlsx";

/** Lee un zip sin compresión (lo que genera buildXlsx) → { ruta: texto }. */
function unzipStored(zip: Uint8Array): Record<string, string> {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const files: Record<string, string> = {};
  let pos = 0;
  while (view.getUint32(pos, true) === 0x04034b50) {
    expect(view.getUint16(pos + 8, true)).toBe(0); // sin compresión
    const size = view.getUint32(pos + 18, true);
    const nameLen = view.getUint16(pos + 26, true);
    const extraLen = view.getUint16(pos + 28, true);
    const name = new TextDecoder().decode(zip.subarray(pos + 30, pos + 30 + nameLen));
    const start = pos + 30 + nameLen + extraLen;
    files[name] = new TextDecoder().decode(zip.subarray(start, start + size));
    pos = start + size;
  }
  // Después de los archivos viene el directorio central.
  expect(view.getUint32(pos, true)).toBe(0x02014b50);
  return files;
}

const routine: RoutineExport = {
  name: "Fuerza <A>",
  clientName: "Andrés",
  coachName: "Carla Coach",
  date: new Date(2026, 9, 21, 10).toISOString(),
  days: [
    {
      name: "Día 1: Empuje",
      exercises: [
        { name: "Press banca", setsReps: "4x8 · Descanso 2 min" },
        { name: "Fondos", setsReps: "3xAL FALLO" },
      ],
    },
    { name: "Día 1: Empuje", exercises: [] },
  ],
};

describe("exportMeta / exportFileName / escapeHtml", () => {
  it("builds the header lines, skipping missing names", () => {
    expect(exportMeta(routine)).toEqual([
      "Cliente: Andrés",
      "Coach: Carla Coach",
      "Fecha: 21/10/2026",
    ]);
    expect(exportMeta({ ...routine, clientName: null, coachName: null })).toEqual([
      "Fecha: 21/10/2026",
    ]);
  });

  it("builds a safe file name", () => {
    expect(exportFileName(routine, "pdf")).toBe("Rutina - Fuerza A - Andrés.pdf");
    expect(
      exportFileName({ ...routine, name: "Plan: 2026/10", clientName: null }, "xlsx", "Dieta"),
    ).toBe("Dieta - Plan 2026 10.xlsx");
  });

  it("escapes HTML special characters", () => {
    expect(escapeHtml(`<b class="x">&</b>`)).toBe(
      "&lt;b class=&quot;x&quot;&gt;&amp;&lt;/b&gt;",
    );
  });
});

describe("buildXlsx", () => {
  it("creates a valid package with one worksheet per sheet", () => {
    const files = unzipStored(
      buildXlsx([
        { name: "Hoja", rows: [["texto", 12, { value: "neg", style: "bold" }, ""]] },
      ]),
    );
    expect(Object.keys(files).sort()).toEqual([
      "[Content_Types].xml",
      "_rels/.rels",
      "xl/_rels/workbook.xml.rels",
      "xl/styles.xml",
      "xl/workbook.xml",
      "xl/worksheets/sheet1.xml",
    ]);
    const sheet = files["xl/worksheets/sheet1.xml"];
    expect(sheet).toContain(`<c r="A1" t="inlineStr"><is><t xml:space="preserve">texto</t></is></c>`);
    expect(sheet).toContain(`<c r="B1"><v>12</v></c>`);
    expect(sheet).toContain(`<c r="C1" s="1" t="inlineStr">`);
    // Las celdas vacías no se escriben.
    expect(sheet).not.toContain(`r="D1"`);
  });

  it("makes sheet names valid and unique", () => {
    const files = unzipStored(
      buildXlsx([
        { name: "Día 1: Empuje", rows: [] },
        { name: "día 1: empuje", rows: [] },
        { name: "x".repeat(40), rows: [] },
        { name: "  ", rows: [] },
      ]),
    );
    const names = [...files["xl/workbook.xml"].matchAll(/<sheet name="([^"]*)"/g)].map(
      (m) => m[1],
    );
    expect(names).toEqual(["Día 1  Empuje", "día 1  empuje (2)", "x".repeat(31), "Hoja 4"]);
  });

  it("escapes XML and strips control characters", () => {
    const sheet = unzipStored(buildXlsx([{ name: "A", rows: [["a<b>&\u0001c"]] }]))[
      "xl/worksheets/sheet1.xml"
    ];
    expect(sheet).toContain("a&lt;b&gt;&amp;c");
  });
});

describe("routine export", () => {
  it("writes one sheet per day with numbered exercises", () => {
    const files = unzipStored(routineXlsx(routine));
    const sheet = files["xl/worksheets/sheet1.xml"];
    expect(sheet).toContain("Fuerza &lt;A&gt;");
    expect(sheet).toContain("Cliente: Andrés");
    expect(sheet).toContain("Press banca");
    expect(sheet).toContain(`<c r="A8"><v>1</v></c>`);
    expect(files["xl/worksheets/sheet2.xml"]).toBeDefined();
  });

  it("writes a single empty sheet for a routine without days", () => {
    const files = unzipStored(routineXlsx({ ...routine, days: [] }));
    expect(files["xl/workbook.xml"]).toContain(`<sheet name="Rutina"`);
  });

  it("renders printable, escaped HTML", () => {
    const html = routineHtml(routine);
    expect(html).toContain("<h1>Fuerza &lt;A&gt;</h1>");
    expect(html).toContain("Press banca");
    expect(routineHtml({ ...routine, days: [] })).toContain("Esta rutina no tiene días.");
  });
});

describe("plan export", () => {
  const plan: PlanExport = {
    name: "Plan base",
    clientName: "Andrés",
    coachName: null,
    date: routine.date,
    guidelines: "Tomar agua\nNo saltear comidas",
    targets: [["Calorías", "2.800 kcal"]],
    meals: [
      {
        name: "Almuerzo",
        time: "13:00",
        options: [
          {
            items: [
              { food: "Pollo", amount: "150 g", kcal: 247.5, protein: 46.5, carbs: 0, fat: 5.4 },
              { food: "Arroz", amount: "80 g", kcal: 288, protein: 5.6, carbs: 63, fat: null },
            ],
          },
          { items: [{ food: "Carne", amount: "150 g", kcal: 300, protein: 40, carbs: 0, fat: 15 }] },
        ],
      },
    ],
  };

  it("includes targets, guidelines, meals and totals in the Excel", () => {
    const sheet = unzipStored(planXlsx(plan))["xl/worksheets/sheet1.xml"];
    for (const text of ["Objetivos", "2.800 kcal", "No saltear comidas", "Almuerzo (13:00)", "Pollo", "Carne"]) {
      expect(sheet).toContain(text);
    }
  });

  it("renders the plan as HTML", () => {
    const html = planHtml(plan);
    expect(html).toContain("Plan base");
    expect(html).toContain("Almuerzo");
    expect(html).toContain("Opción B");
  });
});

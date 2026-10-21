"use client";

import { useState } from "react";
import { FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";

import { exportFileName, exportMeta, routineXlsx, type RoutineExport } from "@brabus/shared";

import { Button } from "@/components/ui/button";

function download(data: Blob, fileName: string) {
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const ORANGE: [number, number, number] = [249, 115, 22];

/** PDF A4: encabezado + una tabla por día (solo ejercicios). */
async function buildPdf(r: RoutineExport): Promise<Blob> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const margin = 16;

  doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(...ORANGE);
  doc.text("BRABUS FIT", margin, 18);
  doc.setFontSize(18).setTextColor(17, 17, 17);
  doc.text(r.name, margin, 27);
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(90, 90, 90);
  doc.text(exportMeta(r).join("   ·   "), margin, 34);
  doc.setDrawColor(...ORANGE).setLineWidth(0.8);
  doc.line(margin, 38, 210 - margin, 38);

  let y = 46;
  r.days.forEach((day, d) => {
    if (y > 260) {
      doc.addPage();
      y = 20;
    }
    doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(17, 17, 17);
    doc.text(`${d + 1}. ${day.name}`, margin, y);
    autoTable(doc, {
      startY: y + 3,
      margin: { left: margin, right: margin },
      head: [["N°", "Ejercicio", "Series x reps"]],
      body: day.exercises.map((e, i) => [String(i + 1), e.name, e.setsReps]),
      headStyles: { fillColor: [244, 244, 245], textColor: [85, 85, 85], fontStyle: "bold" },
      styles: { fontSize: 10, cellPadding: 2.5 },
      columnStyles: { 0: { cellWidth: 12, textColor: [120, 120, 120] }, 2: { cellWidth: 40 } },
      theme: "grid",
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  });
  if (r.days.length === 0) doc.text("Esta rutina no tiene días.", margin, y);

  return doc.output("blob");
}

/** Botones para exportar la rutina a PDF o Excel. */
export function ExportRoutine({ data }: { data: RoutineExport }) {
  const [busy, setBusy] = useState<"pdf" | "xlsx" | null>(null);

  const run = async (kind: "pdf" | "xlsx") => {
    setBusy(kind);
    try {
      // La fecha del archivo es la de hoy, no la de cuando cargó la página.
      const fresh = { ...data, date: new Date().toISOString() };
      const blob =
        kind === "pdf"
          ? await buildPdf(fresh)
          : new Blob([routineXlsx(fresh) as BlobPart], {
              type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            });
      download(blob, exportFileName(fresh, kind));
    } catch {
      toast.error("No se pudo exportar la rutina.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() => run("pdf")}
        disabled={busy !== null}
      >
        <FileText className="size-4" /> {busy === "pdf" ? "Generando…" : "PDF"}
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() => run("xlsx")}
        disabled={busy !== null}
      >
        <FileSpreadsheet className="size-4" /> {busy === "xlsx" ? "Generando…" : "Excel"}
      </Button>
    </>
  );
}

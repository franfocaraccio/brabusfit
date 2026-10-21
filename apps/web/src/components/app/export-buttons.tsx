"use client";

import { useState } from "react";
import { FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";

import {
  exportFileName,
  planXlsx,
  routineXlsx,
  type PlanExport,
  type RoutineExport,
} from "@brabus/shared";

import { Button } from "@/components/ui/button";
import { planPdf, routinePdf } from "@/lib/pdf";

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

const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Botones para exportar una rutina o un plan de nutrición a PDF o Excel. */
export function ExportButtons(
  props: { kind: "routine"; data: RoutineExport } | { kind: "plan"; data: PlanExport },
) {
  const [busy, setBusy] = useState<"pdf" | "xlsx" | null>(null);

  const run = async (ext: "pdf" | "xlsx") => {
    setBusy(ext);
    try {
      // La fecha del archivo es la de hoy, no la de cuando cargó la página.
      const date = new Date().toISOString();
      let blob: Blob;
      let name: string;
      if (props.kind === "routine") {
        const data = { ...props.data, date };
        blob = ext === "pdf" ? await routinePdf(data) : new Blob([routineXlsx(data) as BlobPart], { type: XLSX_TYPE });
        name = exportFileName(data, ext, "Rutina");
      } else {
        const data = { ...props.data, date };
        blob = ext === "pdf" ? await planPdf(data) : new Blob([planXlsx(data) as BlobPart], { type: XLSX_TYPE });
        name = exportFileName(data, ext, "Dieta");
      }
      download(blob, name);
    } catch {
      toast.error("No se pudo exportar.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => run("pdf")} disabled={busy !== null}>
        <FileText className="size-4" /> {busy === "pdf" ? "Generando…" : "PDF"}
      </Button>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => run("xlsx")} disabled={busy !== null}>
        <FileSpreadsheet className="size-4" /> {busy === "xlsx" ? "Generando…" : "Excel"}
      </Button>
    </>
  );
}

import {
  exportFileName,
  planHtml,
  planXlsx,
  routineHtml,
  routineXlsx,
  type PlanExport,
  type RoutineExport,
} from "@brabus/shared";

// En la versión web de la app (pruebas locales) se descarga / imprime en el navegador.

async function printHtml(html: string, fileName: string): Promise<void> {
  const win = window.open("", "_blank");
  if (!win) throw new Error("El navegador bloqueó la ventana.");
  win.document.write(html);
  win.document.title = fileName;
  win.document.close();
  win.focus();
  win.print();
}

async function downloadXlsx(bytes: Uint8Array, fileName: string): Promise<void> {
  const blob = new Blob([bytes as BlobPart], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const shareRoutinePdf = (r: RoutineExport) =>
  printHtml(routineHtml(r), exportFileName(r, "pdf", "Rutina"));
export const shareRoutineXlsx = (r: RoutineExport) =>
  downloadXlsx(routineXlsx(r), exportFileName(r, "xlsx", "Rutina"));
export const sharePlanPdf = (p: PlanExport) =>
  printHtml(planHtml(p), exportFileName(p, "pdf", "Dieta"));
export const sharePlanXlsx = (p: PlanExport) =>
  downloadXlsx(planXlsx(p), exportFileName(p, "xlsx", "Dieta"));

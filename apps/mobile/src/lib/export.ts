import { File, Paths } from "expo-file-system";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import {
  exportFileName,
  planHtml,
  planXlsx,
  routineHtml,
  routineXlsx,
  type PlanExport,
  type RoutineExport,
} from "@brabus/shared";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Archivo nuevo en caché con ese nombre (pisa uno anterior). */
function cacheFile(name: string): File {
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  return file;
}

/** Genera un PDF desde HTML y abre el menú de compartir (WhatsApp, mail, etc.). */
async function sharePdf(html: string, fileName: string): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html });
  const dest = cacheFile(fileName);
  new File(uri).move(dest);
  await Sharing.shareAsync(dest.uri, {
    mimeType: "application/pdf",
    UTI: "com.adobe.pdf",
    dialogTitle: "Compartir",
  });
}

/** Guarda un .xlsx y abre el menú de compartir. */
async function shareXlsx(bytes: Uint8Array, fileName: string): Promise<void> {
  const file = cacheFile(fileName);
  file.create();
  file.write(bytes);
  await Sharing.shareAsync(file.uri, {
    mimeType: XLSX_MIME,
    UTI: "org.openxmlformats.spreadsheetml.sheet",
    dialogTitle: "Compartir",
  });
}

export const shareRoutinePdf = (r: RoutineExport) =>
  sharePdf(routineHtml(r), exportFileName(r, "pdf", "Rutina"));
export const shareRoutineXlsx = (r: RoutineExport) =>
  shareXlsx(routineXlsx(r), exportFileName(r, "xlsx", "Rutina"));
export const sharePlanPdf = (p: PlanExport) =>
  sharePdf(planHtml(p), exportFileName(p, "pdf", "Dieta"));
export const sharePlanXlsx = (p: PlanExport) =>
  shareXlsx(planXlsx(p), exportFileName(p, "xlsx", "Dieta"));

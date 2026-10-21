import { File, Paths } from "expo-file-system";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import { exportFileName, routineHtml, routineXlsx, type RoutineExport } from "@brabus/shared";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Archivo nuevo en caché con ese nombre (pisa uno anterior). */
function cacheFile(name: string): File {
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  return file;
}

/** Genera el PDF de la rutina y abre el menú de compartir (WhatsApp, mail, etc.). */
export async function shareRoutinePdf(r: RoutineExport): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html: routineHtml(r) });
  const dest = cacheFile(exportFileName(r, "pdf"));
  new File(uri).move(dest);
  await Sharing.shareAsync(dest.uri, {
    mimeType: "application/pdf",
    UTI: "com.adobe.pdf",
    dialogTitle: "Compartir rutina",
  });
}

/** Genera el Excel de la rutina y abre el menú de compartir. */
export async function shareRoutineXlsx(r: RoutineExport): Promise<void> {
  const file = cacheFile(exportFileName(r, "xlsx"));
  file.create();
  file.write(routineXlsx(r));
  await Sharing.shareAsync(file.uri, {
    mimeType: XLSX_MIME,
    UTI: "org.openxmlformats.spreadsheetml.sheet",
    dialogTitle: "Compartir rutina",
  });
}

import { exportFileName, routineHtml, routineXlsx, type RoutineExport } from "@brabus/shared";

// En la versión web de la app (pruebas locales) se descarga / imprime en el navegador.

export async function shareRoutinePdf(r: RoutineExport): Promise<void> {
  const win = window.open("", "_blank");
  if (!win) throw new Error("El navegador bloqueó la ventana.");
  win.document.write(routineHtml(r));
  win.document.title = exportFileName(r, "pdf");
  win.document.close();
  win.focus();
  win.print();
}

export async function shareRoutineXlsx(r: RoutineExport): Promise<void> {
  const blob = new Blob([routineXlsx(r) as BlobPart], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = exportFileName(r, "xlsx");
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

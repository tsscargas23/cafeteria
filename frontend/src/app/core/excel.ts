/** Leer y armar planillas de Excel. La librería se carga recién cuando hace falta, para que la app abra rápido. */

export async function leerPlanilla(archivo: File): Promise<Record<string, unknown>[]> {
  const XLSX = await import('xlsx');
  const libro = XLSX.read(await archivo.arrayBuffer());
  const hoja = libro.Sheets[libro.SheetNames[0]];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(hoja, { defval: '' });
}

export async function descargarPlanilla(nombreArchivo: string, hojas: { nombre: string; filas: Record<string, unknown>[] }[]) {
  const XLSX = await import('xlsx');
  const libro = XLSX.utils.book_new();
  for (const h of hojas) XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(h.filas), h.nombre.slice(0, 31));
  XLSX.writeFile(libro, nombreArchivo);
}

export function descargarTexto(nombreArchivo: string, texto: string, tipo = 'application/json') {
  const url = URL.createObjectURL(new Blob([texto], { type: tipo }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

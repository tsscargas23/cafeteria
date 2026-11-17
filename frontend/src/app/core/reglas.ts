import {
  Cuenta, Insumo, ItemCuenta, LineaVenta, MedioPago, Origen, Producto, Turno, Venta,
} from './modelos';

/**
 * Reglas de negocio en funciones puras, sin Angular, para poder testearlas.
 * En el sistema real estas mismas cuentas se repiten en la base (funciones de Postgres) y el
 * navegador nunca decide un precio ni un total.
 */

// ---------- Cuentas de mesa ----------

/** Nombre que se ve en la cuenta: "Café mediano", pero "Tostado" o "Medialuna" a secas. */
export function nombreItem(p: Producto, variante: string): string {
  const simple = ['unidad', 'único', 'unico', 'vaso', 'lata'].includes(variante.toLowerCase());
  return p.variantes.length > 1 && !simple ? `${p.nombre} ${variante.toLowerCase()}` : p.nombre;
}

export function totalItems(items: ItemCuenta[]): number {
  return items.reduce((s, i) => s + i.precio * i.cantidad, 0);
}

export function totalCuenta(c: Cuenta): number {
  return totalItems(c.items);
}

export function pagadoCuenta(c: Cuenta): number {
  return c.pagos.reduce((s, p) => s + p.monto, 0);
}

/** Lo que falta cobrar. Siempre en plata: total menos todo lo pagado, sin importar cómo se pagó. */
export function pendienteCuenta(c: Cuenta): number {
  return Math.max(0, totalCuenta(c) - pagadoCuenta(c));
}

export function itemsDePersona(c: Cuenta, personaId: string): ItemCuenta[] {
  return c.items.filter((i) => i.personaId === personaId && !i.pagado);
}

/** Lo de "toda la mesa" que todavía nadie cubrió. */
export function compartidoRestante(c: Cuenta): number {
  const compartido = totalItems(c.items.filter((i) => i.personaId === null && !i.pagado));
  const cubierto = c.pagos.reduce((s, p) => s + p.cubreCompartido, 0);
  return Math.max(0, compartido - cubierto);
}

/** Personas que todavía no pagaron lo suyo con "Cada uno lo suyo". */
export function personasSinPagar(c: Cuenta): string[] {
  const pagaron = new Set(c.pagos.filter((p) => p.modo === 'persona' && p.personaId).map((p) => p.personaId));
  return c.personas.map((p) => p.id).filter((id) => !pagaron.has(id));
}

/**
 * Cuánto paga una persona con "Cada uno lo suyo": lo suyo, más (si se reparte) su parte de lo compartido.
 * La última persona en pagar se lleva el resto, así la suma cierra exacta.
 */
export function aPagarPersona(c: Cuenta, personaId: string, repartirCompartido: boolean): { propio: number; compartido: number; total: number } {
  const propio = totalItems(itemsDePersona(c, personaId));
  let compartido = 0;
  if (repartirCompartido) {
    const faltan = personasSinPagar(c);
    const restante = compartidoRestante(c);
    if (faltan.includes(personaId) && faltan.length > 0) {
      compartido = faltan.length === 1 ? restante : Math.round(restante / faltan.length);
    }
  }
  return { propio, compartido, total: propio + compartido };
}

/** Divide un monto en n partes enteras; la última absorbe el redondeo para que la suma cierre. */
export function partesIguales(monto: number, n: number): number[] {
  if (n <= 0) return [];
  const base = Math.floor(monto / n);
  const partes = Array.from({ length: n }, () => base);
  partes[n - 1] = monto - base * (n - 1);
  return partes;
}

export function vuelto(recibido: number, aCobrar: number): number {
  return Math.max(0, recibido - aCobrar);
}

// ---------- Caja y turnos ----------

export function ventasDelTurno(ventas: Venta[], turnoId: string): Venta[] {
  return ventas.filter((v) => v.turnoId === turnoId && !v.anulada);
}

export function totalesPorMedio(ventas: Venta[]): Record<MedioPago, number> {
  const t: Record<MedioPago, number> = { efectivo: 0, transferencia: 0, mercadopago: 0, debito: 0, credito: 0 };
  for (const v of ventas) {
    if (v.anulada) continue;
    for (const p of v.pagos) t[p.medio] += p.monto;
  }
  return t;
}

/** Efectivo que debería haber en la caja: lo inicial, más ventas en efectivo, más ingresos, menos egresos. */
export function efectivoEsperado(turno: Turno, ventas: Venta[]): number {
  const enEfectivo = totalesPorMedio(ventasDelTurno(ventas, turno.id)).efectivo;
  const movs = turno.movimientos.reduce((s, m) => s + (m.tipo === 'ingreso' ? m.monto : -m.monto), 0);
  return turno.efectivoInicial + enEfectivo + movs;
}

// ---------- Stock ----------

export type EstadoStock = 'ok' | 'bajo' | 'sin';

export function estadoStock(i: Insumo): EstadoStock {
  if (i.stock <= 0) return 'sin';
  if (i.stock <= i.minimo) return 'bajo';
  return 'ok';
}

/** Cuánto de cada insumo consumen unas líneas de venta, según las recetas. */
export function consumo(lineas: { productoId: string; varianteId: string; cantidad: number }[], productos: Producto[]): Map<string, number> {
  const porId = new Map(productos.map((p) => [p.id, p]));
  const total = new Map<string, number>();
  for (const l of lineas) {
    const v = porId.get(l.productoId)?.variantes.find((x) => x.id === l.varianteId);
    if (!v) continue;
    for (const r of v.receta) total.set(r.insumoId, (total.get(r.insumoId) ?? 0) + r.cantidad * l.cantidad);
  }
  return total;
}

export function aplicarAumento(precio: number, porcentaje: number, redondeo: number): number {
  const nuevo = precio * (1 + porcentaje / 100);
  return redondeo > 0 ? Math.round(nuevo / redondeo) * redondeo : Math.round(nuevo);
}

// ---------- Reportes ----------

export interface Filtros {
  desde: number;
  hasta: number;
  /** "productoId" (todos sus tamaños) o "productoId:varianteId" (un tamaño). */
  productos: string[];
  categorias: string[];
  empleadas: string[];
  turnoDefs: string[];
  medios: MedioPago[];
  origenes: Origen[];
}

export function filtrosVacios(desde: number, hasta: number): Filtros {
  return { desde, hasta, productos: [], categorias: [], empleadas: [], turnoDefs: [], medios: [], origenes: [] };
}

function filtraPorProducto(f: Filtros): boolean {
  return f.productos.length > 0 || f.categorias.length > 0;
}

export function lineaCoincide(l: LineaVenta, f: Filtros): boolean {
  if (f.categorias.length && !f.categorias.includes(l.categoria)) return false;
  if (f.productos.length && !f.productos.includes(l.productoId) && !f.productos.includes(`${l.productoId}:${l.varianteId}`)) return false;
  return true;
}

export function filtrarVentas(ventas: Venta[], f: Filtros, turnos: Turno[]): Venta[] {
  const defDeTurno = new Map(turnos.map((t) => [t.id, t.defId]));
  return ventas.filter((v) => {
    if (v.anulada) return false;
    if (v.fecha < f.desde || v.fecha > f.hasta) return false;
    if (f.empleadas.length && !f.empleadas.includes(v.usuarioId)) return false;
    if (f.origenes.length && !f.origenes.includes(v.origen)) return false;
    if (f.turnoDefs.length && !f.turnoDefs.includes(defDeTurno.get(v.turnoId) ?? '')) return false;
    if (f.medios.length && !v.pagos.some((p) => f.medios.includes(p.medio))) return false;
    if (filtraPorProducto(f) && !v.lineas.some((l) => lineaCoincide(l, f))) return false;
    return true;
  });
}

/**
 * Lo que aporta una venta al total según los filtros.
 * Con filtro de producto: solo esas líneas. Con filtro de medio de pago: solo esos pagos. Si no, el total.
 */
export function importeFiltrado(v: Venta, f: Filtros): number {
  if (filtraPorProducto(f)) return v.lineas.filter((l) => lineaCoincide(l, f)).reduce((s, l) => s + l.precio * l.cantidad, 0);
  if (f.medios.length) return v.pagos.filter((p) => f.medios.includes(p.medio)).reduce((s, p) => s + p.monto, 0);
  return v.total;
}

export interface FilaProducto {
  clave: string;
  nombre: string;
  variante: string;
  categoria: string;
  cantidad: number;
  total: number;
}

export function porProducto(ventas: Venta[], f: Filtros): FilaProducto[] {
  const filas = new Map<string, FilaProducto>();
  for (const v of ventas) {
    for (const l of v.lineas) {
      if (!lineaCoincide(l, f)) continue;
      const clave = `${l.productoId}:${l.varianteId}`;
      const fila = filas.get(clave) ?? { clave, nombre: l.nombre, variante: l.variante, categoria: l.categoria, cantidad: 0, total: 0 };
      fila.cantidad += l.cantidad;
      fila.total += l.precio * l.cantidad;
      filas.set(clave, fila);
    }
  }
  return [...filas.values()].sort((a, b) => b.total - a.total);
}

export interface Resumen {
  ventas: number;
  total: number;
  ticketPromedio: number;
  unidades: number;
  cafes: number;
}

export function resumen(ventas: Venta[], f: Filtros): Resumen {
  let total = 0;
  let unidades = 0;
  let cafes = 0;
  for (const v of ventas) {
    total += importeFiltrado(v, f);
    for (const l of v.lineas) {
      if (!lineaCoincide(l, f)) continue;
      unidades += l.cantidad;
      if (l.esCafe) cafes += l.cantidad;
    }
  }
  return { ventas: ventas.length, total, ticketPromedio: ventas.length ? Math.round(total / ventas.length) : 0, unidades, cafes };
}

export function inicioDelDia(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function porDia(ventas: Venta[], f: Filtros): { dia: number; total: number; ventas: number }[] {
  const dias = new Map<number, { dia: number; total: number; ventas: number }>();
  for (let d = inicioDelDia(f.desde); d <= f.hasta; d = siguienteDia(d)) dias.set(d, { dia: d, total: 0, ventas: 0 });
  for (const v of ventas) {
    const fila = dias.get(inicioDelDia(v.fecha));
    if (!fila) continue;
    fila.total += importeFiltrado(v, f);
    fila.ventas += 1;
  }
  return [...dias.values()];
}

function siguienteDia(d: number): number {
  const x = new Date(d);
  x.setDate(x.getDate() + 1);
  return x.getTime();
}

export function porMedio(ventas: Venta[], f: Filtros): { medio: MedioPago; total: number }[] {
  const t = new Map<MedioPago, number>();
  for (const v of ventas) {
    const factor = v.total ? importeFiltrado(v, f) / v.total : 0;
    for (const p of v.pagos) {
      if (f.medios.length && !f.medios.includes(p.medio)) continue;
      const monto = f.medios.length ? p.monto : Math.round(p.monto * factor);
      t.set(p.medio, (t.get(p.medio) ?? 0) + monto);
    }
  }
  return [...t.entries()].map(([medio, total]) => ({ medio, total })).sort((a, b) => b.total - a.total);
}

/** Kilos de café que corresponden a lo vendido, según la receta de cada tamaño. */
export function kilosCafe(ventas: Venta[], f: Filtros, productos: Producto[], cafeInsumoId: string): number {
  const lineas = ventas.flatMap((v) => v.lineas.filter((l) => l.esCafe && lineaCoincide(l, f)));
  return consumo(lineas, productos).get(cafeInsumoId) ?? 0;
}

export function variacion(actual: number, anterior: number): number | null {
  if (!anterior) return null;
  return Math.round(((actual - anterior) / anterior) * 100);
}

// ---------- Importar desde Excel ----------

export interface FilaImportada {
  fila: number;
  producto: string;
  categoria: string;
  tamano: string;
  precio: number | null;
  accion: 'nuevo' | 'actualiza' | 'error';
  error: string | null;
}

function normalizar(s: unknown): string {
  return String(s ?? '').trim();
}

function clave(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

function leerPrecio(v: unknown): number | null {
  if (typeof v === 'number') return Math.round(v);
  const s = normalizar(v).replace(/[$\s]/g, '').replace(/\./g, '').replace(',', '.');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n) : null;
}

/** Busca la columna por su nombre, sin importar mayúsculas ni tildes. */
function columna(fila: Record<string, unknown>, ...nombres: string[]): unknown {
  for (const k of Object.keys(fila)) if (nombres.includes(clave(k))) return fila[k];
  return undefined;
}

/**
 * Revisa las filas de la planilla (Producto, Categoría, Tamaño, Precio) antes de importar.
 * Si el producto y el tamaño ya existen, se actualiza el precio; nunca se duplican.
 */
export function revisarImportacion(filas: Record<string, unknown>[], existentes: Producto[]): FilaImportada[] {
  return filas.map((f, i) => {
    const producto = normalizar(columna(f, 'producto', 'nombre'));
    const categoria = normalizar(columna(f, 'categoria'));
    const tamano = normalizar(columna(f, 'tamano', 'tamaño', 'variante', 'presentacion')) || 'Único';
    const precio = leerPrecio(columna(f, 'precio'));
    const base = { fila: i + 2, producto, categoria, tamano, precio };
    if (!producto) return { ...base, accion: 'error', error: 'Falta el nombre del producto' };
    if (precio === null || precio <= 0) return { ...base, accion: 'error', error: 'El precio está vacío o no es un número' };
    const p = existentes.find((x) => clave(x.nombre) === clave(producto));
    const existe = p?.variantes.some((v) => clave(v.nombre) === clave(tamano));
    if (!p && !categoria) return { ...base, accion: 'error', error: 'Producto nuevo sin categoría' };
    return { ...base, accion: existe ? 'actualiza' : 'nuevo', error: null };
  });
}

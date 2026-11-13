import { Injectable, computed, signal } from '@angular/core';
import { estadoInicial } from './datos-demo';
import {
  Ajustes, Billetes, CartaConfig, Cuenta, Estado, FormaMesa, Insumo, ItemCuenta, LineaVenta, MedioPago, ModoCobro, Producto,
  Proveedor, Turno, TurnoDef, Usuario, Venta,
} from './modelos';
import { aplicarAumento, consumo, FilaImportada, nombreItem, pendienteCuenta } from './reglas';

const CLAVE = 'cafe-demo-v1';
const CLAVE_SESION = 'cafe-demo-sesion';

export function nuevoId(prefijo: string): string {
  return `${prefijo}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

function leer<T>(clave: string): T | null {
  try {
    const s = localStorage.getItem(clave);
    return s ? (JSON.parse(s) as T) : null;
  } catch {
    return null;
  }
}

function escribir(clave: string, valor: unknown) {
  try {
    if (valor === null) localStorage.removeItem(clave);
    else localStorage.setItem(clave, JSON.stringify(valor));
  } catch {
    // Sin almacenamiento (ventana privada o lleno): la demo sigue andando en memoria.
  }
}

export interface PagoNuevo {
  monto: number;
  medio: MedioPago;
  modo: ModoCobro;
  personaId: string | null;
  quien: string;
  cubreCompartido: number;
  /** Ítems que quedan pagados (modo persona y productos); con cantidad para pagar parte de una línea. */
  items: { itemId: string; cantidad: number }[];
}

/**
 * Estado de la demo en el navegador. En el sistema real esta clase se reemplaza por una que habla con
 * Supabase; las pantallas no cambian.
 */
@Injectable({ providedIn: 'root' })
export class Tienda {
  private readonly _estado = signal<Estado>(migrar(leer<Estado>(CLAVE)) ?? estadoInicial());
  readonly estado = this._estado.asReadonly();

  private readonly _usuarioId = signal<string | null>(leer<string>(CLAVE_SESION));
  readonly usuario = computed(() => this._estado().usuarios.find((u) => u.id === this._usuarioId() && u.activo) ?? null);
  readonly esDuena = computed(() => this.usuario()?.rol === 'duena');

  readonly turnoAbierto = computed(() => this._estado().turnos.find((t) => !t.cerradoEn) ?? null);
  readonly productosActivos = computed(() => this._estado().productos.filter((p) => p.activo && p.dondeSeVende !== 'online'));

  private guardado: ReturnType<typeof setTimeout> | null = null;

  /** Aplica un cambio al estado y lo guarda en el navegador. */
  private mutar(fn: (e: Estado) => void) {
    const e = this._estado();
    fn(e);
    this._estado.set({ ...e });
    if (this.guardado) clearTimeout(this.guardado);
    this.guardado = setTimeout(() => escribir(CLAVE, this._estado()), 300);
  }

  // ---------- Sesión ----------

  ingresar(usuario: string, contrasena: string): Usuario | null {
    const u = this._estado().usuarios.find((x) => x.usuario.toLowerCase() === usuario.trim().toLowerCase() && x.contrasena === contrasena && x.activo);
    if (u) this.fijarSesion(u.id);
    return u ?? null;
  }

  /**
   * Recuperar la contraseña. En el sistema real, Supabase manda un email con un link para elegir una nueva;
   * en la demo solo se confirma si el usuario o el email existen.
   */
  pedirRecuperacion(usuarioOEmail: string): Usuario | null {
    const q = usuarioOEmail.trim().toLowerCase();
    return this._estado().usuarios.find((x) => x.activo && (x.usuario.toLowerCase() === q || x.email.toLowerCase() === q)) ?? null;
  }

  salir() {
    this.fijarSesion(null);
  }

  private fijarSesion(id: string | null) {
    this._usuarioId.set(id);
    escribir(CLAVE_SESION, id);
  }

  nombreUsuario(id: string | null): string {
    return this._estado().usuarios.find((u) => u.id === id)?.nombre ?? '—';
  }

  // ---------- Mesas y cuentas ----------

  cuentaDeMesa(mesaId: string): Cuenta | null {
    return this._estado().cuentas.find((c) => c.mesaId === mesaId) ?? null;
  }

  abrirMesa(mesaId: string, personas: number): Cuenta {
    const cuenta: Cuenta = {
      id: nuevoId('cu'), mesaId, abiertaEn: Date.now(), atiendeId: this.usuario()?.id ?? '', pidioCuenta: false, items: [], pagos: [],
      personas: Array.from({ length: Math.max(1, personas) }, (_, i) => ({ id: nuevoId('pe'), nombre: `Persona ${i + 1}` })),
    };
    this.mutar((e) => e.cuentas.push(cuenta));
    return cuenta;
  }

  private conCuenta(cuentaId: string, fn: (c: Cuenta, e: Estado) => void) {
    this.mutar((e) => {
      const c = e.cuentas.find((x) => x.id === cuentaId);
      if (c) fn(c, e);
    });
  }

  agregarItem(cuentaId: string, producto: Producto, varianteId: string, personaId: string | null) {
    const v = producto.variantes.find((x) => x.id === varianteId);
    if (!v) return;
    this.conCuenta(cuentaId, (c) => {
      const igual = c.items.find((i) => i.productoId === producto.id && i.varianteId === varianteId && i.personaId === personaId && !i.pagado);
      if (igual) {
        igual.cantidad += 1;
        igual.hora = Date.now();
        return;
      }
      c.items.push({
        id: nuevoId('it'), productoId: producto.id, varianteId, nombre: nombreItem(producto, v.nombre), categoria: producto.categoria,
        precio: v.precio, cantidad: 1, personaId, hora: Date.now(), pagado: false,
      });
    });
  }

  cambiarCantidad(cuentaId: string, itemId: string, delta: number) {
    this.conCuenta(cuentaId, (c) => {
      const i = c.items.find((x) => x.id === itemId);
      if (!i || i.pagado) return;
      i.cantidad += delta;
      if (i.cantidad <= 0) c.items = c.items.filter((x) => x.id !== itemId);
    });
  }

  asignarItem(cuentaId: string, itemId: string, personaId: string | null) {
    this.conCuenta(cuentaId, (c) => {
      const i = c.items.find((x) => x.id === itemId);
      if (!i || i.pagado) return;
      const igual = c.items.find((x) => x.id !== itemId && x.productoId === i.productoId && x.varianteId === i.varianteId && x.personaId === personaId && !x.pagado);
      if (igual) {
        igual.cantidad += i.cantidad;
        c.items = c.items.filter((x) => x.id !== itemId);
      } else {
        i.personaId = personaId;
      }
    });
  }

  agregarPersona(cuentaId: string): string {
    const id = nuevoId('pe');
    this.conCuenta(cuentaId, (c) => c.personas.push({ id, nombre: `Persona ${c.personas.length + 1}` }));
    return id;
  }

  renombrarPersona(cuentaId: string, personaId: string, nombre: string) {
    this.conCuenta(cuentaId, (c) => {
      const p = c.personas.find((x) => x.id === personaId);
      if (p && nombre.trim()) p.nombre = nombre.trim();
    });
  }

  quitarPersona(cuentaId: string, personaId: string) {
    this.conCuenta(cuentaId, (c) => {
      c.items.forEach((i) => { if (i.personaId === personaId && !i.pagado) i.personaId = null; });
      c.personas = c.personas.filter((p) => p.id !== personaId);
    });
  }

  marcarPidioCuenta(cuentaId: string, valor: boolean) {
    this.conCuenta(cuentaId, (c) => (c.pidioCuenta = valor));
  }

  moverCuenta(cuentaId: string, mesaDestinoId: string): boolean {
    if (this.cuentaDeMesa(mesaDestinoId)) return false;
    this.conCuenta(cuentaId, (c) => (c.mesaId = mesaDestinoId));
    return true;
  }

  cancelarMesa(cuentaId: string) {
    this.mutar((e) => (e.cuentas = e.cuentas.filter((c) => c.id !== cuentaId || c.items.length > 0 || c.pagos.length > 0)));
  }

  /** Registra un pago. Si con eso no falta nada, cierra la mesa y devuelve la venta. */
  cobrar(cuentaId: string, pago: PagoNuevo): Venta | null {
    let venta: Venta | null = null;
    this.mutar((e) => {
      const c = e.cuentas.find((x) => x.id === cuentaId);
      if (!c || pago.monto <= 0) return;
      for (const sel of pago.items) {
        const i = c.items.find((x) => x.id === sel.itemId);
        if (!i || i.pagado) continue;
        if (sel.cantidad < i.cantidad) {
          i.cantidad -= sel.cantidad;
          c.items.push({ ...i, id: nuevoId('it'), cantidad: sel.cantidad, pagado: true });
        } else {
          i.pagado = true;
        }
      }
      c.pagos.push({ id: nuevoId('pg'), monto: pago.monto, medio: pago.medio, modo: pago.modo, personaId: pago.personaId, quien: pago.quien, cubreCompartido: pago.cubreCompartido, hora: Date.now() });
      if (pendienteCuenta(c) === 0) {
        const mesa = e.mesas.find((m) => m.id === c.mesaId);
        venta = this.registrarVenta(e, {
          origen: 'mesa', mesa: mesa?.nombre ?? null, personas: c.personas.length, usuarioId: this.usuario()?.id ?? c.atiendeId,
          lineas: agruparLineas(c.items, e.productos),
          pagos: c.pagos.map((p) => ({ medio: p.medio, monto: p.monto, quien: p.quien })),
        });
        e.cuentas = e.cuentas.filter((x) => x.id !== cuentaId);
      }
    });
    return venta;
  }

  // ---------- Ventas ----------

  venderMostrador(lineas: LineaVenta[], pagos: { medio: MedioPago; monto: number }[]): Venta | null {
    let venta: Venta | null = null;
    this.mutar((e) => {
      venta = this.registrarVenta(e, { origen: 'mostrador', mesa: null, personas: 1, usuarioId: this.usuario()?.id ?? '', lineas, pagos: pagos.map((p) => ({ ...p, quien: '' })) });
    });
    return venta;
  }

  private registrarVenta(e: Estado, d: Pick<Venta, 'origen' | 'mesa' | 'personas' | 'usuarioId' | 'lineas' | 'pagos'>): Venta {
    const turno = e.turnos.find((t) => !t.cerradoEn);
    const venta: Venta = {
      ...d, id: nuevoId('v'), numero: e.proximoNumeroVenta++, fecha: Date.now(), turnoId: turno?.id ?? '',
      total: d.lineas.reduce((s, l) => s + l.precio * l.cantidad, 0), anulada: null,
    };
    e.ventas.push(venta);
    this.moverStock(e, d.lineas, -1, `Venta #${venta.numero}`);
    return venta;
  }

  private moverStock(e: Estado, lineas: LineaVenta[], signo: 1 | -1, detalle: string) {
    for (const [insumoId, cantidad] of consumo(lineas, e.productos)) {
      const i = e.insumos.find((x) => x.id === insumoId);
      if (!i) continue;
      i.stock = redondear(i.stock + signo * cantidad);
      e.movimientos.push({ id: nuevoId('ms'), insumoId, fecha: Date.now(), tipo: 'venta', cantidad: redondear(signo * cantidad), detalle });
    }
  }

  anularVenta(ventaId: string, motivo: string) {
    this.mutar((e) => {
      const v = e.ventas.find((x) => x.id === ventaId);
      if (!v || v.anulada) return;
      v.anulada = { motivo, porId: this.usuario()?.id ?? '', fecha: Date.now() };
      this.moverStock(e, v.lineas, 1, `Anulación venta #${v.numero}`);
    });
  }

  // ---------- Plano del salón ----------

  moverMesa(mesaId: string, x: number, y: number) {
    this.mutar((e) => {
      const m = e.mesas.find((z) => z.id === mesaId);
      if (m) Object.assign(m, { x, y });
    });
  }

  agregarMesa(salonId: string, forma: FormaMesa): string {
    const id = nuevoId('m');
    this.mutar((e) => {
      const tam = { cuadrada: [3, 3], doble: [6, 3], redonda: [3, 3], banqueta: [2, 2] }[forma];
      const numeros = e.mesas.map((m) => parseInt(m.nombre.replace(/\D/g, ''), 10)).filter((n) => !isNaN(n));
      const nombre = forma === 'banqueta' ? `B${e.mesas.filter((m) => m.forma === 'banqueta').length + 1}` : String(Math.max(0, ...numeros) + 1);
      e.mesas.push({ id, salonId, nombre, forma, x: 0, y: 0, w: tam[0], h: tam[1] });
    });
    return id;
  }

  editarMesa(mesaId: string, cambios: { nombre?: string; forma?: FormaMesa }) {
    this.mutar((e) => {
      const m = e.mesas.find((z) => z.id === mesaId);
      if (!m) return;
      if (cambios.nombre?.trim()) m.nombre = cambios.nombre.trim();
      if (cambios.forma && cambios.forma !== m.forma) {
        const tam = { cuadrada: [3, 3], doble: [6, 3], redonda: [3, 3], banqueta: [2, 2] }[cambios.forma];
        Object.assign(m, { forma: cambios.forma, w: tam[0], h: tam[1] });
      }
    });
  }

  quitarMesa(mesaId: string): boolean {
    if (this.cuentaDeMesa(mesaId)) return false;
    this.mutar((e) => (e.mesas = e.mesas.filter((m) => m.id !== mesaId)));
    return true;
  }

  agregarSalon(nombre: string): string {
    const id = nuevoId('s');
    this.mutar((e) => e.salones.push({ id, nombre: nombre.trim() || 'Nuevo salón' }));
    return id;
  }

  renombrarSalon(id: string, nombre: string) {
    this.mutar((e) => {
      const s = e.salones.find((x) => x.id === id);
      if (s && nombre.trim()) s.nombre = nombre.trim();
    });
  }

  // ---------- Productos ----------

  guardarProducto(p: Producto) {
    this.mutar((e) => {
      const i = e.productos.findIndex((x) => x.id === p.id);
      if (i >= 0) e.productos[i] = structuredClone(p);
      else e.productos.push(structuredClone(p));
      if (!e.categorias.includes(p.categoria)) e.categorias.push(p.categoria);
    });
  }

  cambiarActivo(productoId: string, activo: boolean) {
    this.mutar((e) => {
      const p = e.productos.find((x) => x.id === productoId);
      if (p) p.activo = activo;
    });
  }

  aumentarPrecios(porcentaje: number, categoria: string | null, redondeo: number): number {
    let cambiados = 0;
    this.mutar((e) => {
      for (const p of e.productos) {
        if (categoria && p.categoria !== categoria) continue;
        for (const v of p.variantes) {
          v.precio = aplicarAumento(v.precio, porcentaje, redondeo);
          cambiados++;
        }
      }
    });
    return cambiados;
  }

  importarProductos(filas: FilaImportada[]): { nuevos: number; actualizados: number } {
    let nuevos = 0;
    let actualizados = 0;
    const clave = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
    this.mutar((e) => {
      for (const f of filas) {
        if (f.accion === 'error' || f.precio === null) continue;
        let p = e.productos.find((x) => clave(x.nombre) === clave(f.producto));
        if (!p) {
          p = { id: nuevoId('p'), nombre: f.producto, categoria: f.categoria, descripcion: '', variantes: [], dondeSeVende: 'ambos', activo: true, esCafe: clave(f.categoria) === 'cafeteria' };
          e.productos.push(p);
          if (!e.categorias.includes(f.categoria)) e.categorias.push(f.categoria);
        }
        const v = p.variantes.find((x) => clave(x.nombre) === clave(f.tamano));
        if (v) {
          v.precio = f.precio;
          actualizados++;
        } else {
          p.variantes.push({ id: nuevoId('va'), nombre: f.tamano, precio: f.precio, receta: [] });
          nuevos++;
        }
      }
    });
    return { nuevos, actualizados };
  }

  // ---------- Inventario ----------

  guardarInsumo(i: Insumo) {
    this.mutar((e) => {
      const k = e.insumos.findIndex((x) => x.id === i.id);
      if (k >= 0) e.insumos[k] = { ...i };
      else e.insumos.push({ ...i });
    });
  }

  ajustarStock(insumoId: string, contado: number, motivo: string) {
    this.mutar((e) => {
      const i = e.insumos.find((x) => x.id === insumoId);
      if (!i) return;
      const diferencia = redondear(contado - i.stock);
      i.stock = redondear(contado);
      e.movimientos.push({ id: nuevoId('ms'), insumoId, fecha: Date.now(), tipo: 'ajuste', cantidad: diferencia, detalle: motivo || 'Conteo' });
    });
  }

  // ---------- Proveedores y compras ----------

  guardarProveedor(p: Proveedor) {
    this.mutar((e) => {
      const k = e.proveedores.findIndex((x) => x.id === p.id);
      if (k >= 0) e.proveedores[k] = structuredClone(p);
      else e.proveedores.push(structuredClone(p));
    });
  }

  saldoProveedor(proveedorId: string): number {
    return this._estado().compras.filter((c) => c.proveedorId === proveedorId).reduce((s, c) => s + c.total - c.pagos.reduce((a, p) => a + p.monto, 0), 0);
  }

  /** Carga una compra: suma al stock, actualiza el costo y el último precio del proveedor. */
  registrarCompra(proveedorId: string, items: { insumoId: string; cantidad: number; precio: number }[], pago: { monto: number; medio: MedioPago; deCaja: boolean }, comprobante: string) {
    this.mutar((e) => {
      const prov = e.proveedores.find((p) => p.id === proveedorId);
      const validos = items.filter((i) => i.cantidad > 0);
      const total = Math.round(validos.reduce((s, i) => s + i.cantidad * i.precio, 0));
      const compra = {
        id: nuevoId('c'), proveedorId, fecha: Date.now(), items: validos, total, comprobante,
        pagos: pago.monto > 0 ? [{ fecha: Date.now(), monto: Math.min(pago.monto, total), medio: pago.medio, deCaja: pago.deCaja }] : [],
      };
      e.compras.push(compra);
      for (const it of validos) {
        const ins = e.insumos.find((x) => x.id === it.insumoId);
        if (ins) {
          ins.stock = redondear(ins.stock + it.cantidad);
          ins.costo = it.precio;
        }
        e.movimientos.push({ id: nuevoId('ms'), insumoId: it.insumoId, fecha: Date.now(), tipo: 'compra', cantidad: it.cantidad, detalle: `Compra a ${prov?.nombre ?? 'proveedor'}` });
        if (prov) {
          const t = prov.trae.find((x) => x.insumoId === it.insumoId);
          if (t) t.ultimoPrecio = it.precio;
          else prov.trae.push({ insumoId: it.insumoId, ultimoPrecio: it.precio });
        }
      }
      if (pago.deCaja && pago.medio === 'efectivo' && pago.monto > 0) this.egresoDeCaja(e, Math.min(pago.monto, total), `Pago a ${prov?.nombre ?? 'proveedor'}`);
    });
  }

  pagarProveedor(proveedorId: string, monto: number, medio: MedioPago, deCaja: boolean) {
    this.mutar((e) => {
      let resta = monto;
      const prov = e.proveedores.find((p) => p.id === proveedorId);
      for (const c of e.compras.filter((x) => x.proveedorId === proveedorId).sort((a, b) => a.fecha - b.fecha)) {
        const debe = c.total - c.pagos.reduce((s, p) => s + p.monto, 0);
        if (debe <= 0 || resta <= 0) continue;
        const paga = Math.min(debe, resta);
        c.pagos.push({ fecha: Date.now(), monto: paga, medio, deCaja });
        resta -= paga;
      }
      if (deCaja && medio === 'efectivo') this.egresoDeCaja(e, monto - resta, `Pago a ${prov?.nombre ?? 'proveedor'}`);
    });
  }

  private egresoDeCaja(e: Estado, monto: number, motivo: string) {
    const t = e.turnos.find((x) => !x.cerradoEn);
    if (t && monto > 0) t.movimientos.push({ id: nuevoId('mv'), fecha: Date.now(), tipo: 'egreso', monto, motivo });
  }

  // ---------- Turnos y caja ----------

  abrirTurno(defId: string, empleadaIds: string[], efectivoInicial: number, billetesInicial?: Billetes): Turno | null {
    if (this.turnoAbierto()) return null;
    const t: Turno = {
      id: nuevoId('t'), defId, abiertoEn: Date.now(), cerradoEn: null, abiertoPorId: this.usuario()?.id ?? '', cerradoPorId: null,
      empleadaIds, efectivoInicial, billetesInicial, movimientos: [], arqueo: null,
    };
    this.mutar((e) => e.turnos.push(t));
    return t;
  }

  movimientoCaja(tipo: 'ingreso' | 'egreso', monto: number, motivo: string) {
    this.mutar((e) => {
      const t = e.turnos.find((x) => !x.cerradoEn);
      if (t && monto > 0) t.movimientos.push({ id: nuevoId('mv'), fecha: Date.now(), tipo, monto, motivo });
    });
  }

  cerrarTurno(contado: number, esperado: number, nota: string, billetes?: Billetes) {
    this.mutar((e) => {
      const t = e.turnos.find((x) => !x.cerradoEn);
      if (!t) return;
      t.cerradoEn = Date.now();
      t.cerradoPorId = this.usuario()?.id ?? null;
      t.arqueo = { contado, esperado, diferencia: contado - esperado, nota, billetes };
    });
  }

  guardarTurnoDefs(defs: TurnoDef[]) {
    this.mutar((e) => (e.turnoDefs = defs.map((d) => ({ ...d }))));
  }

  // ---------- Empleadas ----------

  guardarUsuario(u: Usuario) {
    this.mutar((e) => {
      const k = e.usuarios.findIndex((x) => x.id === u.id);
      if (k >= 0) e.usuarios[k] = structuredClone(u);
      else e.usuarios.push(structuredClone(u));
    });
  }

  usuarioLibre(nombre: string, exceptoId: string): boolean {
    return !this._estado().usuarios.some((u) => u.id !== exceptoId && u.usuario.toLowerCase() === nombre.trim().toLowerCase());
  }

  // ---------- Ajustes y copia de seguridad ----------

  guardarAjustes(a: Ajustes) {
    this.mutar((e) => (e.ajustes = structuredClone(a)));
  }

  guardarCarta(c: CartaConfig) {
    this.mutar((e) => (e.ajustes.carta = structuredClone(c)));
  }

  editarDescripcion(productoId: string, descripcion: string) {
    this.mutar((e) => {
      const p = e.productos.find((x) => x.id === productoId);
      if (p) p.descripcion = descripcion.trim();
    });
  }

  copiaDeSeguridad(): string {
    this.mutar((e) => (e.ajustes.copia.ultima = Date.now()));
    return JSON.stringify({ tipo: 'copia-cafeteria', creada: new Date().toISOString(), estado: this._estado() });
  }

  /** Restaura una copia. Devuelve un mensaje de error o null si salió bien. */
  restaurar(texto: string): string | null {
    try {
      const datos = JSON.parse(texto) as { tipo?: string; estado?: Estado };
      if (datos.tipo !== 'copia-cafeteria' || !datos.estado?.ventas) return 'Ese archivo no es una copia de este sistema.';
      const e = migrar(datos.estado)!;
      this._estado.set(e);
      escribir(CLAVE, e);
      return null;
    } catch {
      return 'No se pudo leer el archivo. Probá con otra copia.';
    }
  }

  reiniciarDemo() {
    const e = estadoInicial();
    this._estado.set(e);
    escribir(CLAVE, e);
  }
}

/** Completa lo que le falte a un estado guardado con una versión anterior de la demo. */
function migrar(e: Estado | null): Estado | null {
  if (!e) return null;
  const base = estadoInicial().ajustes;
  e.ajustes = { ...base, ...e.ajustes, carta: { ...base.carta, ...(e.ajustes.carta ?? {}) } };
  if (e.ajustes.nombreLocal === 'Café La Esquina') e.ajustes.nombreLocal = base.nombreLocal;
  for (const u of e.usuarios) if (u.email === undefined) u.email = '';
  return e;
}

function redondear(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Junta los ítems de la cuenta en líneas de venta (mismo producto y tamaño = una línea). */
function agruparLineas(items: ItemCuenta[], productos: Producto[]): LineaVenta[] {
  const lineas = new Map<string, LineaVenta>();
  for (const i of items) {
    const clave = `${i.productoId}:${i.varianteId}:${i.precio}`;
    const ya = lineas.get(clave);
    if (ya) {
      ya.cantidad += i.cantidad;
      continue;
    }
    const p = productos.find((x) => x.id === i.productoId);
    const v = p?.variantes.find((x) => x.id === i.varianteId);
    lineas.set(clave, {
      productoId: i.productoId, varianteId: i.varianteId, nombre: p?.nombre ?? i.nombre, variante: v?.nombre ?? '', categoria: i.categoria,
      esCafe: p?.esCafe ?? false, precio: i.precio, cantidad: i.cantidad,
    });
  }
  return [...lineas.values()];
}

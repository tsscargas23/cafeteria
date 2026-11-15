import { SupabaseClient } from '@supabase/supabase-js';
import {
  Ajustes, Compra, Cuenta, Estado, Insumo, Mesa, MovimientoStock, Producto, Proveedor, Salon, Turno, TurnoDef, Usuario, Venta,
} from './modelos';

/**
 * Puente entre el estado en memoria (el que usan las pantallas) y Supabase.
 *
 * - `cargar()` arma el Estado completo leyendo las tablas.
 * - `sincronizar(estado)` compara cada colección con lo último que se guardó y manda solo lo que cambió
 *   (alta, modificación o baja). Así las pantallas siguen igual que en la demo.
 * - Las ventas y las anulaciones NO pasan por acá: van por funciones de la base (registrar_venta, anular_venta),
 *   que validan permisos y mueven el stock en la misma transacción.
 */

const DIAS_DE_VENTAS = 400;
const PAGINA = 1000;

const ms = (t: string | null) => (t ? new Date(t).getTime() : null);
const iso = (t: number | null) => (t ? new Date(t).toISOString() : null);

type Fila = Record<string, unknown>;

// ---------- De la base al modelo ----------

const desde = {
  usuario: (f: Fila): Usuario => ({
    id: f['id'] as string, nombre: f['nombre'] as string, usuario: f['usuario'] as string, email: f['email'] as string,
    contrasena: '', rol: f['rol'] as Usuario['rol'], telefono: f['telefono'] as string, activo: f['activo'] as boolean,
    permisos: f['permisos'] as Usuario['permisos'],
  }),
  insumo: (f: Fila): Insumo => ({
    id: f['id'] as string, nombre: f['nombre'] as string, categoria: f['categoria'] as string, unidad: f['unidad'] as Insumo['unidad'],
    stock: Number(f['stock']), minimo: Number(f['minimo']), costo: Number(f['costo']),
  }),
  movimiento: (f: Fila): MovimientoStock => ({
    id: f['id'] as string, insumoId: f['insumo_id'] as string, fecha: ms(f['fecha'] as string)!, tipo: f['tipo'] as MovimientoStock['tipo'],
    cantidad: Number(f['cantidad']), detalle: f['detalle'] as string,
  }),
  proveedor: (f: Fila): Proveedor => ({
    id: f['id'] as string, nombre: f['nombre'] as string, contacto: f['contacto'] as string, telefono: f['telefono'] as string,
    diasEntrega: f['dias_entrega'] as string, notas: f['notas'] as string, trae: f['trae'] as Proveedor['trae'],
  }),
  compra: (f: Fila): Compra => ({
    id: f['id'] as string, proveedorId: f['proveedor_id'] as string, fecha: ms(f['fecha'] as string)!, items: f['items'] as Compra['items'],
    total: f['total'] as number, pagos: f['pagos'] as Compra['pagos'], comprobante: f['comprobante'] as string,
  }),
  salon: (f: Fila): Salon => ({ id: f['id'] as string, nombre: f['nombre'] as string }),
  mesa: (f: Fila): Mesa => ({
    id: f['id'] as string, salonId: f['salon_id'] as string, nombre: f['nombre'] as string, forma: f['forma'] as Mesa['forma'],
    x: f['x'] as number, y: f['y'] as number, w: f['w'] as number, h: f['h'] as number,
  }),
  cuenta: (f: Fila): Cuenta => ({
    id: f['id'] as string, mesaId: f['mesa_id'] as string, abiertaEn: ms(f['abierta_en'] as string)!, atiendeId: (f['atiende_id'] as string) ?? '',
    personas: f['personas'] as Cuenta['personas'], items: f['items'] as Cuenta['items'], pagos: f['pagos'] as Cuenta['pagos'],
    pidioCuenta: f['pidio_cuenta'] as boolean,
  }),
  turnoDef: (f: Fila): TurnoDef => ({ id: f['id'] as string, nombre: f['nombre'] as string, desde: f['desde'] as string, hasta: f['hasta'] as string }),
  turno: (f: Fila): Turno => ({
    id: f['id'] as string, defId: (f['def_id'] as string) ?? '', abiertoEn: ms(f['abierto_en'] as string)!, cerradoEn: ms(f['cerrado_en'] as string),
    abiertoPorId: (f['abierto_por_id'] as string) ?? '', cerradoPorId: (f['cerrado_por_id'] as string) ?? null,
    empleadaIds: (f['empleada_ids'] as string[]) ?? [], efectivoInicial: f['efectivo_inicial'] as number,
    billetesInicial: (f['billetes_inicial'] as Turno['billetesInicial']) ?? undefined,
    movimientos: f['movimientos'] as Turno['movimientos'], arqueo: (f['arqueo'] as Turno['arqueo']) ?? null,
  }),
  venta: (f: Fila): Venta => ({
    id: f['id'] as string, numero: f['numero'] as number, fecha: ms(f['fecha'] as string)!, origen: f['origen'] as Venta['origen'],
    mesa: (f['mesa'] as string) ?? null, usuarioId: (f['usuario_id'] as string) ?? '', turnoId: (f['turno_id'] as string) ?? '',
    lineas: f['lineas'] as Venta['lineas'], pagos: f['pagos'] as Venta['pagos'], total: f['total'] as number,
    personas: f['personas'] as number, anulada: (f['anulada'] as Venta['anulada']) ?? null,
  }),
  ajustes: (f: Fila): Ajustes => ({
    nombreLocal: f['nombre_local'] as string, direccion: f['direccion'] as string, telefono: f['telefono'] as string, alias: f['alias'] as string,
    mediosActivos: f['medios_activos'] as Ajustes['mediosActivos'], arqueoCiego: f['arqueo_ciego'] as boolean,
    copia: f['copia'] as Ajustes['copia'], carta: f['carta'] as Ajustes['carta'],
  }),
};

// ---------- Del modelo a la base ----------

const hacia = {
  usuarios: (u: Usuario): Fila => ({ id: u.id, nombre: u.nombre, usuario: u.usuario, email: u.email, rol: u.rol, telefono: u.telefono, permisos: u.permisos }),
  insumos: (i: Insumo): Fila => ({ id: i.id, nombre: i.nombre, categoria: i.categoria, unidad: i.unidad, stock: i.stock, minimo: i.minimo, costo: i.costo }),
  movimientos_stock: (m: MovimientoStock): Fila => ({ id: m.id, insumo_id: m.insumoId, fecha: iso(m.fecha), tipo: m.tipo, cantidad: m.cantidad, detalle: m.detalle }),
  proveedores: (p: Proveedor): Fila => ({ id: p.id, nombre: p.nombre, contacto: p.contacto, telefono: p.telefono, dias_entrega: p.diasEntrega, notas: p.notas, trae: p.trae }),
  compras: (c: Compra): Fila => ({ id: c.id, proveedor_id: c.proveedorId, fecha: iso(c.fecha), items: c.items, total: c.total, pagos: c.pagos, comprobante: c.comprobante }),
  salones: (s: Salon, i: number): Fila => ({ id: s.id, nombre: s.nombre, orden: i }),
  mesas: (m: Mesa): Fila => ({ id: m.id, salon_id: m.salonId, nombre: m.nombre, forma: m.forma, x: m.x, y: m.y, w: m.w, h: m.h }),
  cuentas: (c: Cuenta): Fila => ({
    id: c.id, mesa_id: c.mesaId, abierta_en: iso(c.abiertaEn), atiende_id: c.atiendeId || null, personas: c.personas, items: c.items,
    pagos: c.pagos, pidio_cuenta: c.pidioCuenta, actualizada_en: new Date().toISOString(),
  }),
  turno_defs: (d: TurnoDef, i: number): Fila => ({ id: d.id, nombre: d.nombre, desde: d.desde, hasta: d.hasta, orden: i }),
  turnos: (t: Turno): Fila => ({
    id: t.id, def_id: t.defId || null, abierto_en: iso(t.abiertoEn), cerrado_en: iso(t.cerradoEn), abierto_por_id: t.abiertoPorId || null,
    cerrado_por_id: t.cerradoPorId || null, empleada_ids: t.empleadaIds, efectivo_inicial: t.efectivoInicial,
    billetes_inicial: t.billetesInicial ?? null, movimientos: t.movimientos, arqueo: t.arqueo,
  }),
  ajustes: (a: Ajustes): Fila => ({
    id: 1, nombre_local: a.nombreLocal, direccion: a.direccion, telefono: a.telefono, alias: a.alias, medios_activos: a.mediosActivos,
    arqueo_ciego: a.arqueoCiego, copia: a.copia, carta: a.carta,
  }),
};

/** Qué colección del Estado va a qué tabla, en el orden en que hay que guardarlas (por las referencias entre tablas). */
type Coleccion = 'categorias' | 'productos' | 'insumos' | 'proveedores' | 'compras' | 'salones' | 'mesas' | 'turnoDefs' | 'turnos' | 'cuentas' | 'movimientos' | 'usuarios' | 'ajustes';

const TABLAS: { col: Coleccion; tabla: string; borra: boolean }[] = [
  { col: 'categorias', tabla: 'categorias', borra: false },
  { col: 'productos', tabla: 'productos', borra: false },
  { col: 'insumos', tabla: 'insumos', borra: true },
  { col: 'proveedores', tabla: 'proveedores', borra: true },
  { col: 'compras', tabla: 'compras', borra: false },
  { col: 'salones', tabla: 'salones', borra: true },
  { col: 'mesas', tabla: 'mesas', borra: true },
  { col: 'turnoDefs', tabla: 'turno_defs', borra: true },
  { col: 'turnos', tabla: 'turnos', borra: false },
  { col: 'cuentas', tabla: 'cuentas', borra: true },
  { col: 'movimientos', tabla: 'movimientos_stock', borra: false },
  { col: 'usuarios', tabla: 'usuarios', borra: false },
  { col: 'ajustes', tabla: 'ajustes', borra: false },
];

export class ErrorRemoto extends Error {}

export class Remoto {
  /** Última versión guardada de cada fila, para mandar solo lo que cambió. Clave: "tabla:id". */
  private guardado = new Map<string, string>();
  private cola: Promise<void> = Promise.resolve();
  private pendientes = 0;
  private canal: ReturnType<SupabaseClient['channel']> | null = null;

  constructor(private readonly sb: SupabaseClient, private readonly alError: (mensaje: string) => void) {}

  get ocupado() {
    return this.pendientes > 0;
  }

  // ---------- Cargar ----------

  private async todas(tabla: string, armar: (q: ReturnType<ReturnType<SupabaseClient['from']>['select']>) => typeof q = (q) => q): Promise<Fila[]> {
    const filas: Fila[] = [];
    for (let desdeFila = 0; ; desdeFila += PAGINA) {
      const { data, error } = await armar(this.sb.from(tabla).select('*')).range(desdeFila, desdeFila + PAGINA - 1);
      if (error) throw new ErrorRemoto(`No se pudo leer ${tabla}: ${error.message}`);
      filas.push(...(data as Fila[]));
      if (!data || data.length < PAGINA) return filas;
    }
  }

  async cargar(): Promise<Estado> {
    const hace = new Date(Date.now() - DIAS_DE_VENTAS * 86_400_000).toISOString();
    const [ajustes, usuarios, categorias, productos, variantes, insumos, movimientos, proveedores, compras, salones, mesas, cuentas, turnoDefs, turnos, ventas] =
      await Promise.all([
        this.todas('ajustes'),
        this.todas('usuarios'),
        this.todas('categorias', (q) => q.order('orden')),
        this.todas('productos', (q) => q.order('creado_en')),
        this.todas('variantes', (q) => q.order('orden')),
        this.todas('insumos', (q) => q.order('nombre')),
        this.todas('movimientos_stock', (q) => q.gte('fecha', new Date(Date.now() - 60 * 86_400_000).toISOString()).order('fecha')),
        this.todas('proveedores', (q) => q.order('nombre')),
        this.todas('compras', (q) => q.order('fecha')),
        this.todas('salones', (q) => q.order('orden')),
        this.todas('mesas'),
        this.todas('cuentas'),
        this.todas('turno_defs', (q) => q.order('orden')),
        this.todas('turnos', (q) => q.gte('abierto_en', hace).order('abierto_en')),
        this.todas('ventas', (q) => q.gte('fecha', hace).order('fecha')),
      ]);

    const estado: Estado = {
      version: 1,
      ajustes: ajustes[0] ? desde.ajustes(ajustes[0]) : estadoVacio().ajustes,
      usuarios: usuarios.map(desde.usuario),
      categorias: categorias.map((c) => c['nombre'] as string),
      productos: productos.map((p) => ({
        id: p['id'] as string, nombre: p['nombre'] as string, categoria: p['categoria'] as string, descripcion: p['descripcion'] as string,
        dondeSeVende: p['donde_se_vende'] as Producto['dondeSeVende'], activo: p['activo'] as boolean, esCafe: p['es_cafe'] as boolean,
        variantes: variantes.filter((v) => v['producto_id'] === p['id']).map((v) => ({
          id: v['id'] as string, nombre: v['nombre'] as string, precio: v['precio'] as number, receta: v['receta'] as Producto['variantes'][number]['receta'],
        })),
      })),
      insumos: insumos.map(desde.insumo),
      movimientos: movimientos.map(desde.movimiento),
      proveedores: proveedores.map(desde.proveedor),
      compras: compras.map(desde.compra),
      salones: salones.map(desde.salon),
      mesas: mesas.map(desde.mesa),
      cuentas: cuentas.map(desde.cuenta),
      turnoDefs: turnoDefs.map(desde.turnoDef),
      turnos: turnos.map(desde.turno),
      ventas: ventas.map(desde.venta),
      proximoNumeroVenta: Math.max(0, ...ventas.map((v) => v['numero'] as number)) + 1,
    };
    this.recordar(estado);
    return estado;
  }

  /** Marca todo el estado como "ya guardado" (después de cargar o de recargar una tabla). */
  recordar(e: Estado) {
    this.guardado.clear();
    for (const t of TABLAS) for (const [clave, json] of this.filas(e, t.col)) this.guardado.set(`${t.tabla}:${clave}`, json);
  }

  // ---------- Guardar lo que cambió ----------

  /** Filas (clave → JSON) de una colección, ya convertidas al formato de la tabla. */
  private filas(e: Estado, col: Coleccion): Map<string, string> {
    const m = new Map<string, string>();
    const poner = (clave: string, fila: unknown) => m.set(clave, JSON.stringify(fila));
    switch (col) {
      case 'categorias': e.categorias.forEach((c, i) => poner(c, { nombre: c, orden: i })); break;
      case 'productos':
        for (const p of e.productos) {
          poner(p.id, {
            id: p.id, nombre: p.nombre, categoria: p.categoria, descripcion: p.descripcion, donde_se_vende: p.dondeSeVende, activo: p.activo, es_cafe: p.esCafe,
            variantes: p.variantes.map((v, i) => ({ id: v.id, producto_id: p.id, nombre: v.nombre, precio: v.precio, receta: v.receta, orden: i })),
          });
        }
        break;
      case 'insumos': e.insumos.forEach((x) => poner(x.id, hacia.insumos(x))); break;
      case 'proveedores': e.proveedores.forEach((x) => poner(x.id, hacia.proveedores(x))); break;
      case 'compras': e.compras.forEach((x) => poner(x.id, hacia.compras(x))); break;
      case 'salones': e.salones.forEach((x, i) => poner(x.id, hacia.salones(x, i))); break;
      case 'mesas': e.mesas.forEach((x) => poner(x.id, hacia.mesas(x))); break;
      case 'turnoDefs': e.turnoDefs.forEach((x, i) => poner(x.id, hacia.turno_defs(x, i))); break;
      case 'turnos': e.turnos.forEach((x) => poner(x.id, hacia.turnos(x))); break;
      case 'cuentas': e.cuentas.forEach((x) => { const f = hacia.cuentas(x); delete f['actualizada_en']; poner(x.id, f); }); break;
      case 'movimientos': e.movimientos.forEach((x) => poner(x.id, hacia.movimientos_stock(x))); break;
      case 'usuarios': e.usuarios.forEach((x) => poner(x.id, hacia.usuarios(x))); break;
      case 'ajustes': poner('1', hacia.ajustes(e.ajustes)); break;
    }
    return m;
  }

  /** Compara el estado con lo último guardado y manda los cambios, en orden y de a uno por vez. */
  sincronizar(e: Estado) {
    const cambios: { tabla: string; col: Coleccion; altas: string[]; bajas: string[] }[] = [];
    for (const t of TABLAS) {
      const actuales = this.filas(e, t.col);
      const altas: string[] = [];
      for (const [clave, json] of actuales) if (this.guardado.get(`${t.tabla}:${clave}`) !== json) altas.push(json);
      const bajas: string[] = [];
      if (t.borra) {
        for (const k of this.guardado.keys()) {
          if (!k.startsWith(`${t.tabla}:`)) continue;
          const clave = k.slice(t.tabla.length + 1);
          if (!actuales.has(clave)) bajas.push(clave);
        }
      }
      if (altas.length || bajas.length) cambios.push({ tabla: t.tabla, col: t.col, altas, bajas });
      // Se marcan ya como guardados: si falla, se avisa y se recarga desde la base.
      for (const [clave, json] of actuales) this.guardado.set(`${t.tabla}:${clave}`, json);
      for (const clave of bajas) this.guardado.delete(`${t.tabla}:${clave}`);
    }
    if (!cambios.length) return;
    this.pendientes++;
    this.cola = this.cola
      .then(() => this.enviar(cambios))
      .catch((err: unknown) => this.alError(err instanceof Error ? err.message : 'No se pudo guardar el cambio.'))
      .finally(() => this.pendientes--);
  }

  private async enviar(cambios: { tabla: string; col: Coleccion; altas: string[]; bajas: string[] }[]) {
    for (const c of cambios) {
      const filas = c.altas.map((j) => JSON.parse(j) as Fila);
      if (c.col === 'productos') {
        const variantes = filas.flatMap((f) => f['variantes'] as Fila[]);
        const productos = filas.map(({ variantes: _v, ...resto }) => resto);
        await this.chequear(this.sb.from('productos').upsert(productos));
        if (variantes.length) await this.chequear(this.sb.from('variantes').upsert(variantes));
        // Tamaños que se sacaron de un producto.
        for (const p of filas) {
          const ids = (p['variantes'] as Fila[]).map((v) => v['id'] as string);
          let q = this.sb.from('variantes').delete().eq('producto_id', p['id'] as string);
          if (ids.length) q = q.not('id', 'in', `(${ids.join(',')})`);
          await this.chequear(q);
        }
      } else if (c.col === 'usuarios') {
        // Las cuentas nuevas se crean por la función "empleadas"; acá solo se actualizan datos y permisos.
        for (const f of filas) {
          const { id, ...resto } = f;
          await this.chequear(this.sb.from('usuarios').update(resto).eq('id', id as string));
        }
      } else if (c.col === 'ajustes') {
        const { id: _id, ...resto } = filas[0];
        await this.chequear(this.sb.from('ajustes').update(resto).eq('id', 1));
      } else if (filas.length) {
        const clave = c.col === 'categorias' ? 'nombre' : 'id';
        await this.chequear(this.sb.from(c.tabla).upsert(filas, { onConflict: clave }));
      }
      if (c.bajas.length) await this.chequear(this.sb.from(c.tabla).delete().in('id', c.bajas));
    }
  }

  private async chequear(q: PromiseLike<{ error: { message: string } | null }>) {
    const { error } = await q;
    if (error) throw new ErrorRemoto(traducir(error.message));
  }

  // ---------- Ventas (funciones de la base) ----------

  async registrarVenta(v: Venta, cuentaId: string | null): Promise<number> {
    // Primero terminan de guardarse los cambios en camino (por ejemplo, un pago parcial de esta mesa),
    // así no "reviven" la mesa después de que la base la libere.
    await this.cola.catch(() => undefined);
    const { data, error } = await this.sb.rpc('registrar_venta', {
      p: { id: v.id, origen: v.origen, mesa: v.mesa, personas: v.personas, lineas: v.lineas, pagos: v.pagos, cuentaId },
    });
    if (error) throw new ErrorRemoto(traducir(error.message));
    const fila = (data as { venta_numero: number }[])[0];
    if (cuentaId) this.guardado.delete(`cuentas:${cuentaId}`);
    return fila.venta_numero;
  }

  async anularVenta(id: string, motivo: string) {
    const { error } = await this.sb.rpc('anular_venta', { p_id: id, p_motivo: motivo });
    if (error) throw new ErrorRemoto(traducir(error.message));
  }

  /** Vuelve a leer insumos y movimientos (después de una venta, que los cambia en la base). */
  async recargarStock(): Promise<{ insumos: Insumo[]; movimientos: MovimientoStock[] }> {
    const [insumos, movimientos] = await Promise.all([
      this.todas('insumos', (q) => q.order('nombre')),
      this.todas('movimientos_stock', (q) => q.gte('fecha', new Date(Date.now() - 60 * 86_400_000).toISOString()).order('fecha')),
    ]);
    const r = { insumos: insumos.map(desde.insumo), movimientos: movimientos.map(desde.movimiento) };
    for (const i of insumos) this.guardado.set(`insumos:${i['id']}`, JSON.stringify(hacia.insumos(desde.insumo(i))));
    for (const m of movimientos) this.guardado.set(`movimientos_stock:${m['id']}`, JSON.stringify(hacia.movimientos_stock(desde.movimiento(m))));
    return r;
  }

  // ---------- Empleadas (función "empleadas") ----------

  async empleadas(cuerpo: Record<string, unknown>): Promise<{ id?: string }> {
    const { data, error } = await this.sb.functions.invoke('empleadas', { body: cuerpo });
    if (error) {
      let mensaje = 'No se pudo completar el pedido.';
      try {
        const detalle = await (error as { context?: Response }).context?.json();
        if (detalle?.error) mensaje = detalle.error;
      } catch { /* sin detalle */ }
      throw new ErrorRemoto(mensaje);
    }
    return data as { id?: string };
  }

  // ---------- Tiempo real ----------

  /** Escucha cambios de otros aparatos (mesas, caja, ventas) y avisa qué tabla recargar. */
  escuchar(alCambiar: (tabla: string, fila: Fila | null, borrada: boolean) => void) {
    this.canal?.unsubscribe();
    this.canal = this.sb.channel('panacota');
    for (const tabla of ['cuentas', 'mesas', 'turnos', 'ventas', 'insumos']) {
      this.canal.on('postgres_changes', { event: '*', schema: 'public', table: tabla }, (cambio) => {
        const borrada = cambio.eventType === 'DELETE';
        alCambiar(tabla, (borrada ? cambio.old : cambio.new) as Fila, borrada);
      });
    }
    this.canal.subscribe((estado) => {
      this.enVivo = estado === 'SUBSCRIBED';
      if (estado === 'CHANNEL_ERROR' || estado === 'TIMED_OUT') console.warn('[tiempo real]', estado);
    });
  }

  /** true si la suscripción de tiempo real está andando. Si no, la tienda refresca cada tanto. */
  enVivo = false;

  /** Lee de nuevo las mesas abiertas y la caja (respaldo cuando el tiempo real no está andando). */
  async refrescarSala(): Promise<{ cuentas: Cuenta[]; turnos: Turno[]; ventasNuevas: Venta[] } | null> {
    if (this.ocupado) return null;
    const hace = new Date(Date.now() - 2 * 86_400_000).toISOString();
    const [cuentas, turnos, ventas] = await Promise.all([
      this.todas('cuentas'),
      this.todas('turnos', (q) => q.gte('abierto_en', hace).order('abierto_en')),
      this.todas('ventas', (q) => q.gte('fecha', new Date(Date.now() - 86_400_000).toISOString()).order('fecha')),
    ]);
    if (this.ocupado) return null;
    const r = { cuentas: cuentas.map(desde.cuenta), turnos: turnos.map(desde.turno), ventasNuevas: ventas.map(desde.venta) };
    for (const c of r.cuentas) { const f = hacia.cuentas(c); delete f['actualizada_en']; this.guardado.set(`cuentas:${c.id}`, JSON.stringify(f)); }
    for (const k of [...this.guardado.keys()]) if (k.startsWith('cuentas:') && !r.cuentas.some((c) => `cuentas:${c.id}` === k)) this.guardado.delete(k);
    for (const t of r.turnos) this.guardado.set(`turnos:${t.id}`, JSON.stringify(hacia.turnos(t)));
    return r;
  }

  dejarDeEscuchar() {
    this.canal?.unsubscribe();
    this.canal = null;
  }

  /** Aplica un cambio que llegó de otro aparato, si no hay cambios propios en camino. */
  aplicarCambio(e: Estado, tabla: string, fila: Fila | null, borrada: boolean): boolean {
    if (!fila || this.ocupado) return false;
    const id = fila['id'] as string;
    const reemplazar = <T extends { id: string }>(lista: T[], nuevo: T | null) => {
      const resto = lista.filter((x) => x.id !== id);
      return nuevo ? [...resto, nuevo] : resto;
    };
    switch (tabla) {
      case 'cuentas':
        e.cuentas = reemplazar(e.cuentas, borrada ? null : desde.cuenta(fila));
        break;
      case 'mesas':
        e.mesas = reemplazar(e.mesas, borrada ? null : desde.mesa(fila));
        break;
      case 'turnos':
        e.turnos = reemplazar(e.turnos, borrada ? null : desde.turno(fila)).sort((a, b) => a.abiertoEn - b.abiertoEn);
        break;
      case 'ventas':
        if (!borrada) {
          const v = desde.venta(fila);
          e.ventas = reemplazar(e.ventas, v).sort((a, b) => a.fecha - b.fecha);
          e.proximoNumeroVenta = Math.max(e.proximoNumeroVenta, v.numero + 1);
        }
        break;
      case 'insumos':
        e.insumos = reemplazar(e.insumos, borrada ? null : desde.insumo(fila));
        break;
      default:
        return false;
    }
    // Lo que llegó de la base ya está guardado.
    const t = TABLAS.find((x) => x.tabla === tabla);
    if (t) for (const [clave, json] of this.filas(e, t.col)) if (clave === id) this.guardado.set(`${tabla}:${clave}`, json);
    if (borrada) this.guardado.delete(`${tabla}:${id}`);
    return true;
  }
}

/** Estado vacío para el sistema real antes de entrar (y si la base todavía no tiene datos). */
export function estadoVacio(): Estado {
  return {
    version: 1,
    ajustes: {
      nombreLocal: 'Panacota', direccion: '', telefono: '', alias: '', mediosActivos: ['efectivo', 'transferencia', 'mercadopago', 'debito', 'credito'],
      arqueoCiego: false, copia: { cadaDias: 7, email: '', ultima: null }, carta: { frase: '', aviso: '', ordenCategorias: [], ocultos: [] },
    },
    usuarios: [], categorias: [], productos: [], insumos: [], movimientos: [], proveedores: [], compras: [], salones: [], mesas: [],
    cuentas: [], ventas: [], turnoDefs: [], turnos: [], proximoNumeroVenta: 1,
  };
}

/** Mensajes de la base en castellano simple. */
export function traducir(m: string): string {
  if (/row-level security|permission denied|42501/i.test(m)) return 'No tenés permiso para hacer eso.';
  if (/JWT|session/i.test(m)) return 'La sesión se venció. Volvé a entrar.';
  if (/duplicate key/i.test(m)) return 'Eso ya existe (¿nombre repetido?).';
  if (/Failed to fetch|NetworkError/i.test(m)) return 'Sin conexión a internet. El cambio no se guardó.';
  if (/un_turno_abierto/i.test(m)) return 'Ya hay una caja abierta.';
  return m;
}

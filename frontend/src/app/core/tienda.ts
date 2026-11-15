import { Injectable, computed, inject, signal } from '@angular/core';
import { Avisos } from './avisos';
import { estadoInicial } from './datos-demo';
import {
  Ajustes, Billetes, CartaConfig, Cuenta, Estado, FormaMesa, Insumo, ItemCuenta, LineaVenta, MedioPago, ModoCobro, Producto,
  Proveedor, Turno, TurnoDef, Usuario, Venta,
} from './modelos';
import { aplicarAumento, consumo, FilaImportada, nombreItem, pendienteCuenta } from './reglas';
import { estadoVacio, Remoto, traducir } from './remoto';
import { Supabase } from './supabase';

const CLAVE = 'cafe-demo-v1';
const CLAVE_SESION = 'cafe-demo-sesion';

/** Identificador único. Es un UUID para que sirva igual en la demo y en la base real. */
export function nuevoId(_prefijo = ''): string {
  return crypto.randomUUID();
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

export interface ResultadoCobro {
  /** La venta, si el pago cerró la cuenta (o fue de mostrador). */
  venta: Venta | null;
  /** Mensaje si la base rechazó la venta. */
  error: string | null;
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
 * Estado que usan todas las pantallas.
 * - Demo (sin credenciales de Supabase): vive en el navegador (localStorage) con datos de ejemplo.
 * - Sistema real: se carga de Supabase al entrar y cada cambio se guarda solo (ver remoto.ts). Las ventas y las
 *   anulaciones pasan por funciones de la base; las cuentas de empleadas, por la función "empleadas".
 */
@Injectable({ providedIn: 'root' })
export class Tienda {
  private readonly sb = inject(Supabase).cliente;
  private readonly avisos = inject(Avisos);
  /** true = sistema real conectado a Supabase. */
  readonly real = this.sb !== null;
  private readonly remoto = this.sb ? new Remoto(this.sb, (m) => this.errorRemoto(m)) : null;

  private readonly _estado = signal<Estado>(this.real ? estadoVacio() : (migrar(leer<Estado>(CLAVE)) ?? estadoInicial()));
  readonly estado = this._estado.asReadonly();

  private readonly _usuarioId = signal<string | null>(this.real ? null : leer<string>(CLAVE_SESION));
  /** Se resuelve cuando ya se sabe si hay sesión y, si la hay, los datos están cargados. */
  readonly listo: Promise<void>;
  readonly cargando = signal(this.real);
  /** Al volver desde el link de "recuperar contraseña": hay que pedir la contraseña nueva. */
  readonly recuperando = signal(false);
  /** Email de la cuenta del link (se muestra para que quede claro a quién se le cambia la contraseña). */
  readonly emailRecuperando = signal('');
  /** Cuenta que Supabase validó con el link. La contraseña nueva solo se guarda si la sesión sigue siendo esa. */
  private idRecuperando: string | null = null;
  readonly usuario = computed(() => this._estado().usuarios.find((u) => u.id === this._usuarioId() && u.activo) ?? null);
  readonly esDuena = computed(() => this.usuario()?.rol === 'duena');

  readonly turnoAbierto = computed(() => this._estado().turnos.find((t) => !t.cerradoEn) ?? null);
  readonly productosActivos = computed(() => this._estado().productos.filter((p) => p.activo && p.dondeSeVende !== 'online'));

  private guardado: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.listo = this.real ? this.iniciarReal() : Promise.resolve();
  }

  /** Aplica un cambio al estado y lo guarda (en el navegador en la demo, en Supabase en el sistema real). */
  private mutar(fn: (e: Estado) => void) {
    const e = this._estado();
    fn(e);
    this._estado.set({ ...e });
    if (this.remoto) {
      this.remoto.sincronizar(this._estado());
      return;
    }
    if (this.guardado) clearTimeout(this.guardado);
    this.guardado = setTimeout(() => escribir(CLAVE, this._estado()), 300);
  }

  private errorRemoto(mensaje: string) {
    this.avisos.mostrar(`${traducir(mensaje)} Se recargaron los datos.`, 'error');
    void this.recargar();
  }

  // ---------- Sistema real: sesión y datos ----------

  private async iniciarReal() {
    const sb = this.sb!;
    // El link de "recuperar contraseña" vuelve con ?recuperar=1&code=...: hay que pedir la contraseña nueva.
    // Datos de la demo que pudieron quedar en este navegador: en el sistema real no se usan.
    escribir(CLAVE, null);
    escribir(CLAVE_SESION, null);
    const params = new URLSearchParams(location.search);
    // El modo "contraseña nueva" se activa SOLO cuando Supabase avisa que canjeó el link (PASSWORD_RECOVERY).
    // Con solo "?recuperar" en la dirección no alcanza: si el link venció o se abrió en otro aparato, la sesión que
    // queda es la que ya estaba abierta (por ejemplo la de la dueña) y se le cambiaría la contraseña a otra persona.
    let avisarLink: () => void = () => undefined;
    const linkCanjeado = new Promise<boolean>((resolver) => {
      avisarLink = () => resolver(true);
      setTimeout(() => resolver(false), 3000);
    });
    sb.auth.onAuthStateChange((evento, sesion) => {
      if (evento === 'PASSWORD_RECOVERY' && sesion) {
        this.idRecuperando = sesion.user.id;
        this.emailRecuperando.set(sesion.user.email ?? '');
        this.recuperando.set(true);
        avisarLink();
      }
      if (evento === 'SIGNED_OUT') {
        this.remoto!.dejarDeEscuchar();
        if (this.respaldo) clearInterval(this.respaldo);
        this._usuarioId.set(null);
        this._estado.set(estadoVacio());
      }
    });
    try {
      let { data } = await sb.auth.getSession();
      if (params.has('recuperar') && !(await linkCanjeado)) {
        this.avisos.mostrar('El link para cambiar la contraseña venció, ya se usó o se abrió en otro aparato. Pedí uno nuevo y abrilo desde este mismo aparato.', 'error');
      }
      if (params.has('recuperar')) ({ data } = await sb.auth.getSession());
      if (params.has('code') || params.has('recuperar')) history.replaceState(null, '', location.pathname + location.hash);
      if (data.session) await this.entrarCon(data.session.user.id);
    } catch {
      this.avisos.mostrar('No se pudo conectar con el sistema. Revisá internet y recargá la página.', 'error');
    } finally {
      this.cargando.set(false);
    }
  }

  private async entrarCon(id: string) {
    this.cargando.set(true);
    try {
      this._estado.set(await this.remoto!.cargar());
      this._usuarioId.set(id);
      this.remoto!.escuchar((tabla, fila, borrada) => {
        const e = this._estado();
        if (this.remoto!.aplicarCambio(e, tabla, fila, borrada)) this._estado.set({ ...e });
      });
      // Respaldo: si el tiempo real se corta (wifi del local), las mesas y la caja se refrescan cada 15 segundos.
      if (this.respaldo) clearInterval(this.respaldo);
      this.respaldo = setInterval(() => void this.refrescarSiHaceFalta(), 15_000);
    } finally {
      this.cargando.set(false);
    }
  }

  private respaldo: ReturnType<typeof setInterval> | null = null;

  private async refrescarSiHaceFalta() {
    if (!this.remoto || this.remoto.enVivo || document.visibilityState !== 'visible' || !this._usuarioId()) return;
    try {
      const r = await this.remoto.refrescarSala();
      if (!r) return;
      const e = this._estado();
      e.cuentas = r.cuentas;
      const viejos = e.turnos.filter((t) => !r.turnos.some((n) => n.id === t.id));
      e.turnos = [...viejos, ...r.turnos].sort((a, b) => a.abiertoEn - b.abiertoEn);
      for (const v of r.ventasNuevas) {
        const k = e.ventas.findIndex((x) => x.id === v.id);
        if (k >= 0) e.ventas[k] = v;
        else e.ventas.push(v);
        e.proximoNumeroVenta = Math.max(e.proximoNumeroVenta, v.numero + 1);
      }
      this._estado.set({ ...e });
    } catch {
      /* sin conexión: se intenta de nuevo en el próximo ciclo */
    }
  }

  /** Vuelve a leer todo de la base (después de un error o al pedirlo). */
  async recargar() {
    if (!this.remoto || !this._usuarioId()) return;
    try {
      this._estado.set(await this.remoto.cargar());
    } catch {
      /* el aviso ya se mostró */
    }
  }

  // ---------- Sesión ----------

  /** Entra con usuario (o email) y contraseña. Devuelve la persona, o un mensaje de error. */
  async ingresar(usuario: string, contrasena: string): Promise<Usuario | string> {
    if (!this.sb) {
      const u = this._estado().usuarios.find((x) => x.usuario.toLowerCase() === usuario.trim().toLowerCase() && x.contrasena === contrasena && x.activo);
      if (!u) return 'El usuario o la contraseña no coinciden. Revisalos y probá de nuevo.';
      this.fijarSesion(u.id);
      return u;
    }
    const generico = 'El usuario o la contraseña no coinciden. Revisalos y probá de nuevo.';
    let idUsuario: string;
    if (usuario.includes('@')) {
      // Con email, directo contra Supabase.
      const { data, error } = await this.sb.auth.signInWithPassword({ email: usuario.trim().toLowerCase(), password: contrasena });
      if (error || !data.user) return /rate|too many/i.test(error?.message ?? '') ? 'Demasiados intentos. Esperá unos minutos y probá de nuevo.' : generico;
      idUsuario = data.user.id;
    } else {
      // Con nombre de usuario, por la función "ingresar": busca el email en el servidor y devuelve solo la sesión.
      const { data, error } = await this.sb.functions.invoke('ingresar', { body: { usuario, contrasena } });
      if (error || !data?.access_token) {
        let mensaje = generico;
        try {
          const detalle = await (error as { context?: Response } | null)?.context?.json();
          if (detalle?.error) mensaje = detalle.error;
        } catch { /* sin detalle */ }
        return mensaje;
      }
      const { data: s, error: errSesion } = await this.sb.auth.setSession({ access_token: data.access_token, refresh_token: data.refresh_token });
      if (errSesion || !s.user) return generico;
      idUsuario = s.user.id;
    }
    try {
      await this.entrarCon(idUsuario);
    } catch {
      await this.sb.auth.signOut();
      return 'Entraste, pero no se pudieron cargar los datos. Revisá internet y probá de nuevo.';
    }
    const u = this.usuario();
    if (!u) {
      await this.sb.auth.signOut();
      return 'Esta cuenta no está habilitada en el sistema. Hablá con la dueña.';
    }
    return u;
  }

  /**
   * Recuperar la contraseña: Supabase manda un email con un link para elegir una nueva.
   * Se pide el email (no el usuario) y la respuesta es la misma exista o no la cuenta, para no revelar quién la tiene.
   */
  async pedirRecuperacion(email: string): Promise<void> {
    if (!this.sb) return;
    // Vuelve a la misma página; Supabase agrega "?code=..." y la app pide la contraseña nueva.
    await this.sb.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: `${location.origin}${location.pathname}?recuperar=1` });
  }

  /** Guarda la contraseña nueva después de entrar por el link del email. */
  async nuevaContrasena(contrasena: string): Promise<string | null> {
    if (!this.sb) return null;
    // Solo se cambia la contraseña de la cuenta que validó el link, nunca la de otra sesión que haya en el aparato.
    const { data: actual } = await this.sb.auth.getSession();
    if (!this.recuperando() || !this.idRecuperando || actual.session?.user.id !== this.idRecuperando) {
      return 'No se pudo guardar. El link puede haber vencido: pedí otro.';
    }
    const { error, data } = await this.sb.auth.updateUser({ password: contrasena });
    if (error) return /same|different/i.test(error.message) ? 'Tiene que ser distinta a la anterior.' : 'No se pudo guardar. El link puede haber vencido: pedí otro.';
    this.recuperando.set(false);
    this.idRecuperando = null;
    this.emailRecuperando.set('');
    if (data.user) await this.entrarCon(data.user.id);
    return null;
  }

  async salir() {
    if (this.sb) {
      await this.sb.auth.signOut();
      return;
    }
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

  /**
   * Registra un pago. Si con eso no falta nada, cierra la mesa y devuelve la venta.
   * En el sistema real, el pago que cierra la mesa se confirma primero con la base: si la base lo rechaza, la mesa
   * queda exactamente como estaba y se devuelve el error (nunca se pierde un pedido).
   */
  async cobrar(cuentaId: string, pago: PagoNuevo): Promise<ResultadoCobro> {
    const e = this._estado();
    const original = e.cuentas.find((x) => x.id === cuentaId);
    if (!original || pago.monto <= 0) return { venta: null, error: null };
    const c = structuredClone(original);
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

    // Pago parcial: la mesa sigue abierta con lo que falta.
    if (pendienteCuenta(c) > 0) {
      this.mutar((x) => {
        const k = x.cuentas.findIndex((y) => y.id === cuentaId);
        if (k >= 0) x.cuentas[k] = c;
      });
      return { venta: null, error: null };
    }

    const mesa = e.mesas.find((m) => m.id === c.mesaId);
    const venta = this.armarVenta(e, {
      origen: 'mesa', mesa: mesa?.nombre ?? null, personas: c.personas.length, usuarioId: this.usuario()?.id ?? c.atiendeId,
      lineas: agruparLineas(c.items, e.productos),
      pagos: c.pagos.map((p) => ({ medio: p.medio, monto: p.monto, quien: p.quien })),
    });
    const error = await this.confirmarVenta(venta, cuentaId);
    return error ? { venta: null, error } : { venta, error: null };
  }

  // ---------- Ventas ----------

  /** Venta de mostrador. En el sistema real se confirma con la base antes de darla por cobrada. */
  async venderMostrador(lineas: LineaVenta[], pagos: { medio: MedioPago; monto: number }[]): Promise<ResultadoCobro> {
    const venta = this.armarVenta(this._estado(), {
      origen: 'mostrador', mesa: null, personas: 1, usuarioId: this.usuario()?.id ?? '', lineas, pagos: pagos.map((p) => ({ ...p, quien: '' })),
    });
    const error = await this.confirmarVenta(venta, null);
    return error ? { venta: null, error } : { venta, error: null };
  }

  private armarVenta(e: Estado, d: Pick<Venta, 'origen' | 'mesa' | 'personas' | 'usuarioId' | 'lineas' | 'pagos'>): Venta {
    const turno = e.turnos.find((t) => !t.cerradoEn);
    return {
      ...d, id: nuevoId('v'), numero: e.proximoNumeroVenta, fecha: Date.now(), turnoId: turno?.id ?? '',
      total: d.lineas.reduce((s, l) => s + l.precio * l.cantidad, 0), anulada: null,
    };
  }

  /** Guarda la venta (y libera la mesa si corresponde). Devuelve un mensaje de error o null. */
  private async confirmarVenta(venta: Venta, cuentaId: string | null): Promise<string | null> {
    if (this.remoto) {
      try {
        venta.numero = await this.remoto.registrarVenta(venta, cuentaId);
      } catch (err) {
        return err instanceof Error ? err.message : 'No se pudo guardar la venta.';
      }
    }
    this.mutar((e) => {
      e.ventas.push(venta);
      e.proximoNumeroVenta = Math.max(e.proximoNumeroVenta, venta.numero + 1);
      if (cuentaId) e.cuentas = e.cuentas.filter((x) => x.id !== cuentaId);
      if (!this.remoto) this.moverStock(e, venta.lineas, -1, `Venta #${venta.numero}`);
    });
    if (this.remoto) void this.refrescarStock();
    return null;
  }

  /** Después de una venta o anulación, el stock lo cambió la base: se vuelve a leer. */
  private async refrescarStock() {
    try {
      const stock = await this.remoto!.recargarStock();
      const e = this._estado();
      e.insumos = stock.insumos;
      e.movimientos = stock.movimientos;
      this._estado.set({ ...e });
    } catch {
      /* se actualiza en la próxima recarga */
    }
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
    if (this.remoto) {
      void this.anularRemota(ventaId, motivo);
      return;
    }
    this.mutar((e) => {
      const v = e.ventas.find((x) => x.id === ventaId);
      if (!v || v.anulada) return;
      v.anulada = { motivo, porId: this.usuario()?.id ?? '', fecha: Date.now() };
      this.moverStock(e, v.lineas, 1, `Anulación venta #${v.numero}`);
    });
  }

  private async anularRemota(ventaId: string, motivo: string) {
    try {
      await this.remoto!.anularVenta(ventaId, motivo);
      const e = this._estado();
      const v = e.ventas.find((x) => x.id === ventaId);
      if (v) v.anulada = { motivo, porId: this.usuario()?.id ?? '', fecha: Date.now() };
      this._estado.set({ ...e });
      void this.refrescarStock();
    } catch (err) {
      this.errorRemoto(err instanceof Error ? err.message : 'No se pudo anular.');
    }
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

  /** Espera a que la base confirme los últimos cambios (abrir o cerrar la caja). false = la base los rechazó. */
  confirmarGuardado(): Promise<boolean> {
    return this.remoto ? this.remoto.esperarGuardado() : Promise.resolve(true);
  }

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

  /**
   * Crea o actualiza una persona. En el sistema real, las cuentas nuevas, las contraseñas, los emails y las bajas
   * pasan por la función "empleadas" (necesitan permisos que el navegador no tiene). Devuelve un error o null.
   */
  async guardarUsuario(u: Usuario): Promise<string | null> {
    if (!this.remoto) {
      this.mutar((e) => {
        const k = e.usuarios.findIndex((x) => x.id === u.id);
        if (k >= 0) e.usuarios[k] = structuredClone(u);
        else e.usuarios.push(structuredClone(u));
      });
      return null;
    }
    const anterior = this._estado().usuarios.find((x) => x.id === u.id);
    try {
      if (!anterior) {
        const r = await this.remoto.empleadas({ accion: 'crear', nombre: u.nombre, usuario: u.usuario, email: u.email, contrasena: u.contrasena, telefono: u.telefono, permisos: u.permisos });
        if (r.email && r.email !== u.email) {
          this.avisos.mostrar(`Ojo: se escribió «${u.email}», la función recibió «${r.enviado}» y Supabase guardó «${r.email}».`, 'info');
        }
        await this.recargar();
        return null;
      }
      if (u.contrasena) await this.remoto.empleadas({ accion: 'contrasena', id: u.id, contrasena: u.contrasena });
      if (u.email !== anterior.email) await this.remoto.empleadas({ accion: 'email', id: u.id, email: u.email });
      if (u.activo !== anterior.activo) await this.remoto.empleadas({ accion: u.activo ? 'activar' : 'desactivar', id: u.id });
      this.mutar((e) => {
        const k = e.usuarios.findIndex((x) => x.id === u.id);
        if (k >= 0) e.usuarios[k] = { ...structuredClone(u), contrasena: '' };
      });
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : 'No se pudo guardar.';
    }
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

  /** Insumo que se usa para calcular los kilos de café (el que se llama "café" y se mide en kilos). */
  insumoCafe(): Insumo | null {
    return this._estado().insumos.find((i) => i.unidad === 'kg' && /caf[eé]/i.test(i.nombre)) ?? null;
  }

  /** Restaura una copia. Devuelve un mensaje de error o null si salió bien. */
  restaurar(texto: string): string | null {
    if (this.real) return 'En el sistema real la restauración la hace el técnico desde la base de datos, para no pisar datos por error.';
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
    if (this.real) return;
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
      productoId: i.productoId, varianteId: i.varianteId, nombre: p?.nombre ?? i.nombre,
      // Igual que el mostrador y que la base: el tamaño solo se nombra si el producto tiene más de uno.
      variante: p && p.variantes.length > 1 ? (v?.nombre ?? '') : '', categoria: p?.categoria ?? i.categoria,
      esCafe: p?.esCafe ?? false, precio: i.precio, cantidad: i.cantidad,
    });
  }
  return [...lineas.values()];
}

/** Tipos del sistema. Los montos son pesos enteros; las fechas, milisegundos (Date.now()). */

export type Rol = 'duena' | 'empleada';

export interface Permisos {
  cobrar: boolean;
  anular: boolean;
  verReportes: boolean;
  editarProductos: boolean;
}

export interface Usuario {
  id: string;
  nombre: string;
  usuario: string;
  contrasena: string;
  pin: string;
  rol: Rol;
  telefono: string;
  activo: boolean;
  permisos: Permisos;
}

export type DondeSeVende = 'local' | 'online' | 'ambos';

export interface LineaReceta {
  insumoId: string;
  /** En la unidad del insumo: 0.014 kg de café, 0.15 L de leche, 1 unidad. */
  cantidad: number;
}

/** Tamaño o presentación de un producto (Jarrita, Chico, Porción, Docena...). */
export interface Variante {
  id: string;
  nombre: string;
  precio: number;
  receta: LineaReceta[];
}

export interface Producto {
  id: string;
  nombre: string;
  categoria: string;
  descripcion: string;
  variantes: Variante[];
  dondeSeVende: DondeSeVende;
  /** false = "Hoy no hay": no aparece para vender ni en la carta, pero no se borra. */
  activo: boolean;
  /** Cuenta como café para las estadísticas de cafés y kilos. */
  esCafe: boolean;
}

export type Unidad = 'kg' | 'L' | 'u';

export interface Insumo {
  id: string;
  nombre: string;
  categoria: string;
  unidad: Unidad;
  stock: number;
  minimo: number;
  /** Costo por unidad, de la última compra. */
  costo: number;
}

export type TipoMovimiento = 'compra' | 'venta' | 'ajuste';

export interface MovimientoStock {
  id: string;
  insumoId: string;
  fecha: number;
  tipo: TipoMovimiento;
  cantidad: number;
  detalle: string;
}

export interface ProductoProveedor {
  insumoId: string;
  ultimoPrecio: number;
}

export interface Proveedor {
  id: string;
  nombre: string;
  contacto: string;
  telefono: string;
  diasEntrega: string;
  notas: string;
  trae: ProductoProveedor[];
}

export interface ItemCompra {
  insumoId: string;
  cantidad: number;
  precio: number;
}

export interface PagoProveedor {
  fecha: number;
  monto: number;
  medio: MedioPago;
  deCaja: boolean;
}

export interface Compra {
  id: string;
  proveedorId: string;
  fecha: number;
  items: ItemCompra[];
  total: number;
  pagos: PagoProveedor[];
  comprobante: string;
}

export type MedioPago = 'efectivo' | 'transferencia' | 'mercadopago' | 'debito' | 'credito';

export const MEDIOS_PAGO: { id: MedioPago; nombre: string }[] = [
  { id: 'efectivo', nombre: 'Efectivo' },
  { id: 'transferencia', nombre: 'Transferencia' },
  { id: 'mercadopago', nombre: 'Mercado Pago' },
  { id: 'debito', nombre: 'Débito' },
  { id: 'credito', nombre: 'Crédito' },
];

export type FormaMesa = 'cuadrada' | 'doble' | 'redonda' | 'banqueta';

export interface Salon {
  id: string;
  nombre: string;
}

/** Posición y tamaño en celdas de la grilla del plano. */
export interface Mesa {
  id: string;
  salonId: string;
  nombre: string;
  forma: FormaMesa;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Persona {
  id: string;
  nombre: string;
}

export interface ItemCuenta {
  id: string;
  productoId: string;
  varianteId: string;
  nombre: string;
  categoria: string;
  precio: number;
  cantidad: number;
  /** null = es de toda la mesa (compartido). */
  personaId: string | null;
  hora: number;
  /** Se cobró con "Cada uno lo suyo" o "Elegir productos". */
  pagado: boolean;
}

export type ModoCobro = 'todo' | 'persona' | 'productos' | 'partes';

export interface PagoCuenta {
  id: string;
  monto: number;
  medio: MedioPago;
  modo: ModoCobro;
  /** Quién pagó, para que quede anotado. */
  personaId: string | null;
  quien: string;
  /** Parte de lo compartido que cubrió este pago (modo persona). */
  cubreCompartido: number;
  hora: number;
}

export interface Cuenta {
  id: string;
  mesaId: string;
  abiertaEn: number;
  atiendeId: string;
  personas: Persona[];
  items: ItemCuenta[];
  pagos: PagoCuenta[];
  pidioCuenta: boolean;
}

export type Origen = 'mesa' | 'mostrador';

export interface LineaVenta {
  productoId: string;
  varianteId: string;
  nombre: string;
  variante: string;
  categoria: string;
  esCafe: boolean;
  precio: number;
  cantidad: number;
}

export interface Anulacion {
  motivo: string;
  porId: string;
  fecha: number;
}

export interface Venta {
  id: string;
  numero: number;
  fecha: number;
  origen: Origen;
  mesa: string | null;
  usuarioId: string;
  turnoId: string;
  lineas: LineaVenta[];
  pagos: { medio: MedioPago; monto: number; quien: string }[];
  total: number;
  personas: number;
  anulada: Anulacion | null;
}

/** Turno de referencia que define la dueña (no corta a esa hora: es una guía). */
export interface TurnoDef {
  id: string;
  nombre: string;
  desde: string;
  hasta: string;
}

export interface MovimientoCaja {
  id: string;
  fecha: number;
  tipo: 'ingreso' | 'egreso';
  monto: number;
  motivo: string;
}

/** Cuántos billetes de cada valor hay (clave = valor del billete). */
export type Billetes = Record<string, number>;

export interface Arqueo {
  contado: number;
  esperado: number;
  diferencia: number;
  nota: string;
  billetes?: Billetes;
}

/** Un turno real de caja: dura desde que se abre hasta que se cierra. */
export interface Turno {
  id: string;
  defId: string;
  abiertoEn: number;
  cerradoEn: number | null;
  abiertoPorId: string;
  cerradoPorId: string | null;
  empleadaIds: string[];
  efectivoInicial: number;
  billetesInicial?: Billetes;
  movimientos: MovimientoCaja[];
  arqueo: Arqueo | null;
}

/** Cómo se muestra la carta pública (la del QR). */
export interface CartaConfig {
  frase: string;
  aviso: string;
  ordenCategorias: string[];
  /** Productos que no salen en la carta aunque estén activos. */
  ocultos: string[];
}

export interface Ajustes {
  nombreLocal: string;
  direccion: string;
  telefono: string;
  alias: string;
  mediosActivos: MedioPago[];
  arqueoCiego: boolean;
  copia: { cadaDias: number; email: string; ultima: number | null };
  carta: CartaConfig;
}

export interface Estado {
  version: number;
  ajustes: Ajustes;
  usuarios: Usuario[];
  categorias: string[];
  productos: Producto[];
  insumos: Insumo[];
  movimientos: MovimientoStock[];
  proveedores: Proveedor[];
  compras: Compra[];
  salones: Salon[];
  mesas: Mesa[];
  cuentas: Cuenta[];
  ventas: Venta[];
  turnoDefs: TurnoDef[];
  turnos: Turno[];
  proximoNumeroVenta: number;
}

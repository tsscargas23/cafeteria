import {
  Cuenta, Estado, Insumo, LineaVenta, MedioPago, Mesa, Producto, Proveedor, Turno, Usuario, Variante, Venta,
} from './modelos';
import { consumo, nombreItem } from './reglas';

/**
 * Datos de ejemplo para la demo: productos, mesas, empleadas y 70 días de ventas inventadas.
 * Se generan con una semilla fija, así la demo se ve igual cada vez que se reinicia.
 */

const DIAS_HISTORIA = 70;

function azar(semilla: number) {
  let s = semilla;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const todos = { cobrar: true, anular: true, verReportes: true, editarProductos: true };
const basicos = { cobrar: true, anular: false, verReportes: false, editarProductos: false };

const usuarios: Usuario[] = [
  { id: 'u-duena', nombre: 'Claudia', usuario: 'claudia', contrasena: 'cafe1234', pin: '1111', rol: 'duena', telefono: '11 5555-0101', activo: true, permisos: todos },
  { id: 'u-lucia', nombre: 'Lucía', usuario: 'lucia', contrasena: 'lucia123', pin: '2222', rol: 'empleada', telefono: '11 5555-0102', activo: true, permisos: basicos },
  { id: 'u-sofia', nombre: 'Sofía', usuario: 'sofia', contrasena: 'sofia123', pin: '3333', rol: 'empleada', telefono: '11 5555-0103', activo: true, permisos: basicos },
  { id: 'u-vale', nombre: 'Valentina', usuario: 'valentina', contrasena: 'vale1234', pin: '4444', rol: 'empleada', telefono: '11 5555-0104', activo: true, permisos: { ...basicos, anular: true } },
  { id: 'u-cami', nombre: 'Camila', usuario: 'camila', contrasena: 'cami1234', pin: '5555', rol: 'empleada', telefono: '11 5555-0105', activo: false, permisos: basicos },
];

const insumos: Insumo[] = [
  { id: 'i-cafe', nombre: 'Café en grano', categoria: 'Cafetería', unidad: 'kg', stock: 3.2, minimo: 4, costo: 28000 },
  { id: 'i-leche', nombre: 'Leche entera', categoria: 'Lácteos', unidad: 'L', stock: 22, minimo: 12, costo: 1450 },
  { id: 'i-vaso', nombre: 'Vasos para llevar', categoria: 'Descartables', unidad: 'u', stock: 180, minimo: 100, costo: 95 },
  { id: 'i-azucar', nombre: 'Sobres de azúcar', categoria: 'Almacén', unidad: 'u', stock: 640, minimo: 300, costo: 18 },
  { id: 'i-medialuna', nombre: 'Medialunas', categoria: 'Panadería', unidad: 'u', stock: 26, minimo: 24, costo: 520 },
  { id: 'i-factura', nombre: 'Facturas surtidas', categoria: 'Panadería', unidad: 'u', stock: 30, minimo: 24, costo: 560 },
  { id: 'i-pan', nombre: 'Pan de miga (planchas)', categoria: 'Panadería', unidad: 'u', stock: 8, minimo: 6, costo: 3800 },
  { id: 'i-jamon', nombre: 'Jamón cocido', categoria: 'Fiambres', unidad: 'kg', stock: 1.6, minimo: 1, costo: 14500 },
  { id: 'i-queso', nombre: 'Queso de máquina', categoria: 'Fiambres', unidad: 'kg', stock: 0.8, minimo: 1, costo: 12800 },
  { id: 'i-choco', nombre: 'Chocotorta (entera)', categoria: 'Pastelería', unidad: 'u', stock: 1.5, minimo: 1, costo: 16000 },
  { id: 'i-lemon', nombre: 'Lemon pie (entero)', categoria: 'Pastelería', unidad: 'u', stock: 0, minimo: 1, costo: 15000 },
  { id: 'i-naranja', nombre: 'Naranjas', categoria: 'Verdulería', unidad: 'kg', stock: 9, minimo: 5, costo: 1300 },
  { id: 'i-agua', nombre: 'Agua mineral 500 ml', categoria: 'Bebidas', unidad: 'u', stock: 36, minimo: 24, costo: 650 },
  { id: 'i-gaseosa', nombre: 'Gaseosa 500 ml', categoria: 'Bebidas', unidad: 'u', stock: 20, minimo: 24, costo: 1100 },
  { id: 'i-cerveza', nombre: 'Cerveza lata 473 ml', categoria: 'Bar', unidad: 'u', stock: 48, minimo: 24, costo: 1700 },
];

function v(id: string, nombre: string, precio: number, receta: Variante['receta'] = []): Variante {
  return { id, nombre, precio, receta };
}

const cafe = (g: number) => ({ insumoId: 'i-cafe', cantidad: g / 1000 });
const leche = (ml: number) => ({ insumoId: 'i-leche', cantidad: ml / 1000 });

const productos: Producto[] = [
  {
    id: 'p-cafe', nombre: 'Café', categoria: 'Cafetería', descripcion: 'Espresso de la casa.', dondeSeVende: 'ambos', activo: true, esCafe: true,
    variantes: [v('jarrita', 'Jarrita', 2100, [cafe(8)]), v('chico', 'Chico', 2500, [cafe(10)]), v('mediano', 'Mediano', 2800, [cafe(12.5)]), v('grande', 'Grande', 3300, [cafe(18)])],
  },
  {
    id: 'p-cortado', nombre: 'Cortado', categoria: 'Cafetería', descripcion: 'Café con un toque de leche.', dondeSeVende: 'ambos', activo: true, esCafe: true,
    variantes: [v('jarrita', 'Jarrita', 2200, [cafe(8), leche(30)]), v('chico', 'Chico', 2600, [cafe(10), leche(40)]), v('mediano', 'Mediano', 2900, [cafe(12.5), leche(50)]), v('grande', 'Grande', 3400, [cafe(18), leche(70)])],
  },
  {
    id: 'p-conleche', nombre: 'Café con leche', categoria: 'Cafetería', descripcion: '', dondeSeVende: 'ambos', activo: true, esCafe: true,
    variantes: [v('mediano', 'Mediano', 3000, [cafe(10), leche(150)]), v('grande', 'Grande', 3500, [cafe(14), leche(220)])],
  },
  {
    id: 'p-capu', nombre: 'Capuchino', categoria: 'Cafetería', descripcion: 'Con espuma de leche y canela.', dondeSeVende: 'ambos', activo: true, esCafe: true,
    variantes: [v('mediano', 'Mediano', 3800, [cafe(12.5), leche(150)]), v('grande', 'Grande', 4300, [cafe(18), leche(200)])],
  },
  {
    id: 'p-lagrima', nombre: 'Lágrima', categoria: 'Cafetería', descripcion: 'Leche con unas gotas de café.', dondeSeVende: 'local', activo: true, esCafe: true,
    variantes: [v('mediano', 'Mediano', 2900, [cafe(5), leche(180)])],
  },
  {
    id: 'p-medialuna', nombre: 'Medialuna', categoria: 'Panadería', descripcion: 'De manteca o de grasa.', dondeSeVende: 'ambos', activo: true, esCafe: false,
    variantes: [v('u', 'Unidad', 1100, [{ insumoId: 'i-medialuna', cantidad: 1 }]), v('docena', 'Docena', 12000, [{ insumoId: 'i-medialuna', cantidad: 12 }])],
  },
  {
    id: 'p-factura', nombre: 'Factura', categoria: 'Panadería', descripcion: 'Vigilantes, bolas de fraile, cañoncitos.', dondeSeVende: 'ambos', activo: true, esCafe: false,
    variantes: [v('u', 'Unidad', 1200, [{ insumoId: 'i-factura', cantidad: 1 }]), v('docena', 'Docena', 13000, [{ insumoId: 'i-factura', cantidad: 12 }])],
  },
  {
    id: 'p-tostado', nombre: 'Tostado de jamón y queso', categoria: 'Salados', descripcion: 'En pan de miga.', dondeSeVende: 'local', activo: true, esCafe: false,
    variantes: [v('u', 'Único', 6200, [{ insumoId: 'i-pan', cantidad: 0.25 }, { insumoId: 'i-jamon', cantidad: 0.05 }, { insumoId: 'i-queso', cantidad: 0.05 }])],
  },
  {
    id: 'p-choco', nombre: 'Chocotorta', categoria: 'Pastelería', descripcion: 'La clásica, con dulce de leche.', dondeSeVende: 'ambos', activo: true, esCafe: false,
    variantes: [v('porcion', 'Porción', 4800, [{ insumoId: 'i-choco', cantidad: 1 / 12 }]), v('entera', 'Entera (12 porciones)', 48000, [{ insumoId: 'i-choco', cantidad: 1 }])],
  },
  {
    id: 'p-lemon', nombre: 'Lemon pie', categoria: 'Pastelería', descripcion: 'Con merengue italiano.', dondeSeVende: 'ambos', activo: false, esCafe: false,
    variantes: [v('porcion', 'Porción', 4600, [{ insumoId: 'i-lemon', cantidad: 1 / 10 }]), v('entera', 'Entera (10 porciones)', 42000, [{ insumoId: 'i-lemon', cantidad: 1 }])],
  },
  {
    id: 'p-budin', nombre: 'Budín de limón', categoria: 'Pastelería', descripcion: '', dondeSeVende: 'ambos', activo: true, esCafe: false,
    variantes: [v('porcion', 'Porción', 2600)],
  },
  {
    id: 'p-exprimido', nombre: 'Jugo de naranja exprimido', categoria: 'Bebidas', descripcion: '', dondeSeVende: 'local', activo: true, esCafe: false,
    variantes: [v('u', 'Vaso', 4200, [{ insumoId: 'i-naranja', cantidad: 0.5 }])],
  },
  {
    id: 'p-agua', nombre: 'Agua mineral', categoria: 'Bebidas', descripcion: '500 ml, con o sin gas.', dondeSeVende: 'ambos', activo: true, esCafe: false,
    variantes: [v('u', '500 ml', 1800, [{ insumoId: 'i-agua', cantidad: 1 }])],
  },
  {
    id: 'p-gaseosa', nombre: 'Gaseosa', categoria: 'Bebidas', descripcion: '500 ml.', dondeSeVende: 'ambos', activo: true, esCafe: false,
    variantes: [v('u', '500 ml', 2500, [{ insumoId: 'i-gaseosa', cantidad: 1 }])],
  },
  {
    id: 'p-cerveza', nombre: 'Cerveza', categoria: 'Bar', descripcion: 'Lata 473 ml.', dondeSeVende: 'local', activo: true, esCafe: false,
    variantes: [v('u', 'Lata', 4500, [{ insumoId: 'i-cerveza', cantidad: 1 }])],
  },
  {
    id: 'p-fernet', nombre: 'Fernet con cola', categoria: 'Bar', descripcion: '', dondeSeVende: 'local', activo: true, esCafe: false,
    variantes: [v('u', 'Vaso', 6500)],
  },
  {
    id: 'p-picada', nombre: 'Picada para dos', categoria: 'Bar', descripcion: 'Fiambres, quesos y pan.', dondeSeVende: 'local', activo: true, esCafe: false,
    variantes: [v('u', 'Para dos', 14000)],
  },
];

const proveedores: Proveedor[] = [
  { id: 'pr-tostadero', nombre: 'Tostadero Don Julio', contacto: 'Julio', telefono: '11 4444-1001', diasEntrega: 'Lunes y jueves', notas: 'Pedir el miércoles para el jueves.', trae: [{ insumoId: 'i-cafe', ultimoPrecio: 28000 }] },
  { id: 'pr-lacteos', nombre: 'Lácteos La Vaquita', contacto: 'Marcela', telefono: '11 4444-1002', diasEntrega: 'Todos los días', notas: '', trae: [{ insumoId: 'i-leche', ultimoPrecio: 1450 }, { insumoId: 'i-queso', ultimoPrecio: 12800 }] },
  { id: 'pr-panaderia', nombre: 'Panadería El Molino', contacto: 'Roberto', telefono: '11 4444-1003', diasEntrega: 'Todos los días, 6:30', notas: 'Se paga en efectivo al recibir.', trae: [{ insumoId: 'i-medialuna', ultimoPrecio: 520 }, { insumoId: 'i-factura', ultimoPrecio: 560 }, { insumoId: 'i-pan', ultimoPrecio: 3800 }] },
  { id: 'pr-distri', nombre: 'Distribuidora Norte', contacto: 'Gustavo', telefono: '11 4444-1004', diasEntrega: 'Martes', notas: '', trae: [{ insumoId: 'i-agua', ultimoPrecio: 650 }, { insumoId: 'i-gaseosa', ultimoPrecio: 1100 }, { insumoId: 'i-cerveza', ultimoPrecio: 1700 }, { insumoId: 'i-vaso', ultimoPrecio: 95 }, { insumoId: 'i-azucar', ultimoPrecio: 18 }] },
  { id: 'pr-tortas', nombre: 'Dulces de Ana', contacto: 'Ana', telefono: '11 4444-1005', diasEntrega: 'Por encargo', notas: 'Avisar con 2 días.', trae: [{ insumoId: 'i-choco', ultimoPrecio: 16000 }, { insumoId: 'i-lemon', ultimoPrecio: 15000 }] },
];

const mesas: Mesa[] = [
  { id: 'm1', salonId: 's-adentro', nombre: '1', forma: 'cuadrada', x: 2, y: 2, w: 3, h: 3 },
  { id: 'm2', salonId: 's-adentro', nombre: '2', forma: 'doble', x: 7, y: 2, w: 6, h: 3 },
  { id: 'm3', salonId: 's-adentro', nombre: '3', forma: 'cuadrada', x: 15, y: 2, w: 3, h: 3 },
  { id: 'm4', salonId: 's-adentro', nombre: '4', forma: 'redonda', x: 2, y: 8, w: 3, h: 3 },
  { id: 'm5', salonId: 's-adentro', nombre: '5', forma: 'cuadrada', x: 7, y: 8, w: 3, h: 3 },
  { id: 'm6', salonId: 's-adentro', nombre: '6', forma: 'doble', x: 12, y: 8, w: 6, h: 3 },
  { id: 'm7', salonId: 's-vereda', nombre: '7', forma: 'redonda', x: 2, y: 3, w: 3, h: 3 },
  { id: 'm8', salonId: 's-vereda', nombre: '8', forma: 'redonda', x: 7, y: 3, w: 3, h: 3 },
  { id: 'm9', salonId: 's-vereda', nombre: '9', forma: 'redonda', x: 12, y: 3, w: 3, h: 3 },
  { id: 'm10', salonId: 's-vereda', nombre: '10', forma: 'cuadrada', x: 2, y: 9, w: 3, h: 3 },
  { id: 'm11', salonId: 's-vereda', nombre: '11', forma: 'cuadrada', x: 7, y: 9, w: 3, h: 3 },
  { id: 'm12', salonId: 's-vereda', nombre: '12', forma: 'doble', x: 12, y: 9, w: 6, h: 3 },
  { id: 'b1', salonId: 's-barra', nombre: 'B1', forma: 'banqueta', x: 3, y: 4, w: 2, h: 2 },
  { id: 'b2', salonId: 's-barra', nombre: 'B2', forma: 'banqueta', x: 6, y: 4, w: 2, h: 2 },
  { id: 'b3', salonId: 's-barra', nombre: 'B3', forma: 'banqueta', x: 9, y: 4, w: 2, h: 2 },
  { id: 'b4', salonId: 's-barra', nombre: 'B4', forma: 'banqueta', x: 12, y: 4, w: 2, h: 2 },
];

/** Qué se pide y con qué frecuencia relativa (peso). */
const PEDIDOS: { productoId: string; varianteId: string; peso: number; tarde?: boolean }[] = [
  { productoId: 'p-cafe', varianteId: 'jarrita', peso: 7 },
  { productoId: 'p-cafe', varianteId: 'chico', peso: 9 },
  { productoId: 'p-cafe', varianteId: 'mediano', peso: 8 },
  { productoId: 'p-cafe', varianteId: 'grande', peso: 4 },
  { productoId: 'p-cortado', varianteId: 'jarrita', peso: 5 },
  { productoId: 'p-cortado', varianteId: 'chico', peso: 6 },
  { productoId: 'p-cortado', varianteId: 'mediano', peso: 4 },
  { productoId: 'p-cortado', varianteId: 'grande', peso: 2 },
  { productoId: 'p-conleche', varianteId: 'mediano', peso: 6 },
  { productoId: 'p-conleche', varianteId: 'grande', peso: 3 },
  { productoId: 'p-capu', varianteId: 'mediano', peso: 3 },
  { productoId: 'p-capu', varianteId: 'grande', peso: 1 },
  { productoId: 'p-lagrima', varianteId: 'mediano', peso: 2 },
  { productoId: 'p-medialuna', varianteId: 'u', peso: 14 },
  { productoId: 'p-factura', varianteId: 'u', peso: 6 },
  { productoId: 'p-medialuna', varianteId: 'docena', peso: 1 },
  { productoId: 'p-tostado', varianteId: 'u', peso: 4 },
  { productoId: 'p-choco', varianteId: 'porcion', peso: 3, tarde: true },
  { productoId: 'p-lemon', varianteId: 'porcion', peso: 2, tarde: true },
  { productoId: 'p-budin', varianteId: 'porcion', peso: 2, tarde: true },
  { productoId: 'p-exprimido', varianteId: 'u', peso: 2 },
  { productoId: 'p-agua', varianteId: 'u', peso: 3 },
  { productoId: 'p-gaseosa', varianteId: 'u', peso: 2 },
  { productoId: 'p-cerveza', varianteId: 'u', peso: 1, tarde: true },
];

function lineaDe(productoId: string, varianteId: string, cantidad: number): LineaVenta {
  const p = productos.find((x) => x.id === productoId)!;
  const vv = p.variantes.find((x) => x.id === varianteId)!;
  return {
    productoId, varianteId, nombre: p.nombre, variante: vv.nombre, categoria: p.categoria, esCafe: p.esCafe,
    precio: vv.precio, cantidad,
  };
}

function elegir<T extends { peso: number }>(r: () => number, lista: T[]): T {
  const total = lista.reduce((s, x) => s + x.peso, 0);
  let x = r() * total;
  for (const e of lista) {
    x -= e.peso;
    if (x <= 0) return e;
  }
  return lista[lista.length - 1];
}

function medio(r: () => number): MedioPago {
  const x = r();
  if (x < 0.42) return 'efectivo';
  if (x < 0.66) return 'mercadopago';
  if (x < 0.86) return 'transferencia';
  if (x < 0.96) return 'debito';
  return 'credito';
}

function inicioDia(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function aHora(dia: Date, h: number, m: number): number {
  const d = new Date(dia);
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

export function estadoInicial(ahora = Date.now()): Estado {
  const r = azar(20261106);
  const ventas: Venta[] = [];
  const turnos: Turno[] = [];
  let numero = 1;
  const empleadasManana = ['u-lucia', 'u-sofia'];
  const empleadasTarde = ['u-vale', 'u-sofia'];
  const mesasNombres = mesas.filter((m) => m.salonId !== 's-barra').map((m) => m.nombre);

  for (let d = DIAS_HISTORIA; d >= 0; d--) {
    const dia = new Date(ahora);
    dia.setDate(dia.getDate() - d);
    dia.setHours(0, 0, 0, 0);
    const finde = dia.getDay() === 0 || dia.getDay() === 6;
    if (dia.getDay() === 1 && d !== 0) continue; // los lunes cierra

    const defs = [
      { defId: 'td-manana', desde: [7, Math.floor(r() * 10)], hasta: [14, Math.floor(r() * 50)], equipo: empleadasManana },
      { defId: 'td-tarde', desde: [14, 30 + Math.floor(r() * 25)], hasta: [21, Math.floor(r() * 55)], equipo: empleadasTarde },
    ];
    for (const def of defs) {
      const abiertoEn = aHora(dia, def.desde[0], def.desde[1]);
      if (abiertoEn > ahora) break;
      const finPrevisto = aHora(dia, def.hasta[0], def.hasta[1]);
      const abierto = d === 0 && finPrevisto > ahora;
      const turno: Turno = {
        id: `t-${dia.getTime()}-${def.defId}`, defId: def.defId, abiertoEn, cerradoEn: abierto ? null : finPrevisto,
        abiertoPorId: def.equipo[0], cerradoPorId: abierto ? null : def.equipo[0], empleadaIds: [...def.equipo],
        efectivoInicial: 20000, movimientos: [], arqueo: null,
      };
      if (r() < 0.3) turno.movimientos.push({ id: `mv-${turno.id}`, fecha: abiertoEn + 3600_000, tipo: 'egreso', monto: 3000 + Math.round(r() * 8) * 500, motivo: r() < 0.5 ? 'Hielo y limones' : 'Artículos de limpieza' });
      turnos.push(turno);

      const fin = abierto ? ahora : finPrevisto;
      const base = def.defId === 'td-manana' ? 34 : 26;
      const cantidad = Math.round(base * (finde ? 1.35 : 1) * (0.85 + r() * 0.3) * ((fin - abiertoEn) / (finPrevisto - abiertoEn || 1)));
      for (let i = 0; i < cantidad; i++) {
        const fecha = abiertoEn + Math.floor(r() * (fin - abiertoEn));
        const hora = new Date(fecha).getHours();
        const esMesa = r() < 0.7;
        const personas = esMesa ? 1 + Math.floor(r() * (finde ? 4 : 3)) : 1;
        const opciones = PEDIDOS.filter((p) => !p.tarde || hora >= 15).filter((p) => p.productoId !== 'p-lemon' || d > 0);
        const lineas: LineaVenta[] = [];
        const nItems = personas + Math.floor(r() * (personas + 1));
        for (let k = 0; k < nItems; k++) {
          const p = elegir(r, opciones);
          const cant = p.productoId === 'p-medialuna' && p.varianteId === 'u' ? 1 + Math.floor(r() * 3) : 1;
          const ya = lineas.find((l) => l.productoId === p.productoId && l.varianteId === p.varianteId);
          if (ya) ya.cantidad += cant;
          else lineas.push(lineaDe(p.productoId, p.varianteId, cant));
        }
        const total = lineas.reduce((s, l) => s + l.precio * l.cantidad, 0);
        const pagos = personas > 1 && r() < 0.35
          ? [{ medio: medio(r), monto: Math.floor(total / 2), quien: 'Persona 1' }, { medio: medio(r), monto: total - Math.floor(total / 2), quien: 'Persona 2' }]
          : [{ medio: medio(r), monto: total, quien: '' }];
        const usuarioId = def.equipo[Math.floor(r() * def.equipo.length)];
        ventas.push({
          id: `v-${numero}`, numero, fecha, origen: esMesa ? 'mesa' : 'mostrador',
          mesa: esMesa ? mesasNombres[Math.floor(r() * mesasNombres.length)] : null,
          usuarioId, turnoId: turno.id, lineas, pagos, total, personas, anulada: null,
        });
        numero++;
      }
    }
  }
  ventas.sort((a, b) => a.fecha - b.fecha);
  ventas.forEach((x, i) => { x.numero = i + 1; x.id = `v-${i + 1}`; });

  // Una anulación de ejemplo, para mostrar que no se borra nada.
  const anular = ventas[ventas.length - 40];
  if (anular) anular.anulada = { motivo: 'Se cargó dos veces', porId: 'u-duena', fecha: anular.fecha + 600_000 };

  // Arqueos de los turnos cerrados (con alguna diferencia chica de vez en cuando).
  for (const t of turnos.filter((x) => x.cerradoEn)) {
    const efectivo = ventas.filter((x) => x.turnoId === t.id && !x.anulada).flatMap((x) => x.pagos).filter((p) => p.medio === 'efectivo').reduce((s, p) => s + p.monto, 0);
    const esperado = t.efectivoInicial + efectivo + t.movimientos.reduce((s, m) => s + (m.tipo === 'ingreso' ? m.monto : -m.monto), 0);
    const diferencia = r() < 0.15 ? -Math.round(r() * 6) * 500 : 0;
    t.arqueo = { contado: esperado + diferencia, esperado, diferencia, nota: diferencia ? 'Faltó cambio' : '' };
  }

  // La demo siempre arranca con un turno abierto. Si ya pasó el horario, el último turno de hoy sigue abierto
  // (así se ve que el turno no corta solo a una hora fija); si hoy no hubo turnos, se abre uno hace 2 horas.
  if (!turnos.some((t) => !t.cerradoEn)) {
    const ultimo = turnos[turnos.length - 1];
    if (ultimo && inicioDia(ultimo.abiertoEn) === inicioDia(ahora)) {
      Object.assign(ultimo, { cerradoEn: null, cerradoPorId: null, arqueo: null });
    } else {
      const h = new Date(ahora).getHours();
      turnos.push({
        id: `t-${ahora}`, defId: h < 14 ? 'td-manana' : 'td-tarde', abiertoEn: ahora - 2 * 3600_000, cerradoEn: null, abiertoPorId: 'u-lucia',
        cerradoPorId: null, empleadaIds: ['u-lucia', 'u-sofia'], efectivoInicial: 20000, movimientos: [], arqueo: null,
      });
    }
  }
  const turnoAbierto = turnos.find((t) => !t.cerradoEn) ?? null;
  const cuentas: Cuenta[] = turnoAbierto ? cuentasAbiertas(ahora, turnoAbierto.empleadaIds[0]) : [];

  // Movimientos de stock de los últimos días, para el historial de cada insumo.
  const movimientos = [];
  const recientes = ventas.filter((x) => x.fecha > ahora - 2 * 86_400_000 && !x.anulada);
  const gasto = consumo(recientes.flatMap((x) => x.lineas), productos);
  for (const [insumoId, cantidad] of gasto) {
    movimientos.push({ id: `ms-v-${insumoId}`, insumoId, fecha: ahora - 3600_000, tipo: 'venta' as const, cantidad: -Math.round(cantidad * 1000) / 1000, detalle: 'Ventas de los últimos 2 días' });
  }

  const compras = [
    { id: 'c-1', proveedorId: 'pr-tostadero', fecha: ahora - 6 * 86_400_000, items: [{ insumoId: 'i-cafe', cantidad: 8, precio: 26500 }], total: 212000, pagos: [{ fecha: ahora - 6 * 86_400_000, monto: 212000, medio: 'transferencia' as MedioPago, deCaja: false }], comprobante: 'Remito 0001-2231' },
    { id: 'c-2', proveedorId: 'pr-panaderia', fecha: ahora - 86_400_000, items: [{ insumoId: 'i-medialuna', cantidad: 96, precio: 520 }, { insumoId: 'i-factura', cantidad: 48, precio: 560 }], total: 76800, pagos: [{ fecha: ahora - 86_400_000, monto: 76800, medio: 'efectivo' as MedioPago, deCaja: true }], comprobante: '' },
    { id: 'c-3', proveedorId: 'pr-distri', fecha: ahora - 4 * 86_400_000, items: [{ insumoId: 'i-agua', cantidad: 48, precio: 650 }, { insumoId: 'i-cerveza', cantidad: 48, precio: 1700 }], total: 112800, pagos: [{ fecha: ahora - 4 * 86_400_000, monto: 60000, medio: 'transferencia' as MedioPago, deCaja: false }], comprobante: 'Factura B 0003-5521' },
    { id: 'c-4', proveedorId: 'pr-tostadero', fecha: ahora - 2 * 86_400_000, items: [{ insumoId: 'i-cafe', cantidad: 5, precio: 28000 }], total: 140000, pagos: [], comprobante: 'Remito 0001-2260' },
  ];

  return {
    version: 1,
    ajustes: {
      nombreLocal: 'Café La Esquina', direccion: 'Av. Siempreviva 742', telefono: '11 5555-0100', alias: 'cafe.la.esquina.mp',
      mediosActivos: ['efectivo', 'transferencia', 'mercadopago', 'debito', 'credito'], arqueoCiego: false,
      copia: { cadaDias: 7, email: 'claudia@ejemplo.com', ultima: ahora - 5 * 86_400_000 },
    },
    usuarios: structuredClone(usuarios),
    categorias: ['Cafetería', 'Panadería', 'Pastelería', 'Salados', 'Bebidas', 'Bar'],
    productos: structuredClone(productos),
    insumos: structuredClone(insumos),
    movimientos,
    proveedores: structuredClone(proveedores),
    compras,
    salones: [{ id: 's-adentro', nombre: 'Adentro' }, { id: 's-vereda', nombre: 'Vereda' }, { id: 's-barra', nombre: 'Barra' }],
    mesas: structuredClone(mesas),
    cuentas,
    ventas,
    turnoDefs: [
      { id: 'td-manana', nombre: 'Mañana', desde: '07:00', hasta: '14:00' },
      { id: 'td-tarde', nombre: 'Tarde', desde: '14:30', hasta: '21:30' },
    ],
    turnos,
    proximoNumeroVenta: ventas.length + 1,
  };
}

function item(id: string, productoId: string, varianteId: string, cantidad: number, personaId: string | null, hora: number) {
  const l = lineaDe(productoId, varianteId, cantidad);
  return { id, productoId, varianteId, nombre: nombreItem(productos.find((p) => p.id === productoId)!, l.variante), categoria: l.categoria, precio: l.precio, cantidad, personaId, hora, pagado: false };
}

/** Algunas mesas ya ocupadas para que la demo arranque con movimiento. */
function cuentasAbiertas(ahora: number, atiendeId: string): Cuenta[] {
  const hace = (min: number) => ahora - min * 60_000;
  return [
    {
      id: 'cu-2', mesaId: 'm2', abiertaEn: hace(38), atiendeId, pidioCuenta: false,
      personas: [{ id: 'pe-1', nombre: 'Ana' }, { id: 'pe-2', nombre: 'Persona 2' }, { id: 'pe-3', nombre: 'Persona 3' }, { id: 'pe-4', nombre: 'Persona 4' }],
      items: [
        item('it-1', 'p-cafe', 'mediano', 2, 'pe-1', hace(36)),
        item('it-2', 'p-cafe', 'jarrita', 1, 'pe-2', hace(36)),
        item('it-3', 'p-medialuna', 'u', 3, null, hace(35)),
        item('it-4', 'p-choco', 'porcion', 1, 'pe-3', hace(20)),
        item('it-5', 'p-tostado', 'u', 1, 'pe-4', hace(18)),
      ],
      pagos: [],
    },
    {
      id: 'cu-3', mesaId: 'm3', abiertaEn: hace(55), atiendeId, pidioCuenta: true,
      personas: [{ id: 'pe-5', nombre: 'Persona 1' }, { id: 'pe-6', nombre: 'Persona 2' }],
      items: [item('it-6', 'p-cortado', 'chico', 2, null, hace(52)), item('it-7', 'p-factura', 'u', 4, null, hace(52))],
      pagos: [],
    },
    {
      id: 'cu-6', mesaId: 'm6', abiertaEn: hace(14), atiendeId, pidioCuenta: false,
      personas: [{ id: 'pe-7', nombre: 'Persona 1' }, { id: 'pe-8', nombre: 'Persona 2' }, { id: 'pe-9', nombre: 'Persona 3' }],
      items: [item('it-8', 'p-conleche', 'grande', 2, null, hace(12)), item('it-9', 'p-exprimido', 'u', 1, 'pe-9', hace(12))],
      pagos: [],
    },
    {
      id: 'cu-8', mesaId: 'm8', abiertaEn: hace(25), atiendeId, pidioCuenta: false,
      personas: [{ id: 'pe-10', nombre: 'Persona 1' }],
      items: [item('it-10', 'p-capu', 'mediano', 1, null, hace(24)), item('it-11', 'p-budin', 'porcion', 1, null, hace(24))],
      pagos: [],
    },
  ];
}

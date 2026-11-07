import { describe, expect, it } from 'vitest';
import { Cuenta, ItemCuenta, LineaVenta, Producto, Turno, Venta } from './modelos';
import {
  aPagarPersona, aplicarAumento, compartidoRestante, consumo, efectivoEsperado, filtrarVentas, filtrosVacios,
  importeFiltrado, partesIguales, pendienteCuenta, porDia, porProducto, resumen, revisarImportacion,
} from './reglas';

function item(id: string, precio: number, cantidad: number, personaId: string | null, pagado = false): ItemCuenta {
  return { id, productoId: 'p', varianteId: 'v', nombre: id, categoria: 'Cafetería', precio, cantidad, personaId, hora: 0, pagado };
}

function cuenta(items: ItemCuenta[]): Cuenta {
  return {
    id: 'c', mesaId: 'm', abiertaEn: 0, atiendeId: 'u', pidioCuenta: false, pagos: [], items,
    personas: [{ id: 'a', nombre: 'Ana' }, { id: 'b', nombre: 'Beto' }, { id: 'c', nombre: 'Caro' }],
  };
}

function linea(productoId: string, varianteId: string, precio: number, cantidad: number, categoria = 'Cafetería'): LineaVenta {
  return { productoId, varianteId, nombre: productoId, variante: varianteId, categoria, esCafe: categoria === 'Cafetería', precio, cantidad };
}

function venta(id: string, fecha: number, lineas: LineaVenta[], medio: 'efectivo' | 'transferencia' = 'efectivo', turnoId = 't1'): Venta {
  const total = lineas.reduce((s, l) => s + l.precio * l.cantidad, 0);
  return {
    id, numero: 1, fecha, origen: 'mesa', mesa: '1', usuarioId: 'u1', turnoId, lineas,
    pagos: [{ medio, monto: total, quien: '' }], total, personas: 1, anulada: null,
  };
}

describe('cuentas de mesa', () => {
  it('cada uno lo suyo: reparte lo compartido y la suma cierra exacta', () => {
    const c = cuenta([item('cafe', 2800, 1, 'a'), item('jarrita', 2100, 1, 'b'), item('medialunas', 1100, 3, null)]);
    expect(compartidoRestante(c)).toBe(3300);
    const ana = aPagarPersona(c, 'a', true);
    expect(ana).toEqual({ propio: 2800, compartido: 1100, total: 3900 });

    c.pagos.push({ id: '1', monto: ana.total, medio: 'efectivo', modo: 'persona', personaId: 'a', quien: 'Ana', cubreCompartido: ana.compartido, hora: 0 });
    c.items[0].pagado = true;
    const beto = aPagarPersona(c, 'b', true);
    c.pagos.push({ id: '2', monto: beto.total, medio: 'efectivo', modo: 'persona', personaId: 'b', quien: 'Beto', cubreCompartido: beto.compartido, hora: 0 });
    c.items[1].pagado = true;
    const caro = aPagarPersona(c, 'c', true);
    expect(caro.compartido).toBe(1100);
    c.pagos.push({ id: '3', monto: caro.total, medio: 'efectivo', modo: 'persona', personaId: 'c', quien: 'Caro', cubreCompartido: caro.compartido, hora: 0 });
    expect(pendienteCuenta(c)).toBe(0);
  });

  it('sin repartir, cada uno paga solo lo suyo', () => {
    const c = cuenta([item('cafe', 2800, 2, 'a'), item('torta', 4800, 1, null)]);
    expect(aPagarPersona(c, 'a', false).total).toBe(5600);
  });

  it('partes iguales: la última parte absorbe el redondeo', () => {
    expect(partesIguales(10000, 3)).toEqual([3333, 3333, 3334]);
    expect(partesIguales(10000, 3).reduce((a, b) => a + b, 0)).toBe(10000);
  });
});

describe('caja', () => {
  it('efectivo esperado = inicial + ventas en efectivo + ingresos - egresos', () => {
    const turno: Turno = {
      id: 't1', defId: 'm', abiertoEn: 0, cerradoEn: null, abiertoPorId: 'u', cerradoPorId: null, empleadaIds: [], efectivoInicial: 20000,
      movimientos: [{ id: 'x', fecha: 0, tipo: 'egreso', monto: 5000, motivo: 'Hielo' }, { id: 'y', fecha: 0, tipo: 'ingreso', monto: 1000, motivo: 'Cambio' }],
      arqueo: null,
    };
    const ventas = [venta('1', 1, [linea('cafe', 'm', 2800, 2)]), venta('2', 2, [linea('cafe', 'm', 2800, 1)], 'transferencia')];
    expect(efectivoEsperado(turno, ventas)).toBe(20000 + 5600 + 1000 - 5000);
  });
});

describe('reportes', () => {
  const dia = new Date(2026, 9, 1, 10).getTime();
  const ventas = [
    venta('1', dia, [linea('cafe', 'chico', 2500, 2), linea('medialuna', 'u', 1100, 3, 'Panadería')]),
    venta('2', dia + 3600_000, [linea('cafe', 'grande', 3300, 1)], 'transferencia'),
    venta('3', dia + 86_400_000, [linea('medialuna', 'u', 1100, 6, 'Panadería')]),
  ];
  const f = filtrosVacios(dia - 3600_000, dia + 2 * 86_400_000);

  it('sin filtros, el total es la suma de todas las ventas', () => {
    const r = resumen(filtrarVentas(ventas, f, []), f);
    expect(r.ventas).toBe(3);
    expect(r.total).toBe(2500 * 2 + 1100 * 3 + 3300 + 1100 * 6);
  });

  it('filtrar por un tamaño (café chico) suma solo esas líneas', () => {
    const fc = { ...f, productos: ['cafe:chico'] };
    const lista = filtrarVentas(ventas, fc, []);
    expect(lista.map((v) => v.id)).toEqual(['1']);
    expect(resumen(lista, fc)).toMatchObject({ total: 5000, unidades: 2, cafes: 2 });
  });

  it('filtrar por producto incluye todos sus tamaños', () => {
    const fc = { ...f, productos: ['cafe'] };
    expect(porProducto(filtrarVentas(ventas, fc, []), fc).map((x) => x.clave)).toEqual(['cafe:chico', 'cafe:grande']);
  });

  it('el total por día cierra con el total general', () => {
    const lista = filtrarVentas(ventas, f, []);
    const suma = porDia(lista, f).reduce((s, d) => s + d.total, 0);
    expect(suma).toBe(resumen(lista, f).total);
  });

  it('filtrar por medio de pago suma solo esos pagos', () => {
    const fm = { ...f, medios: ['transferencia' as const] };
    const lista = filtrarVentas(ventas, fm, []);
    expect(lista.reduce((s, v) => s + importeFiltrado(v, fm), 0)).toBe(3300);
  });

  it('las ventas anuladas no cuentan', () => {
    const anulada = { ...venta('4', dia, [linea('cafe', 'chico', 2500, 10)]), anulada: { motivo: 'Error', porId: 'u', fecha: dia } };
    expect(filtrarVentas([...ventas, anulada], f, []).length).toBe(3);
  });
});

describe('stock y precios', () => {
  const productos: Producto[] = [{
    id: 'cafe', nombre: 'Café', categoria: 'Cafetería', descripcion: '', dondeSeVende: 'ambos', activo: true, esCafe: true,
    variantes: [{ id: 'm', nombre: 'Mediano', precio: 2800, receta: [{ insumoId: 'grano', cantidad: 0.0125 }, { insumoId: 'vaso', cantidad: 1 }] }],
  }];

  it('80 cafés gastan 1 kg de café', () => {
    expect(consumo([{ productoId: 'cafe', varianteId: 'm', cantidad: 80 }], productos).get('grano')).toBeCloseTo(1);
  });

  it('aumento con redondeo a $100', () => {
    expect(aplicarAumento(2800, 10, 100)).toBe(3100);
    expect(aplicarAumento(2750, 5, 50)).toBe(2900);
  });

  it('la importación actualiza lo que existe y marca los errores', () => {
    const filas = revisarImportacion([
      { Producto: 'café', Tamaño: 'mediano', Precio: '$ 3.000' },
      { Producto: 'Licuado', Categoría: 'Bebidas', Tamaño: 'Grande', Precio: 4500 },
      { Producto: 'Tostado', Precio: '' },
    ], productos);
    expect(filas.map((f) => f.accion)).toEqual(['actualiza', 'nuevo', 'error']);
    expect(filas[0].precio).toBe(3000);
  });
});

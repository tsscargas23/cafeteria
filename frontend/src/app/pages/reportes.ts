import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { Avisos } from '../core/avisos';
import { descargarPlanilla } from '../core/excel';
import { aInputFecha, deInputFecha, fecha, fechaHora, hora, nombreMedio, num, plata } from '../core/formato';
import { ArrowDown, ArrowUp, ArrowUpDown, Ban, CircleAlert, Download, Info, RotateCcw } from '../core/iconos';
import { MEDIOS_PAGO, MedioPago, Origen, Venta } from '../core/modelos';
import {
  FilaProducto, Filtros, filtrarVentas, importeFiltrado, inicioDelDia, kilosCafe, porDia, porMedio, porProducto, resumen, variacion,
} from '../core/reglas';
import { Tienda } from '../core/tienda';
import { GraficoDias } from '../shared/grafico-dias';
import { Opcion, Selector } from '../shared/selector';

type Periodo = 'hoy' | 'ayer' | '7' | 'mes' | 'mesPasado' | '30' | 'otro';

@Component({
  selector: 'app-reportes',
  imports: [FormsModule, LucideAngularModule, Selector, GraficoDias],
  styles: `
    .filtros { display: flex; flex-direction: column; gap: 10px; padding: 14px 16px; }
    .periodos { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
    .fechas { display: inline-flex; gap: 6px; align-items: center; .input { width: 150px; } }
    .suma { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 10px 16px; border-top: 1px solid var(--border); background: var(--surface-2); border-radius: 0 0 var(--r-lg) var(--r-lg); font-size: var(--fs-sm); color: var(--text-2);
      b { color: var(--text); font-variant-numeric: tabular-nums; } }
    .dos { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr); gap: 18px; }
    .barras { display: flex; flex-direction: column; gap: 10px; }
    .fila-barra { display: grid; grid-template-columns: 110px 1fr auto; gap: 10px; align-items: center; font-size: var(--fs-sm);
      .pista { height: 10px; background: var(--surface-2); border-radius: 0 4px 4px 0; }
      .relleno { height: 100%; background: var(--series-1); border-radius: 0 4px 4px 0; min-width: 2px; }
      b { font-variant-numeric: tabular-nums; min-width: 84px; text-align: right; } }
    .tabs { display: flex; gap: 4px; }
    .tab { padding: 8px 12px; border: 0; background: transparent; border-bottom: 2px solid transparent; font-weight: 650; color: var(--text-2); cursor: pointer;
      &.activo { color: var(--accent-text); border-color: var(--accent-text); } }
    .pct { color: var(--text-3); font-size: var(--fs-sm); }
    @media (max-width: 1100px) { .dos { grid-template-columns: 1fr; } }
  `,
  template: `
    <div class="pagina">
      <div class="pagina-cab">
        <div class="titulo"><h1>Reportes</h1><p>Elegí el período y filtrá por lo que quieras. Todos los números salen de las mismas ventas de la lista.</p></div>
        <div class="acciones"><button class="btn" (click)="exportar()"><lucide-icon [img]="iBajar" [size]="18" />Exportar a Excel</button></div>
      </div>

      <section class="panel">
        <div class="filtros">
          <div class="periodos">
            @for (p of periodos; track p.id) {
              <button class="chip" [class.activo]="periodo() === p.id" (click)="elegirPeriodo(p.id)">{{ p.nombre }}</button>
            }
            <span class="fechas">
              <input class="input chico" type="date" [ngModel]="aInputFecha(desde())" (ngModelChange)="fijarDesde($event)" aria-label="Desde" />
              <span class="ter">a</span>
              <input class="input chico" type="date" [ngModel]="aInputFecha(hasta())" (ngModelChange)="fijarHasta($event)" aria-label="Hasta" />
            </span>
          </div>
          <div class="periodos">
            <app-selector nombre="Producto" [opciones]="opcionesProducto()" [(valor)]="productos" />
            <app-selector nombre="Categoría" [opciones]="opcionesCategoria()" [(valor)]="categorias" />
            <app-selector nombre="Empleada" [opciones]="opcionesEmpleada()" [(valor)]="empleadas" />
            <app-selector nombre="Turno" [opciones]="opcionesTurno()" [(valor)]="turnos" />
            <app-selector nombre="Medio de pago" [opciones]="opcionesMedio" [(valor)]="medios" />
            <app-selector nombre="Mesa o mostrador" [opciones]="opcionesOrigen" [(valor)]="origenes" />
            @if (hayFiltros()) { <button class="btn chico fantasma" (click)="limpiar()"><lucide-icon [img]="iLimpiar" [size]="15" />Quitar filtros</button> }
          </div>
        </div>
        <div class="suma">
          <lucide-icon [img]="iInfo" [size]="16" />
          <span>Del {{ fecha(desde()) }} al {{ fecha(hasta()) }}: <b>{{ num(r().ventas) }} ventas</b> que suman <b>{{ plata(r().total) }}</b>.</span>
          @if (filtraProducto()) { <span>El total es solo de los productos filtrados.</span> }
          @else if (medios().length) { <span>El total es solo lo cobrado con {{ textoMedios() }}.</span> }
          @if (anuladas()) { <span class="ter">· {{ anuladas() === 1 ? '1 venta anulada no se cuenta' : anuladas() + ' ventas anuladas no se cuentan' }}.</span> }
        </div>
      </section>

      <div class="indicadores">
        <div class="indicador"><div class="nombre">Vendido</div><div class="valor">{{ plata(r().total) }}</div>
          <div class="detalle">@if (cambio(r().total, rAnt().total); as c) { <span [class]="c > 0 ? 'sube' : 'baja'">{{ c > 0 ? '▲' : '▼' }} {{ abs(c) }} %</span> } vs. período anterior</div></div>
        <div class="indicador"><div class="nombre">Ventas</div><div class="valor">{{ num(r().ventas) }}</div>
          <div class="detalle">Ticket promedio {{ plata(r().ticketPromedio) }}</div></div>
        <div class="indicador"><div class="nombre">Cafés vendidos</div><div class="valor">{{ num(r().cafes) }}</div>
          <div class="detalle">@if (cambio(r().cafes, rAnt().cafes); as c) { <span [class]="c > 0 ? 'sube' : 'baja'">{{ c > 0 ? '▲' : '▼' }} {{ abs(c) }} %</span> } · {{ num(promedioCafes()) }} por día</div></div>
        <div class="indicador"><div class="nombre">Café usado</div><div class="valor">{{ num(kilos()) }} kg</div>
          <div class="detalle">Según la receta de cada tamaño</div></div>
      </div>

      <section class="panel">
        <div class="panel-cab"><h3>Vendido por día</h3><span class="ter derecha">Pasá el mouse por una barra para ver el detalle</span></div>
        <div class="panel-cuerpo"><app-grafico-dias [datos]="dias()" /></div>
      </section>

      <div class="dos">
        <section class="panel">
          <div class="panel-cab">
            <div class="tabs" role="tablist">
              <button class="tab" role="tab" [class.activo]="tab() === 'productos'" (click)="tab.set('productos')">Por producto</button>
              <button class="tab" role="tab" [class.activo]="tab() === 'ventas'" (click)="tab.set('ventas')">Lista de ventas</button>
            </div>
          </div>
          @if (tab() === 'productos') {
            <div class="tabla-envoltura" style="max-height:520px">
              <table class="tabla">
                <thead><tr>
                  <th class="ordenable" (click)="ordenar('nombre')">Producto <lucide-icon [img]="iconoOrden('nombre')" [size]="14" /></th>
                  <th>Tamaño</th>
                  <th class="num ordenable" (click)="ordenar('cantidad')">Cantidad <lucide-icon [img]="iconoOrden('cantidad')" [size]="14" /></th>
                  <th class="num ordenable" (click)="ordenar('total')">Total <lucide-icon [img]="iconoOrden('total')" [size]="14" /></th>
                  <th class="num">% del total</th>
                </tr></thead>
                <tbody>
                  @for (f of filasProducto(); track f.clave) {
                    <tr><td><b>{{ f.nombre }}</b></td><td class="sec">{{ f.variante }}</td><td class="num">{{ num(f.cantidad) }}</td><td class="num">{{ plata(f.total) }}</td><td class="num pct">{{ porcentaje(f.total) }}</td></tr>
                  } @empty {
                    <tr><td colspan="5"><div class="vacio"><h3>No hay ventas con estos filtros</h3><p>Probá con otro período o quitá algún filtro.</p></div></td></tr>
                  }
                </tbody>
                @if (filasProducto().length) {
                  <tfoot><tr><td><b>Total</b></td><td></td><td class="num"><b>{{ num(r().unidades) }}</b></td><td class="num"><b>{{ plata(sumaProductos()) }}</b></td><td></td></tr></tfoot>
                }
              </table>
            </div>
          } @else {
            <div class="tabla-envoltura" style="max-height:520px">
              <table class="tabla">
                <thead><tr><th>#</th><th>Fecha</th><th>Dónde</th><th>Atendió</th><th>Productos</th><th>Pago</th><th class="num">Total</th><th></th></tr></thead>
                <tbody>
                  @for (v of listaVentas(); track v.id) {
                    <tr [class.anulada]="!!v.anulada">
                      <td class="ter num">{{ v.numero }}</td>
                      <td class="num">{{ fechaHora(v.fecha) }}</td>
                      <td>{{ v.origen === 'mesa' ? 'Mesa ' + v.mesa : 'Mostrador' }}</td>
                      <td class="sec">{{ tienda.nombreUsuario(v.usuarioId) }}</td>
                      <td class="sec" style="max-width:260px">{{ resumenLineas(v) }}</td>
                      <td class="sec">{{ textoPagos(v) }}</td>
                      <td class="num"><b>{{ plata(importeFiltrado(v, filtros())) }}</b></td>
                      <td class="sin-tachar">
                        @if (v.anulada) { <span class="etiqueta error" [attr.title]="v.anulada.motivo">Anulada</span> }
                        @else { <button class="btn chico fantasma" (click)="anulando.set(v)"><lucide-icon [img]="iAnular" [size]="14" />Anular</button> }
                      </td>
                    </tr>
                  } @empty {
                    <tr><td colspan="8"><div class="vacio"><h3>No hay ventas con estos filtros</h3></div></td></tr>
                  }
                </tbody>
              </table>
            </div>
            @if (lista().length > limite()) {
              <div class="panel-cuerpo fila"><span class="ter">Mostrando {{ limite() }} de {{ lista().length }}</span><button class="btn chico" (click)="limite.set(limite() + 100)">Ver 100 más</button></div>
            }
          }
        </section>

        <div style="display:flex;flex-direction:column;gap:18px;min-width:0">
          <section class="panel">
            <div class="panel-cab"><h3>Cafés por tamaño</h3></div>
            <div class="panel-cuerpo barras">
              @for (t of cafesPorTamano(); track t.nombre) {
                <div class="fila-barra"><span>{{ t.nombre }}</span><span class="pista"><span class="relleno" [style.width.%]="(t.cantidad / maxTamano()) * 100" style="display:block"></span></span><b>{{ num(t.cantidad) }}</b></div>
              } @empty { <p class="ter">Sin cafés en este período.</p> }
            </div>
          </section>
          <section class="panel">
            <div class="panel-cab"><h3>Por medio de pago</h3></div>
            <div class="panel-cuerpo barras">
              @for (m of medioPago(); track m.medio) {
                <div class="fila-barra"><span>{{ nombreMedio(m.medio) }}</span><span class="pista"><span class="relleno" [style.width.%]="(m.total / maxMedio()) * 100" style="display:block"></span></span><b>{{ plata(m.total) }}</b></div>
              } @empty { <p class="ter">Sin ventas.</p> }
            </div>
          </section>
        </div>
      </div>

    </div>

    @if (anulando(); as v) {
      <div class="dialogo-fondo" (click)="anulando.set(null)">
        <form class="dialogo" (click)="$event.stopPropagation()" (ngSubmit)="anular()">
          <h3>Anular venta #{{ v.numero }}</h3>
          <p class="sec">{{ plata(v.total) }} · {{ fechaHora(v.fecha) }}. La venta no se borra: queda marcada como anulada, deja de sumar y vuelve el stock.</p>
          <label class="campo"><span>Motivo</span><input class="input" name="motivo" [(ngModel)]="motivo" placeholder="Ej.: se cargó dos veces" /></label>
          <div class="pie"><button type="button" class="btn" (click)="anulando.set(null)">Cancelar</button><button type="submit" class="btn peligro" [disabled]="!motivo.trim()">Anular venta</button></div>
        </form>
      </div>
    }
  `,
})
export class Reportes {
  protected readonly tienda = inject(Tienda);
  private readonly avisos = inject(Avisos);

  protected readonly periodo = signal<Periodo>('30');
  protected readonly desde = signal(inicioDelDia(Date.now() - 29 * 86_400_000));
  protected readonly hasta = signal(finDelDia(Date.now()));
  protected readonly productos = signal<string[]>([]);
  protected readonly categorias = signal<string[]>([]);
  protected readonly empleadas = signal<string[]>([]);
  protected readonly turnos = signal<string[]>([]);
  protected readonly medios = signal<string[]>([]);
  protected readonly origenes = signal<string[]>([]);
  protected readonly tab = signal<'productos' | 'ventas'>('productos');
  protected readonly orden = signal<{ campo: 'nombre' | 'cantidad' | 'total'; asc: boolean }>({ campo: 'total', asc: false });
  protected readonly limite = signal(100);
  protected readonly anulando = signal<Venta | null>(null);
  protected motivo = '';

  protected readonly periodos: { id: Periodo; nombre: string }[] = [
    { id: 'hoy', nombre: 'Hoy' }, { id: 'ayer', nombre: 'Ayer' }, { id: '7', nombre: 'Últimos 7 días' }, { id: 'mes', nombre: 'Este mes' },
    { id: 'mesPasado', nombre: 'Mes pasado' }, { id: '30', nombre: 'Últimos 30 días' },
  ];

  protected readonly filtros = computed<Filtros>(() => ({
    desde: this.desde(), hasta: this.hasta(), productos: this.productos(), categorias: this.categorias(), empleadas: this.empleadas(),
    turnoDefs: this.turnos(), medios: this.medios() as MedioPago[], origenes: this.origenes() as Origen[],
  }));
  private readonly filtrosAnteriores = computed<Filtros>(() => {
    const largo = this.hasta() - this.desde();
    return { ...this.filtros(), desde: this.desde() - largo - 1, hasta: this.desde() - 1 };
  });
  protected readonly lista = computed(() => filtrarVentas(this.tienda.estado().ventas, this.filtros(), this.tienda.estado().turnos).sort((a, b) => b.fecha - a.fecha));
  private readonly listaAnterior = computed(() => filtrarVentas(this.tienda.estado().ventas, this.filtrosAnteriores(), this.tienda.estado().turnos));
  protected readonly r = computed(() => resumen(this.lista(), this.filtros()));
  protected readonly rAnt = computed(() => resumen(this.listaAnterior(), this.filtrosAnteriores()));
  protected readonly dias = computed(() => porDia(this.lista(), this.filtros()));
  protected readonly anuladas = computed(() => this.tienda.estado().ventas.filter((v) => v.anulada && v.fecha >= this.desde() && v.fecha <= this.hasta()).length);
  protected readonly filtraProducto = computed(() => this.productos().length > 0 || this.categorias().length > 0);
  protected readonly hayFiltros = computed(() => [this.productos(), this.categorias(), this.empleadas(), this.turnos(), this.medios(), this.origenes()].some((l) => l.length));
  protected readonly kilos = computed(() => Math.round(kilosCafe(this.lista(), this.filtros(), this.tienda.estado().productos, 'i-cafe') * 10) / 10);
  protected readonly promedioCafes = computed(() => {
    const abiertos = this.dias().filter((d) => d.ventas > 0).length || 1;
    return Math.round(this.r().cafes / abiertos);
  });
  protected readonly filasProducto = computed(() => {
    const filas = porProducto(this.lista(), this.filtros());
    const { campo, asc } = this.orden();
    const dir = asc ? 1 : -1;
    return [...filas].sort((a, b) => (campo === 'nombre' ? a.nombre.localeCompare(b.nombre) || a.variante.localeCompare(b.variante) : (a[campo] - b[campo])) * dir);
  });
  protected readonly sumaProductos = computed(() => this.filasProducto().reduce((s, f) => s + f.total, 0));
  protected readonly listaVentas = computed(() => this.lista().slice(0, this.limite()));
  protected readonly cafesPorTamano = computed(() => {
    const m = new Map<string, number>();
    for (const v of this.lista()) for (const l of v.lineas) if (l.esCafe) m.set(l.variante, (m.get(l.variante) ?? 0) + l.cantidad);
    const orden = ['Jarrita', 'Chico', 'Mediano', 'Grande'];
    const lugar = (n: string) => (orden.includes(n) ? orden.indexOf(n) : orden.length);
    return [...m.entries()].map(([nombre, cantidad]) => ({ nombre, cantidad })).sort((a, b) => lugar(a.nombre) - lugar(b.nombre));
  });
  protected readonly maxTamano = computed(() => Math.max(1, ...this.cafesPorTamano().map((t) => t.cantidad)));
  protected readonly medioPago = computed(() => porMedio(this.lista(), this.filtros()));
  protected readonly maxMedio = computed(() => Math.max(1, ...this.medioPago().map((m) => m.total)));
  protected readonly opcionesProducto = computed<Opcion[]>(() => this.tienda.estado().productos.flatMap((p) => [
    { valor: p.id, texto: p.variantes.length > 1 ? `${p.nombre} (todos)` : p.nombre, grupo: p.categoria },
    ...(p.variantes.length > 1 ? p.variantes.map((v) => ({ valor: `${p.id}:${v.id}`, texto: `${p.nombre} ${v.nombre.toLowerCase()}`, grupo: p.categoria, sangria: true })) : []),
  ]).sort((a, b) => a.grupo.localeCompare(b.grupo)));
  protected readonly opcionesCategoria = computed<Opcion[]>(() => this.tienda.estado().categorias.map((c) => ({ valor: c, texto: c })));
  protected readonly opcionesEmpleada = computed<Opcion[]>(() => this.tienda.estado().usuarios.map((u) => ({ valor: u.id, texto: u.nombre })));
  protected readonly opcionesTurno = computed<Opcion[]>(() => this.tienda.estado().turnoDefs.map((d) => ({ valor: d.id, texto: d.nombre })));
  protected readonly opcionesMedio: Opcion[] = MEDIOS_PAGO.map((m) => ({ valor: m.id, texto: m.nombre }));
  protected readonly opcionesOrigen: Opcion[] = [{ valor: 'mesa', texto: 'Mesas' }, { valor: 'mostrador', texto: 'Mostrador' }];

  protected readonly plata = plata;
  protected readonly num = num;
  protected readonly fecha = fecha;
  protected readonly fechaHora = fechaHora;
  protected readonly hora = hora;
  protected readonly nombreMedio = nombreMedio;
  protected readonly aInputFecha = aInputFecha;
  protected readonly importeFiltrado = importeFiltrado;
  protected readonly abs = Math.abs;
  protected readonly iBajar = Download;
  protected readonly iInfo = Info;
  protected readonly iLimpiar = RotateCcw;
  protected readonly iAnular = Ban;
  protected readonly iAlerta = CircleAlert;

  elegirPeriodo(p: Periodo) {
    this.periodo.set(p);
    const hoy = inicioDelDia(Date.now());
    const d = new Date(hoy);
    const rangos: Record<Exclude<Periodo, 'otro'>, [number, number]> = {
      hoy: [hoy, finDelDia(hoy)],
      ayer: [hoy - 86_400_000, hoy - 1],
      '7': [hoy - 6 * 86_400_000, finDelDia(hoy)],
      '30': [hoy - 29 * 86_400_000, finDelDia(hoy)],
      mes: [new Date(d.getFullYear(), d.getMonth(), 1).getTime(), finDelDia(hoy)],
      mesPasado: [new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime(), new Date(d.getFullYear(), d.getMonth(), 1).getTime() - 1],
    };
    if (p === 'otro') return;
    this.desde.set(rangos[p][0]);
    this.hasta.set(rangos[p][1]);
    this.limite.set(100);
  }

  fijarDesde(v: string) {
    if (!v) return;
    this.desde.set(deInputFecha(v));
    this.periodo.set('otro');
  }

  fijarHasta(v: string) {
    if (!v) return;
    this.hasta.set(deInputFecha(v, true));
    this.periodo.set('otro');
  }

  limpiar() {
    for (const s of [this.productos, this.categorias, this.empleadas, this.turnos, this.medios, this.origenes]) s.set([]);
  }

  cambio(actual: number, anterior: number) {
    return variacion(actual, anterior);
  }

  textoMedios() {
    return this.medios().map((m) => nombreMedio(m as MedioPago).toLowerCase()).join(' o ');
  }

  porcentaje(total: number) {
    const s = this.sumaProductos();
    return s ? `${Math.round((total / s) * 1000) / 10} %` : '';
  }

  ordenar(campo: 'nombre' | 'cantidad' | 'total') {
    const o = this.orden();
    this.orden.set({ campo, asc: o.campo === campo ? !o.asc : campo === 'nombre' });
  }

  iconoOrden(campo: string) {
    const o = this.orden();
    return o.campo !== campo ? ArrowUpDown : o.asc ? ArrowUp : ArrowDown;
  }

  resumenLineas(v: Venta) {
    return v.lineas.map((l) => `${l.cantidad} ${l.nombre}${l.variante && !['Unidad', 'Único'].includes(l.variante) ? ' ' + l.variante.toLowerCase() : ''}`).join(', ');
  }

  textoPagos(v: Venta) {
    return v.pagos.map((p) => nombreMedio(p.medio)).filter((x, i, a) => a.indexOf(x) === i).join(' + ');
  }

  anular() {
    const v = this.anulando();
    if (!v || !this.motivo.trim()) return;
    this.tienda.anularVenta(v.id, this.motivo.trim());
    this.avisos.mostrar(`Venta #${v.numero} anulada`);
    this.anulando.set(null);
    this.motivo = '';
  }

  exportar() {
    const f = this.filtros();
    descargarPlanilla(`ventas-${aInputFecha(this.desde())}-a-${aInputFecha(this.hasta())}.xlsx`, [
      { nombre: 'Resumen', filas: [
        { Dato: 'Período', Valor: `${fecha(this.desde())} a ${fecha(this.hasta())}` },
        { Dato: 'Ventas', Valor: this.r().ventas },
        { Dato: 'Total vendido', Valor: this.r().total },
        { Dato: 'Ticket promedio', Valor: this.r().ticketPromedio },
        { Dato: 'Cafés vendidos', Valor: this.r().cafes },
        { Dato: 'Café usado (kg)', Valor: this.kilos() },
      ] },
      { nombre: 'Por producto', filas: this.filasProducto().map((x: FilaProducto) => ({ Producto: x.nombre, Tamaño: x.variante, Categoría: x.categoria, Cantidad: x.cantidad, Total: x.total })) },
      { nombre: 'Ventas', filas: this.lista().map((v) => ({
        Número: v.numero, Fecha: new Date(v.fecha).toLocaleString('es-AR'), Dónde: v.origen === 'mesa' ? `Mesa ${v.mesa}` : 'Mostrador',
        Atendió: this.tienda.nombreUsuario(v.usuarioId), Productos: this.resumenLineas(v), Pago: this.textoPagos(v), Total: importeFiltrado(v, f),
      })) },
    ]);
  }
}

function finDelDia(t: number) {
  const d = new Date(t);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

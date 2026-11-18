import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { Avisos } from '../core/avisos';
import { descargarPlanilla, leerPlanilla } from '../core/excel';
import { cantidadConUnidad, fechaHora, num, plata } from '../core/formato';
import { CircleAlert, CircleCheck, CircleX, Coffee, Download, History, Pencil, Plus, Search, Trash2, TriangleAlert, Upload, X } from '../core/iconos';
import { Insumo, Unidad } from '../core/modelos';
import { estadoStock, filtrosVacios, kilosCafe } from '../core/reglas';
import { nuevoId, Tienda } from '../core/tienda';

interface FilaInsumo { fila: number; nombre: string; categoria: string; unidad: Unidad; stock: number; minimo: number; costo: number; error: string | null; existe: boolean }

@Component({
  selector: 'app-inventario',
  imports: [FormsModule, LucideAngularModule, RouterLink],
  styles: `
    .cafe { display: grid; grid-template-columns: auto 1fr auto; gap: 16px; align-items: center; padding: 16px 18px;
      .icono-cafe { width: 44px; height: 44px; border-radius: 12px; background: var(--accent-soft); color: var(--accent-text); display: grid; place-items: center; }
      b.grande { font-size: 22px; font-variant-numeric: tabular-nums; } }
    .barra { height: 8px; border-radius: 8px; background: var(--surface-3); overflow: hidden; margin-top: 8px; max-width: 420px; span { display: block; height: 100%; border-radius: 8px; } }
    .mov { display: grid; grid-template-columns: 120px 1fr auto; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--border); font-size: var(--fs-sm); font-variant-numeric: tabular-nums; }
    .vista-previa { max-height: 340px; overflow: auto; border: 1px solid var(--border); border-radius: var(--r); }
  `,
  template: `
    <div class="pagina">
      <div class="pagina-cab">
        <div class="titulo"><h1>Inventario</h1><p>El stock de lo que comprás (café en grano, leche, gaseosas…), para saber cuánto queda y cuándo pedir. Lo que se vende y tiene precio se carga en <a routerLink="/productos">Productos</a>.</p></div>
        <div class="acciones">
          <button class="btn" (click)="abrirImportar()"><lucide-icon [img]="iSubir" [size]="18" />Importar Excel</button>
          <button class="btn" (click)="exportar()"><lucide-icon [img]="iBajar" [size]="18" />Exportar</button>
          <button class="btn primario" (click)="nuevo()"><lucide-icon [img]="iMas" [size]="18" />Nuevo insumo</button>
        </div>
      </div>

      @if (cafe(); as c) {
        <section class="panel cafe">
          <span class="icono-cafe"><lucide-icon [img]="iCafe" [size]="22" /></span>
          <div>
            <div class="sec">Café en grano</div>
            <b class="grande">{{ num(c.stock) }} kg ≈ {{ num(c.tazas) }} cafés</b>
            <div class="ter">Calculado a 80 cafés por kilo. Se usan unos {{ num(c.porDia) }} kg por día: alcanza para <b>{{ c.dias }} {{ c.dias === 1 ? 'día' : 'días' }}</b>.</div>
            <div class="barra"><span [style.width.%]="c.porcentaje" [style.background]="c.bajo ? 'var(--warn)' : 'var(--ok)'"></span></div>
          </div>
          @if (c.bajo) { <span class="etiqueta atencion"><lucide-icon [img]="iAlerta" [size]="13" />Conviene pedir café</span> }
        </section>
      }

      <div class="barra-filtros">
        <label class="buscador"><lucide-icon [img]="iBuscar" [size]="17" /><input class="input" placeholder="Buscar insumo" [ngModel]="busqueda()" (ngModelChange)="busqueda.set($event)" /></label>
        <button class="chip" [class.activo]="estado() === null" (click)="estado.set(null)">Todos</button>
        <button class="chip" [class.activo]="estado() === 'bajo'" (click)="estado.set('bajo')">Stock bajo ({{ cuentaEstado('bajo') }})</button>
        <button class="chip" [class.activo]="estado() === 'sin'" (click)="estado.set('sin')">Sin stock ({{ cuentaEstado('sin') }})</button>
        <select class="input chico" style="width:auto;margin-left:auto" [ngModel]="categoria()" (ngModelChange)="categoria.set($event)" aria-label="Categoría">
          <option [ngValue]="null">Todas las categorías</option>
          @for (c of categorias(); track c) { <option [ngValue]="c">{{ c }}</option> }
        </select>
      </div>

      <section class="panel">
        <div class="tabla-envoltura">
          <table class="tabla">
            <thead><tr><th>Insumo</th><th>Categoría</th><th class="num">Hay</th><th class="num">Mínimo</th><th>Estado</th><th class="num">Costo</th><th class="num">Valor en stock</th><th></th></tr></thead>
            <tbody>
              @for (i of filtrados(); track i.id) {
                @let e = estadoStock(i);
                <tr class="clic" (click)="editar(i)">
                  <td><b>{{ i.nombre }}</b></td>
                  <td class="sec">{{ i.categoria }}</td>
                  <td class="num">{{ cantidadConUnidad(i.stock, i.unidad) }}</td>
                  <td class="num sec">{{ cantidadConUnidad(i.minimo, i.unidad) }}</td>
                  <td>
                    @switch (e) {
                      @case ('ok') { <span class="etiqueta ok"><lucide-icon [img]="iOk" [size]="12" />En stock</span> }
                      @case ('bajo') { <span class="etiqueta atencion"><lucide-icon [img]="iAlerta" [size]="12" />Stock bajo</span> }
                      @case ('sin') { <span class="etiqueta error"><lucide-icon [img]="iSin" [size]="12" />Sin stock</span> }
                    }
                  </td>
                  <td class="num sec">{{ plata(i.costo) }} / {{ i.unidad === 'u' ? 'u.' : i.unidad }}</td>
                  <td class="num">{{ plata(i.stock * i.costo) }}</td>
                  <td><button class="btn icono chico fantasma" (click)="$event.stopPropagation(); editar(i)" [attr.aria-label]="'Editar ' + i.nombre"><lucide-icon [img]="iEditar" [size]="16" /></button></td>
                </tr>
              } @empty {
                <tr><td colspan="8"><div class="vacio"><h3>No hay insumos con esos filtros</h3></div></td></tr>
              }
            </tbody>
          </table>
        </div>
      </section>
      <p class="ter">Valor total del inventario: <b>{{ plata(valorTotal()) }}</b></p>
    </div>

    @if (panel() === 'editar') {
      <div class="lateral-fondo" (click)="panel.set(null)"></div>
      <aside class="lateral" role="dialog" aria-label="Editar insumo">
        <div class="lateral-cab"><h2>{{ esNuevo ? 'Nuevo insumo' : form.nombre }}</h2><button class="btn icono fantasma" (click)="panel.set(null)" aria-label="Cerrar"><lucide-icon [img]="iX" [size]="20" /></button></div>
        <div class="lateral-cuerpo">
          @if (esNuevo) { <p class="sec">Esto solo lleva la cuenta del stock: no aparece para vender ni en la carta. Para venderlo, cargalo en <a routerLink="/productos">Productos</a>.</p> }
          <label class="campo"><span>Nombre</span><input class="input" [(ngModel)]="form.nombre" /></label>
          <div class="grilla-2">
            <label class="campo"><span>Categoría</span><input class="input" [(ngModel)]="form.categoria" list="cats" /><datalist id="cats">@for (c of categorias(); track c) { <option [value]="c"></option> }</datalist></label>
            <label class="campo"><span>Se mide en</span><select class="input" [(ngModel)]="form.unidad"><option value="kg">Kilos (kg)</option><option value="L">Litros (L)</option><option value="u">Unidades</option></select></label>
          </div>
          <div class="grilla-2">
            <label class="campo"><span>Avisar cuando quede menos de</span><input class="input" type="number" min="0" step="any" [(ngModel)]="form.minimo" /></label>
            <label class="campo"><span>Costo por {{ form.unidad === 'u' ? 'unidad' : form.unidad }}</span><span class="input-plata"><input class="input" type="number" min="0" [(ngModel)]="form.costo" /></span></label>
          </div>
          @if (esNuevo) {
            <label class="campo"><span>Cuánto hay ahora</span><input class="input" type="number" min="0" step="any" [(ngModel)]="form.stock" /></label>
          } @else {
            <div class="separador"></div>
            <h3>Contar stock</h3>
            <p class="sec">Hay {{ cantidadConUnidad(form.stock, form.unidad) }} según el sistema. Si contaste otra cantidad, anotala y queda registrado el ajuste.</p>
            <div class="grilla-2">
              <label class="campo"><span>Cantidad contada</span><input class="input" type="number" min="0" step="any" [(ngModel)]="contado" /></label>
              <label class="campo"><span>Motivo</span><input class="input" [(ngModel)]="motivo" placeholder="Ej.: conteo semanal, se venció" /></label>
            </div>
            <div><button class="btn" [disabled]="contado === null" (click)="ajustar()">Guardar conteo</button></div>
            <div class="separador"></div>
            <h3 class="fila"><lucide-icon [img]="iHistorial" [size]="18" />Últimos movimientos</h3>
            <div>
              @for (m of movimientos(); track m.id) {
                <div class="mov"><span class="ter">{{ fechaHora(m.fecha) }}</span><span>{{ m.detalle }}</span><b [style.color]="m.cantidad < 0 ? 'var(--danger)' : 'var(--ok)'">{{ m.cantidad > 0 ? '+' : '' }}{{ num(m.cantidad) }} {{ form.unidad === 'u' ? 'u.' : form.unidad }}</b></div>
              } @empty { <p class="ter">Sin movimientos todavía.</p> }
            </div>
          }
        </div>
        <div class="lateral-pie">
          @if (borrando()) {
            <span class="sec confirmar">¿Borrar {{ form.nombre }}? No se puede deshacer.</span>
            <button class="btn" (click)="borrando.set(false)">No</button>
            <button class="btn peligro" (click)="borrar()">Sí, borrar</button>
          } @else {
            @if (!esNuevo) { <button class="btn peligro izquierda" (click)="borrando.set(true)"><lucide-icon [img]="iBorrar" [size]="17" />Borrar</button> }
            <button class="btn" (click)="panel.set(null)">Cancelar</button>
            <button class="btn primario" [disabled]="!form.nombre.trim()" (click)="guardar()">Guardar</button>
          }
        </div>
      </aside>
    }

    @if (panel() === 'importar') {
      <div class="lateral-fondo" (click)="panel.set(null)"></div>
      <aside class="lateral ancho" role="dialog" aria-label="Importar insumos">
        <div class="lateral-cab"><h2>Importar insumos desde Excel</h2><button class="btn icono fantasma" (click)="panel.set(null)" aria-label="Cerrar"><lucide-icon [img]="iX" [size]="20" /></button></div>
        <div class="lateral-cuerpo">
          <p class="sec">Columnas: <b>Insumo</b>, <b>Categoría</b>, <b>Unidad</b> (kg, L o u), <b>Stock</b>, <b>Mínimo</b> y <b>Costo</b>. Si el insumo ya existe, se actualizan sus datos.</p>
          <div class="fila">
            <button class="btn" (click)="plantilla()"><lucide-icon [img]="iBajar" [size]="18" />Bajar planilla de ejemplo</button>
            <label class="btn primario"><lucide-icon [img]="iSubir" [size]="18" />Elegir archivo<input type="file" accept=".xlsx,.xls,.csv" hidden (change)="leer($any($event.target).files?.[0])" /></label>
          </div>
          @if (filas().length) {
            <div class="vista-previa">
              <table class="tabla">
                <thead><tr><th>Fila</th><th>Insumo</th><th>Unidad</th><th class="num">Stock</th><th class="num">Costo</th><th>Qué pasa</th></tr></thead>
                <tbody>
                  @for (f of filas(); track f.fila) {
                    <tr><td class="ter">{{ f.fila }}</td><td>{{ f.nombre || '—' }}</td><td>{{ f.unidad }}</td><td class="num">{{ num(f.stock) }}</td><td class="num">{{ plata(f.costo) }}</td>
                      <td>@if (f.error) { <span class="etiqueta error">{{ f.error }}</span> } @else if (f.existe) { <span class="etiqueta acento">Actualiza</span> } @else { <span class="etiqueta ok">Nuevo</span> }</td></tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>
        <div class="lateral-pie">
          <button class="btn" (click)="panel.set(null)">Cancelar</button>
          <button class="btn primario" [disabled]="!validas().length" (click)="importar()">Importar {{ validas().length }} insumos</button>
        </div>
      </aside>
    }
  `,
})
export class Inventario {
  protected readonly tienda = inject(Tienda);
  private readonly avisos = inject(Avisos);
  protected readonly busqueda = signal('');
  protected readonly estado = signal<'bajo' | 'sin' | null>(null);
  protected readonly categoria = signal<string | null>(null);
  protected readonly panel = signal<'editar' | 'importar' | null>(null);
  protected readonly filas = signal<FilaInsumo[]>([]);
  protected readonly validas = computed(() => this.filas().filter((f) => !f.error));
  protected form: Insumo = this.vacio();
  protected esNuevo = false;
  protected readonly borrando = signal(false);
  protected contado: number | null = null;
  protected motivo = '';

  protected readonly categorias = computed(() => [...new Set(this.tienda.estado().insumos.map((i) => i.categoria))].sort());
  protected readonly filtrados = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    return this.tienda.estado().insumos
      .filter((i) => (!q || i.nombre.toLowerCase().includes(q)) && (!this.estado() || estadoStock(i) === this.estado()) && (!this.categoria() || i.categoria === this.categoria()))
      .sort((a, b) => orden(estadoStock(a)) - orden(estadoStock(b)) || a.nombre.localeCompare(b.nombre));
  });
  protected readonly valorTotal = computed(() => this.tienda.estado().insumos.reduce((s, i) => s + Math.max(0, i.stock) * i.costo, 0));
  protected readonly cafe = computed(() => {
    const e = this.tienda.estado();
    const i = this.tienda.insumoCafe();
    if (!i) return null;
    const hasta = Date.now();
    const desde = hasta - 14 * 86_400_000;
    const f = filtrosVacios(desde, hasta);
    const usados = kilosCafe(e.ventas.filter((v) => !v.anulada && v.fecha >= desde), f, e.productos, i.id);
    const porDia = Math.round((usados / 12) * 100) / 100; // 12 días abiertos en 2 semanas
    const dias = porDia > 0 ? Math.floor(i.stock / porDia) : 99;
    return { stock: i.stock, tazas: Math.round(i.stock * 80), porDia, dias, bajo: i.stock <= i.minimo, porcentaje: Math.min(100, (i.stock / (i.minimo * 3 || 1)) * 100) };
  });
  protected readonly movimientos = computed(() => this.tienda.estado().movimientos.filter((m) => m.insumoId === this.form.id).sort((a, b) => b.fecha - a.fecha).slice(0, 12));

  protected readonly estadoStock = estadoStock;
  protected readonly plata = plata;
  protected readonly num = num;
  protected readonly fechaHora = fechaHora;
  protected readonly cantidadConUnidad = cantidadConUnidad;
  protected readonly iSubir = Upload;
  protected readonly iBajar = Download;
  protected readonly iMas = Plus;
  protected readonly iBuscar = Search;
  protected readonly iEditar = Pencil;
  protected readonly iX = X;
  protected readonly iBorrar = Trash2;
  protected readonly iOk = CircleCheck;
  protected readonly iAlerta = TriangleAlert;
  protected readonly iSin = CircleX;
  protected readonly iCafe = Coffee;
  protected readonly iHistorial = History;
  protected readonly iInfo = CircleAlert;

  cuentaEstado(e: 'bajo' | 'sin') {
    return this.tienda.estado().insumos.filter((i) => estadoStock(i) === e).length;
  }

  private vacio(): Insumo {
    return { id: nuevoId('i'), nombre: '', categoria: 'Almacén', unidad: 'u', stock: 0, minimo: 0, costo: 0 };
  }

  nuevo() {
    this.form = this.vacio();
    this.esNuevo = true;
    this.panel.set('editar');
  }

  editar(i: Insumo) {
    this.form = { ...i };
    this.esNuevo = false;
    this.contado = null;
    this.motivo = '';
    this.borrando.set(false);
    this.panel.set('editar');
  }

  borrar() {
    this.tienda.borrarInsumo(this.form.id);
    this.borrando.set(false);
    this.avisos.mostrar(`${this.form.nombre} borrado`);
    this.panel.set(null);
  }

  guardar() {
    const actual = this.tienda.estado().insumos.find((x) => x.id === this.form.id);
    this.tienda.guardarInsumo({ ...this.form, stock: actual && !this.esNuevo ? actual.stock : this.form.stock });
    this.avisos.mostrar(`${this.form.nombre} guardado`);
    this.panel.set(null);
  }

  ajustar() {
    if (this.contado === null) return;
    this.tienda.ajustarStock(this.form.id, this.contado, this.motivo);
    this.form.stock = this.contado;
    this.avisos.mostrar('Conteo guardado. Quedó registrado el ajuste.');
    this.contado = null;
    this.motivo = '';
  }

  abrirImportar() {
    this.filas.set([]);
    this.panel.set('importar');
  }

  async leer(archivo: File | undefined) {
    if (!archivo) return;
    try {
      const datos = await leerPlanilla(archivo);
      const existentes = this.tienda.estado().insumos;
      const val = (f: Record<string, unknown>, k: string) => {
        const key = Object.keys(f).find((x) => x.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim() === k);
        return key ? f[key] : '';
      };
      const n = (v: unknown) => (typeof v === 'number' ? v : Number(String(v).replace(/[$\s.]/g, '').replace(',', '.')) || 0);
      this.filas.set(datos.map((f, k) => {
        const nombre = String(val(f, 'insumo') || val(f, 'nombre')).trim();
        const unidadTxt = String(val(f, 'unidad')).trim().toLowerCase();
        const unidad: Unidad = unidadTxt.startsWith('k') ? 'kg' : unidadTxt.startsWith('l') ? 'L' : 'u';
        return {
          fila: k + 2, nombre, categoria: String(val(f, 'categoria')).trim() || 'Almacén', unidad,
          stock: n(val(f, 'stock')), minimo: n(val(f, 'minimo')), costo: Math.round(n(val(f, 'costo'))),
          error: nombre ? null : 'Falta el nombre', existe: existentes.some((i) => i.nombre.toLowerCase() === nombre.toLowerCase()),
        };
      }));
    } catch {
      this.avisos.mostrar('No se pudo leer el archivo. Guardalo como .xlsx o .csv y probá de nuevo.', 'error');
    }
  }

  importar() {
    for (const f of this.validas()) {
      const ya = this.tienda.estado().insumos.find((i) => i.nombre.toLowerCase() === f.nombre.toLowerCase());
      this.tienda.guardarInsumo({ id: ya?.id ?? nuevoId('i'), nombre: f.nombre, categoria: f.categoria, unidad: f.unidad, stock: f.stock, minimo: f.minimo, costo: f.costo });
    }
    this.avisos.mostrar(`${this.validas().length} insumos importados`);
    this.panel.set(null);
  }

  plantilla() {
    descargarPlanilla('planilla-insumos.xlsx', [{ nombre: 'Insumos', filas: [
      { Insumo: 'Café en grano', Categoría: 'Cafetería', Unidad: 'kg', Stock: 5, Mínimo: 4, Costo: 28000 },
      { Insumo: 'Leche entera', Categoría: 'Lácteos', Unidad: 'L', Stock: 20, Mínimo: 12, Costo: 1450 },
      { Insumo: 'Medialunas', Categoría: 'Panadería', Unidad: 'u', Stock: 48, Mínimo: 24, Costo: 520 },
    ] }]);
  }

  exportar() {
    descargarPlanilla('inventario.xlsx', [{ nombre: 'Inventario', filas: this.tienda.estado().insumos.map((i) => ({
      Insumo: i.nombre, Categoría: i.categoria, Unidad: i.unidad, Stock: i.stock, Mínimo: i.minimo, Costo: i.costo,
    })) }]);
  }
}

function orden(e: string) {
  return e === 'sin' ? 0 : e === 'bajo' ? 1 : 2;
}

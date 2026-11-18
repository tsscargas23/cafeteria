import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { Avisos } from '../core/avisos';
import { descargarPlanilla, leerPlanilla } from '../core/excel';
import { plata } from '../core/formato';
import { CircleAlert, Download, FileSpreadsheet, Pencil, Percent, Plus, Search, Trash2, Upload, X } from '../core/iconos';
import { DondeSeVende, Producto } from '../core/modelos';
import { aplicarAumento, FilaImportada, revisarImportacion } from '../core/reglas';
import { nuevoId, Tienda } from '../core/tienda';

type Panel = null | 'editar' | 'aumento' | 'importar';

@Component({
  selector: 'app-productos',
  imports: [FormsModule, LucideAngularModule],
  styles: `
    .precios { display: flex; flex-wrap: wrap; gap: 4px; }
    .precio { display: inline-flex; gap: 6px; padding: 2px 8px; border-radius: var(--r-sm); background: var(--surface-2); font-size: var(--fs-sm); font-variant-numeric: tabular-nums; b { font-weight: 650; } }
    .nombre-prod { font-weight: 650; }
    .variante { display: grid; grid-template-columns: 1fr 130px auto; gap: 8px; align-items: end; padding: 10px; border: 1px solid var(--border); border-radius: var(--r); }
    .receta { grid-column: 1 / -1; display: flex; flex-direction: column; gap: 6px; }
    .linea-receta { display: grid; grid-template-columns: 1fr 110px auto; gap: 6px; align-items: center; }
    .vista-previa { max-height: 340px; overflow: auto; border: 1px solid var(--border); border-radius: var(--r); }
    .contador { font-variant-numeric: tabular-nums; }
    .pausado td:not(.acciones-td) { opacity: 0.6; }
  `,
  template: `
    <div class="pagina">
      <div class="pagina-cab">
        <div class="titulo"><h1>Productos</h1><p>Lo que vendés, con sus tamaños y precios. Si algo no hay por hoy, pausalo en vez de borrarlo.</p></div>
        <div class="acciones">
          <button class="btn" (click)="abrirImportar()"><lucide-icon [img]="iSubir" [size]="18" />Importar Excel</button>
          <button class="btn" (click)="exportar()"><lucide-icon [img]="iBajar" [size]="18" />Exportar</button>
          <button class="btn" (click)="abrirAumento()"><lucide-icon [img]="iPorcentaje" [size]="18" />Aumentar precios</button>
          <button class="btn primario" (click)="nuevo()"><lucide-icon [img]="iMas" [size]="18" />Nuevo producto</button>
        </div>
      </div>

      <div class="barra-filtros">
        <label class="buscador"><lucide-icon [img]="iBuscar" [size]="17" /><input class="input" placeholder="Buscar por nombre" [ngModel]="busqueda()" (ngModelChange)="busqueda.set($event)" /></label>
        <button class="chip" [class.activo]="categoria() === null" (click)="categoria.set(null)">Todas</button>
        @for (c of tienda.estado().categorias; track c) {
          <button class="chip" [class.activo]="categoria() === c" (click)="categoria.set(c)">{{ c }}</button>
        }
        <select class="input chico" style="width:auto;margin-left:auto" [ngModel]="estadoFiltro()" (ngModelChange)="estadoFiltro.set($event)" aria-label="Filtrar por estado">
          <option value="todos">Activos y pausados</option><option value="activos">Solo activos</option><option value="pausados">Solo «Hoy no hay»</option>
        </select>
      </div>

      <section class="panel">
        <div class="tabla-envoltura">
          <table class="tabla">
            <thead><tr><th>Producto</th><th>Categoría</th><th>Tamaños y precios</th><th>Dónde se vende</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              @for (p of filtrados(); track p.id) {
                <tr class="clic" [class.pausado]="!p.activo" (click)="editar(p)">
                  <td><div class="nombre-prod">{{ p.nombre }}</div>@if (p.descripcion) { <div class="ter">{{ p.descripcion }}</div> }</td>
                  <td class="sec">{{ p.categoria }}</td>
                  <td><div class="precios">@for (v of p.variantes; track v.id) { <span class="precio">{{ v.nombre }} <b>{{ plata(v.precio) }}</b></span> }</div></td>
                  <td class="sec">{{ textoDonde(p.dondeSeVende) }}</td>
                  <td>
                    <label class="interruptor" (click)="$event.stopPropagation()">
                      <input type="checkbox" [checked]="p.activo" (change)="alternar(p, $any($event.target).checked)" [attr.aria-label]="'Disponible: ' + p.nombre" />
                      <span [class]="p.activo ? 'etiqueta ok' : 'etiqueta atencion'">{{ p.activo ? 'Disponible' : 'Hoy no hay' }}</span>
                    </label>
                  </td>
                  <td class="acciones-td"><button class="btn icono chico fantasma" (click)="$event.stopPropagation(); editar(p)" [attr.aria-label]="'Editar ' + p.nombre"><lucide-icon [img]="iEditar" [size]="16" /></button></td>
                </tr>
              } @empty {
                <tr><td colspan="6"><div class="vacio"><h3>No hay productos con esos filtros</h3><p>Probá con otra categoría o borrá la búsqueda.</p></div></td></tr>
              }
            </tbody>
          </table>
        </div>
      </section>
      <p class="ter">{{ filtrados().length }} de {{ tienda.estado().productos.length }} productos.</p>
    </div>

    @if (panel()) {
      <div class="lateral-fondo" (click)="panel.set(null)"></div>
      @switch (panel()) {
        @case ('editar') {
          <aside class="lateral" role="dialog" aria-label="Editar producto">
            <div class="lateral-cab"><h2>{{ esNuevo ? 'Nuevo producto' : 'Editar producto' }}</h2><button class="btn icono fantasma" (click)="panel.set(null)" aria-label="Cerrar"><lucide-icon [img]="iX" [size]="20" /></button></div>
            <div class="lateral-cuerpo">
              <label class="campo"><span>Nombre</span><input class="input" [(ngModel)]="form.nombre" [class.invalido]="intento && !form.nombre.trim()" /></label>
              <div class="grilla-2">
                <label class="campo"><span>Categoría</span>
                  <select class="input" [(ngModel)]="form.categoria">
                    @for (c of tienda.estado().categorias; track c) { <option [value]="c">{{ c }}</option> }
                    <option value="__nueva">+ Nueva categoría…</option>
                  </select>
                </label>
                <label class="campo"><span>Dónde se vende</span>
                  <select class="input" [(ngModel)]="form.dondeSeVende"><option value="ambos">En el local y online</option><option value="local">Solo en el local</option><option value="online">Solo online</option></select>
                </label>
              </div>
              @if (form.categoria === '__nueva') {
                <label class="campo"><span>Nombre de la categoría nueva</span><input class="input" [(ngModel)]="categoriaNueva" placeholder="Ej.: Desayunos" /></label>
              }
              <label class="campo"><span>Descripción (sale en la carta)</span><input class="input" [(ngModel)]="form.descripcion" /></label>
              <div class="fila">
                <label class="interruptor"><input type="checkbox" [(ngModel)]="form.activo" />Disponible para vender</label>
                <label class="interruptor"><input type="checkbox" [(ngModel)]="form.esCafe" />Cuenta como café en los reportes</label>
              </div>

              <div class="separador"></div>
              <div class="fila"><h3>Tamaños y precios</h3><button class="btn chico" style="margin-left:auto" (click)="sumarVariante()"><lucide-icon [img]="iMas" [size]="15" />Agregar tamaño</button></div>
              @for (v of form.variantes; track v.id; let k = $index) {
                <div class="variante">
                  <label class="campo"><span>Tamaño o presentación</span><input class="input" [(ngModel)]="v.nombre" placeholder="Ej.: Chico, Porción, Docena" /></label>
                  <label class="campo"><span>Precio</span><span class="input-plata"><input class="input" type="number" min="0" [(ngModel)]="v.precio" /></span></label>
                  <button class="btn icono fantasma" [disabled]="form.variantes.length === 1" (click)="quitarVariante(k)" aria-label="Quitar tamaño"><lucide-icon [img]="iBorrar" [size]="17" /></button>
                  <div class="receta">
                    <span class="ter">Qué gasta del inventario (opcional, para descontar stock)</span>
                    @for (r of v.receta; track $index; let j = $index) {
                      <div class="linea-receta">
                        <select class="input chico" [(ngModel)]="r.insumoId">
                          @for (i of tienda.estado().insumos; track i.id) { <option [value]="i.id">{{ i.nombre }} ({{ i.unidad }})</option> }
                        </select>
                        <input class="input chico" type="number" step="0.001" min="0" [(ngModel)]="r.cantidad" aria-label="Cantidad" />
                        <button class="btn icono chico fantasma" (click)="v.receta.splice(j, 1)" aria-label="Quitar"><lucide-icon [img]="iX" [size]="15" /></button>
                      </div>
                    }
                    <button class="btn chico fantasma" style="align-self:flex-start" (click)="v.receta.push({ insumoId: tienda.estado().insumos[0].id, cantidad: 1 })"><lucide-icon [img]="iMas" [size]="14" />Agregar insumo</button>
                  </div>
                </div>
              }
              @if (intento && error()) { <p class="aviso-linea atencion">{{ error() }}</p> }
            </div>
            <div class="lateral-pie">
              @if (borrando()) {
                <span class="sec confirmar">¿Borrar {{ form.nombre }}? No se puede deshacer.</span>
                <button class="btn" (click)="borrando.set(false)">No</button>
                <button class="btn peligro" (click)="borrar()">Sí, borrar</button>
              } @else {
                @if (!esNuevo) { <button class="btn peligro izquierda" (click)="borrando.set(true)"><lucide-icon [img]="iBorrar" [size]="17" />Borrar</button> }
                <button class="btn" (click)="panel.set(null)">Cancelar</button>
                <button class="btn primario" (click)="guardar()">Guardar</button>
              }
            </div>
          </aside>
        }

        @case ('aumento') {
          <aside class="lateral" role="dialog" aria-label="Aumentar precios">
            <div class="lateral-cab"><h2>Aumentar precios</h2><button class="btn icono fantasma" (click)="panel.set(null)" aria-label="Cerrar"><lucide-icon [img]="iX" [size]="20" /></button></div>
            <div class="lateral-cuerpo">
              <div class="grilla-2">
                <label class="campo"><span>Porcentaje</span><input class="input" type="number" [(ngModel)]="aumento.porcentaje" /></label>
                <label class="campo"><span>Redondear a</span>
                  <select class="input" [(ngModel)]="aumento.redondeo"><option [ngValue]="0">Sin redondear</option><option [ngValue]="50">$ 50</option><option [ngValue]="100">$ 100</option><option [ngValue]="500">$ 500</option></select>
                </label>
              </div>
              <label class="campo"><span>¿A qué productos?</span>
                <select class="input" [(ngModel)]="aumento.categoria"><option [ngValue]="null">A toda la carta</option>@for (c of tienda.estado().categorias; track c) { <option [ngValue]="c">Solo {{ c }}</option> }</select>
              </label>
              <h3>Así quedarían</h3>
              <div class="vista-previa">
                <table class="tabla">
                  <thead><tr><th>Producto</th><th class="num">Ahora</th><th class="num">Nuevo</th></tr></thead>
                  <tbody>
                    @for (f of previaAumento(); track $index) { <tr><td>{{ f.nombre }}</td><td class="num sec">{{ plata(f.antes) }}</td><td class="num"><b>{{ plata(f.despues) }}</b></td></tr> }
                  </tbody>
                </table>
              </div>
            </div>
            <div class="lateral-pie">
              <button class="btn" (click)="panel.set(null)">Cancelar</button>
              <button class="btn primario" [disabled]="!aumento.porcentaje" (click)="aplicarAumento()">Aplicar a {{ previaAumento().length }} precios</button>
            </div>
          </aside>
        }

        @case ('importar') {
          <aside class="lateral ancho" role="dialog" aria-label="Importar desde Excel">
            <div class="lateral-cab"><h2>Importar desde Excel</h2><button class="btn icono fantasma" (click)="panel.set(null)" aria-label="Cerrar"><lucide-icon [img]="iX" [size]="20" /></button></div>
            <div class="lateral-cuerpo">
              <p class="sec">Cargá muchos productos de una vez. La planilla necesita las columnas <b>Producto</b>, <b>Categoría</b>, <b>Tamaño</b> y <b>Precio</b>. Si el producto y el tamaño ya existen, se actualiza el precio; no se duplica nada.</p>
              <div class="fila">
                <button class="btn" (click)="bajarPlantilla()"><lucide-icon [img]="iPlanilla" [size]="18" />Bajar planilla de ejemplo</button>
                <label class="btn primario"><lucide-icon [img]="iSubir" [size]="18" />Elegir archivo<input type="file" accept=".xlsx,.xls,.csv" hidden (change)="leer($any($event.target).files?.[0])" /></label>
              </div>
              @if (filas().length) {
                <div class="fila">
                  <span class="etiqueta ok contador">{{ cuenta('nuevo') }} nuevos</span>
                  <span class="etiqueta acento contador">{{ cuenta('actualiza') }} actualizan precio</span>
                  @if (cuenta('error')) { <span class="etiqueta error contador">{{ cuenta('error') }} con errores (no se importan)</span> }
                </div>
                <div class="vista-previa">
                  <table class="tabla">
                    <thead><tr><th>Fila</th><th>Producto</th><th>Categoría</th><th>Tamaño</th><th class="num">Precio</th><th>Qué pasa</th></tr></thead>
                    <tbody>
                      @for (f of filas(); track f.fila) {
                        <tr>
                          <td class="ter">{{ f.fila }}</td><td>{{ f.producto || '—' }}</td><td class="sec">{{ f.categoria || '—' }}</td><td>{{ f.tamano }}</td>
                          <td class="num">{{ f.precio !== null ? plata(f.precio) : '—' }}</td>
                          <td>
                            @if (f.accion === 'error') { <span class="etiqueta error"><lucide-icon [img]="iAlerta" [size]="12" />{{ f.error }}</span> }
                            @else if (f.accion === 'nuevo') { <span class="etiqueta ok">Nuevo</span> }
                            @else { <span class="etiqueta acento">Actualiza precio</span> }
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
            </div>
            <div class="lateral-pie">
              <button class="btn" (click)="panel.set(null)">Cancelar</button>
              <button class="btn primario" [disabled]="!(cuenta('nuevo') + cuenta('actualiza'))" (click)="importar()">Importar {{ cuenta('nuevo') + cuenta('actualiza') }} filas</button>
            </div>
          </aside>
        }
      }
    }
  `,
})
export class Productos {
  protected readonly tienda = inject(Tienda);
  private readonly avisos = inject(Avisos);

  protected readonly busqueda = signal('');
  protected readonly categoria = signal<string | null>(null);
  protected readonly estadoFiltro = signal<'todos' | 'activos' | 'pausados'>('todos');
  protected readonly panel = signal<Panel>(null);
  protected readonly filas = signal<FilaImportada[]>([]);

  protected form: Producto = vacio();
  protected esNuevo = false;
  protected intento = false;
  protected readonly borrando = signal(false);
  protected categoriaNueva = '';
  protected aumento = { porcentaje: 10, redondeo: 100, categoria: null as string | null };

  protected readonly filtrados = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    const est = this.estadoFiltro();
    return this.tienda.estado().productos.filter((p) =>
      (!this.categoria() || p.categoria === this.categoria()) &&
      (!q || p.nombre.toLowerCase().includes(q)) &&
      (est === 'todos' || (est === 'activos' ? p.activo : !p.activo)));
  });

  protected readonly plata = plata;
  protected readonly iSubir = Upload;
  protected readonly iBajar = Download;
  protected readonly iPorcentaje = Percent;
  protected readonly iMas = Plus;
  protected readonly iBuscar = Search;
  protected readonly iEditar = Pencil;
  protected readonly iX = X;
  protected readonly iBorrar = Trash2;
  protected readonly iPlanilla = FileSpreadsheet;
  protected readonly iAlerta = CircleAlert;

  textoDonde(d: DondeSeVende) {
    return { ambos: 'Local y online', local: 'Solo local', online: 'Solo online' }[d];
  }

  alternar(p: Producto, activo: boolean) {
    this.tienda.cambiarActivo(p.id, activo);
    this.avisos.mostrar(activo ? `${p.nombre}: disponible` : `${p.nombre}: «Hoy no hay». No aparece para vender ni en la carta.`, 'info');
  }

  nuevo() {
    this.form = vacio(this.categoria() ?? this.tienda.estado().categorias[0]);
    this.esNuevo = true;
    this.intento = false;
    this.panel.set('editar');
  }

  editar(p: Producto) {
    this.form = structuredClone(p);
    this.esNuevo = false;
    this.intento = false;
    this.borrando.set(false);
    this.panel.set('editar');
  }

  borrar() {
    const error = this.tienda.borrarProducto(this.form.id);
    this.borrando.set(false);
    if (error) {
      this.avisos.mostrar(error, 'error');
      return;
    }
    this.avisos.mostrar(`${this.form.nombre} borrado`);
    this.panel.set(null);
  }

  sumarVariante() {
    this.form.variantes.push({ id: nuevoId('va'), nombre: '', precio: 0, receta: [] });
  }

  quitarVariante(k: number) {
    this.form.variantes.splice(k, 1);
  }

  error(): string {
    if (!this.form.nombre.trim()) return 'Falta el nombre del producto.';
    if (this.form.categoria === '__nueva' && !this.categoriaNueva.trim()) return 'Escribí el nombre de la categoría nueva.';
    if (this.form.variantes.some((v) => !v.nombre.trim() || !(v.precio > 0))) return 'Cada tamaño necesita nombre y un precio mayor a cero.';
    return '';
  }

  guardar() {
    this.intento = true;
    if (this.error()) return;
    if (this.form.categoria === '__nueva') this.form.categoria = this.categoriaNueva.trim();
    this.form.nombre = this.form.nombre.trim();
    this.tienda.guardarProducto(this.form);
    this.avisos.mostrar(this.esNuevo ? `${this.form.nombre} agregado` : `${this.form.nombre} guardado`);
    this.panel.set(null);
  }

  abrirAumento() {
    this.aumento = { porcentaje: 10, redondeo: 100, categoria: this.categoria() };
    this.panel.set('aumento');
  }

  previaAumento() {
    return this.tienda.estado().productos
      .filter((p) => !this.aumento.categoria || p.categoria === this.aumento.categoria)
      .flatMap((p) => p.variantes.map((v) => ({
        nombre: p.variantes.length > 1 ? `${p.nombre} · ${v.nombre}` : p.nombre,
        antes: v.precio,
        despues: aplicarAumento(v.precio, this.aumento.porcentaje || 0, this.aumento.redondeo),
      })));
  }

  aplicarAumento() {
    const n = this.tienda.aumentarPrecios(this.aumento.porcentaje, this.aumento.categoria, this.aumento.redondeo);
    this.avisos.mostrar(`Listo: ${n} precios aumentaron ${this.aumento.porcentaje} %`);
    this.panel.set(null);
  }

  abrirImportar() {
    this.filas.set([]);
    this.panel.set('importar');
  }

  async leer(archivo: File | undefined) {
    if (!archivo) return;
    try {
      this.filas.set(revisarImportacion(await leerPlanilla(archivo), this.tienda.estado().productos));
    } catch {
      this.avisos.mostrar('No se pudo leer el archivo. Guardalo como .xlsx o .csv y probá de nuevo.', 'error');
    }
  }

  cuenta(accion: FilaImportada['accion']) {
    return this.filas().filter((f) => f.accion === accion).length;
  }

  importar() {
    const r = this.tienda.importarProductos(this.filas());
    this.avisos.mostrar(`Importado: ${r.nuevos} tamaños nuevos y ${r.actualizados} precios actualizados`);
    this.panel.set(null);
  }

  bajarPlantilla() {
    descargarPlanilla('planilla-productos.xlsx', [{
      nombre: 'Productos',
      filas: [
        { Producto: 'Café', Categoría: 'Cafetería', Tamaño: 'Chico', Precio: 2600 },
        { Producto: 'Café', Categoría: 'Cafetería', Tamaño: 'Grande', Precio: 3400 },
        { Producto: 'Licuado de banana', Categoría: 'Bebidas', Tamaño: 'Vaso', Precio: 4500 },
        { Producto: 'Alfajor de maicena', Categoría: 'Pastelería', Tamaño: 'Unidad', Precio: 1500 },
      ],
    }]);
  }

  exportar() {
    descargarPlanilla('productos.xlsx', [{
      nombre: 'Productos',
      filas: this.tienda.estado().productos.flatMap((p) => p.variantes.map((v) => ({
        Producto: p.nombre, Categoría: p.categoria, Tamaño: v.nombre, Precio: v.precio, 'Dónde se vende': this.textoDonde(p.dondeSeVende), Estado: p.activo ? 'Disponible' : 'Hoy no hay',
      }))),
    }]);
  }
}

function vacio(categoria = 'Cafetería'): Producto {
  return {
    id: nuevoId('p'), nombre: '', categoria, descripcion: '', dondeSeVende: 'ambos', activo: true, esCafe: categoria === 'Cafetería',
    variantes: [{ id: nuevoId('va'), nombre: 'Único', precio: 0, receta: [] }],
  };
}

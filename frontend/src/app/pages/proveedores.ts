import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { Avisos } from '../core/avisos';
import { descargarPlanilla, leerPlanilla } from '../core/excel';
import { cantidadConUnidad, fecha, num, plata } from '../core/formato';
import { CircleAlert, FileSpreadsheet, MessageCircle, Pencil, Plus, Search, Trash2, TriangleAlert, Truck, Upload, Wallet, X } from '../core/iconos';
import { MEDIOS_PAGO, MedioPago, Proveedor } from '../core/modelos';
import { FilaProveedor, revisarImportacionProveedores } from '../core/reglas';
import { nuevoId, Tienda } from '../core/tienda';

interface FilaCompra { insumoId: string; cantidad: number | null; precio: number; anterior: number | null }

@Component({
  selector: 'app-proveedores',
  imports: [FormsModule, LucideAngularModule],
  styles: `
    .lista { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px; }
    .prov { display: flex; flex-direction: column; gap: 10px; padding: 16px; cursor: pointer; transition: border-color 0.15s, box-shadow 0.15s;
      &:hover { border-color: var(--border-strong); box-shadow: var(--shadow-2); }
      .cab { display: flex; align-items: flex-start; gap: 10px; h3 { flex: 1; } }
      .trae { display: flex; flex-wrap: wrap; gap: 4px; }
      .pie { display: flex; align-items: center; gap: 8px; margin-top: auto; padding-top: 8px; border-top: 1px solid var(--border); font-size: var(--fs-sm); } }
    .compra-fila { display: grid; grid-template-columns: minmax(0, 1fr) 120px 140px 110px auto; gap: 8px; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--border); }
    .compra-cab { font-size: var(--fs-sm); color: var(--text-2); font-weight: 600; padding-bottom: 6px; border-bottom: 1px solid var(--border-strong); }
    .total-compra { display: flex; justify-content: space-between; align-items: baseline; font-size: 24px; font-weight: 750; font-variant-numeric: tabular-nums; span { font-size: var(--fs-sm); color: var(--text-2); font-weight: 600; } }
    .subio { color: var(--warn); font-size: var(--fs-xs); font-weight: 650; display: flex; align-items: center; gap: 3px; }
    .hist { display: grid; grid-template-columns: 80px 1fr auto auto; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--border); font-size: var(--fs-sm); font-variant-numeric: tabular-nums; align-items: center; }
  `,
  template: `
    <div class="pagina">
      <div class="pagina-cab">
        <div class="titulo"><h1>Proveedores</h1><p>Cargá lo que te trae cada uno: se suma solo al inventario y queda anotado cuánto le debés.</p></div>
        <div class="acciones">
          <button class="btn" (click)="abrirImportar()"><lucide-icon [img]="iSubir" [size]="18" />Importar Excel</button>
          <button class="btn" (click)="nuevo()"><lucide-icon [img]="iMas" [size]="18" />Nuevo proveedor</button>
          <button class="btn primario" (click)="abrirCompra(null)"><lucide-icon [img]="iCamion" [size]="18" />Cargar compra</button>
        </div>
      </div>

      <div class="barra-filtros">
        <label class="buscador"><lucide-icon [img]="iBuscar" [size]="17" /><input class="input" placeholder="Buscar proveedor o producto" [ngModel]="busqueda()" (ngModelChange)="busqueda.set($event)" /></label>
        <span class="ter" style="margin-left:auto">Le debés en total: <b>{{ plata(deudaTotal()) }}</b></span>
      </div>

      <div class="lista">
        @for (p of filtrados(); track p.id) {
          @let saldo = tienda.saldoProveedor(p.id);
          <article class="panel prov" (click)="verFicha(p)" tabindex="0" (keydown.enter)="verFicha(p)">
            <div class="cab">
              <h3>{{ p.nombre }}</h3>
              @if (saldo > 0) { <span class="etiqueta atencion">Debés {{ plata(saldo) }}</span> } @else { <span class="etiqueta ok">Al día</span> }
            </div>
            <div class="trae">@for (t of p.trae; track t.insumoId) { <span class="etiqueta">{{ nombreInsumo(t.insumoId) }}</span> }</div>
            <div class="ter">Entrega: {{ p.diasEntrega || '—' }} · {{ p.contacto }}</div>
            <div class="pie">
              <span class="ter">Última compra: {{ ultimaCompra(p.id) }}</span>
              <button class="btn chico" style="margin-left:auto" (click)="$event.stopPropagation(); abrirCompra(p.id)"><lucide-icon [img]="iCamion" [size]="15" />Cargar compra</button>
            </div>
          </article>
        }
      </div>
    </div>

    @if (panel()) {
      <div class="lateral-fondo" (click)="panel.set(null)"></div>
    }

    @if (panel() === 'compra') {
      <aside class="lateral ancho" role="dialog" aria-label="Cargar compra">
        <div class="lateral-cab"><h2>Cargar compra</h2><button class="btn icono fantasma" (click)="panel.set(null)" aria-label="Cerrar"><lucide-icon [img]="iX" [size]="20" /></button></div>
        <div class="lateral-cuerpo">
          <div class="grilla-2">
            <label class="campo"><span>Proveedor</span>
              <select class="input" [ngModel]="compraProv()" (ngModelChange)="elegirProveedor($event)">
                <option [ngValue]="null" disabled>Elegí un proveedor</option>
                @for (p of tienda.estado().proveedores; track p.id) { <option [ngValue]="p.id">{{ p.nombre }}</option> }
              </select>
            </label>
            <label class="campo"><span>Remito o factura (opcional)</span><input class="input" [(ngModel)]="comprobante" placeholder="Ej.: Remito 0001-2290" /></label>
          </div>
          @if (compraProv()) {
            <p class="sec">Aparecen los productos que te trae siempre, con el último precio. Poné solo las cantidades.</p>
            <div>
              <div class="compra-fila compra-cab"><span>Producto</span><span>Cantidad</span><span>Precio por unidad</span><span class="num" style="text-align:right">Subtotal</span><span></span></div>
              @for (f of filasCompra; track $index; let k = $index) {
                <div class="compra-fila">
                  <span>
                    @if (f.anterior !== null) { <b>{{ nombreInsumo(f.insumoId) }}</b> }
                    @else {
                      <select class="input chico" [(ngModel)]="f.insumoId" (ngModelChange)="f.precio = costoDe($event)">
                        @for (i of tienda.estado().insumos; track i.id) { <option [value]="i.id">{{ i.nombre }}</option> }
                      </select>
                    }
                    @if (f.anterior && f.precio > f.anterior * 1.1) { <span class="subio"><lucide-icon [img]="iAlerta" [size]="12" />Subió {{ subio(f) }} % desde la última vez</span> }
                  </span>
                  <span class="fila" style="gap:4px;flex-wrap:nowrap"><input class="input chico" type="number" min="0" step="any" [(ngModel)]="f.cantidad" placeholder="0" /><span class="ter">{{ unidadDe(f.insumoId) }}</span></span>
                  <span class="input-plata"><input class="input chico" type="number" min="0" [(ngModel)]="f.precio" /></span>
                  <span class="num" style="text-align:right">{{ plata((f.cantidad || 0) * f.precio) }}</span>
                  <button class="btn icono chico fantasma" (click)="filasCompra.splice(k, 1)" aria-label="Quitar fila"><lucide-icon [img]="iBorrar" [size]="15" /></button>
                </div>
              }
              <button class="btn chico fantasma" style="margin-top:8px" (click)="filasCompra.push({ insumoId: tienda.estado().insumos[0].id, cantidad: null, precio: tienda.estado().insumos[0].costo, anterior: null })"><lucide-icon [img]="iMas" [size]="15" />Agregar otro producto</button>
            </div>
            <div class="total-compra"><span>Total de la compra</span>{{ plata(totalCompra()) }}</div>
            <div class="separador"></div>
            <h3>¿Cuánto le pagás ahora?</h3>
            <div class="grilla-2">
              <label class="campo"><span>Monto pagado</span><span class="input-plata"><input class="input" type="number" min="0" [(ngModel)]="pagoMonto" /></span>
                <small>Si pagás menos, el resto queda a deber.</small></label>
              <label class="campo"><span>Cómo</span><select class="input" [(ngModel)]="pagoMedio">@for (m of medios; track m.id) { <option [value]="m.id">{{ m.nombre }}</option> }</select></label>
            </div>
            <div class="fila">
              <button class="btn chico" (click)="pagoMonto = totalCompra()">Pago todo</button>
              <button class="btn chico" (click)="pagoMonto = 0">No pago ahora</button>
              @if (pagoMedio === 'efectivo') { <label class="check" style="margin-left:auto"><input type="checkbox" [(ngModel)]="deCaja" />Sale de la caja del turno</label> }
            </div>
          } @else {
            <div class="vacio"><lucide-icon [img]="iCamion" [size]="28" /><h3>Elegí el proveedor</h3><p>Vas a ver lo que te trae siempre, listo para poner cantidades.</p></div>
          }
        </div>
        <div class="lateral-pie">
          <button class="btn" (click)="panel.set(null)">Cancelar</button>
          <button class="btn primario" [disabled]="!totalCompra()" (click)="guardarCompra()">Guardar compra y sumar al stock</button>
        </div>
      </aside>
    }

    @if (panel() === 'ficha') {
      <aside class="lateral ancho" role="dialog" aria-label="Proveedor">
        <div class="lateral-cab"><h2>{{ form.nombre || 'Nuevo proveedor' }}</h2><button class="btn icono fantasma" (click)="panel.set(null)" aria-label="Cerrar"><lucide-icon [img]="iX" [size]="20" /></button></div>
        <div class="lateral-cuerpo">
          <div class="grilla-2">
            <label class="campo"><span>Nombre</span><input class="input" [(ngModel)]="form.nombre" /></label>
            <label class="campo"><span>Contacto</span><input class="input" [(ngModel)]="form.contacto" /></label>
            <label class="campo"><span>Teléfono / WhatsApp</span><input class="input" [(ngModel)]="form.telefono" /></label>
            <label class="campo"><span>Días de entrega</span><input class="input" [(ngModel)]="form.diasEntrega" /></label>
          </div>
          <label class="campo"><span>Notas</span><input class="input" [(ngModel)]="form.notas" /></label>
          @if (form.telefono) {
            <a class="btn" style="align-self:flex-start" [href]="whatsapp(form.telefono)" target="_blank" rel="noopener"><lucide-icon [img]="iWhatsapp" [size]="17" />Escribirle por WhatsApp</a>
          }
          <div class="separador"></div>
          <h3>Qué te trae</h3>
          <div class="fila" style="gap:6px">
            @for (t of form.trae; track t.insumoId; let k = $index) {
              <span class="chip">{{ nombreInsumo(t.insumoId) }} · {{ plata(t.ultimoPrecio) }}<button class="btn icono chico fantasma" style="width:22px;min-height:22px" (click)="form.trae.splice(k, 1)" aria-label="Quitar"><lucide-icon [img]="iX" [size]="13" /></button></span>
            }
            <select class="input chico" style="width:auto" [ngModel]="''" (ngModelChange)="sumarTrae($event)">
              <option value="" disabled>+ Agregar producto</option>
              @for (i of tienda.estado().insumos; track i.id) { <option [value]="i.id">{{ i.nombre }}</option> }
            </select>
          </div>
          @if (!esNuevo) {
            <div class="separador"></div>
            <div class="fila"><h3>Cuenta con este proveedor</h3>
              @let saldo = tienda.saldoProveedor(form.id);
              <span [class]="saldo > 0 ? 'etiqueta atencion' : 'etiqueta ok'" style="margin-left:auto">{{ saldo > 0 ? 'Le debés ' + plata(saldo) : 'Al día' }}</span>
            </div>
            @if (tienda.saldoProveedor(form.id) > 0) {
              <div class="fila">
                <span class="input-plata" style="width:160px"><input class="input" type="number" min="0" [(ngModel)]="pagoSaldo" placeholder="Monto" /></span>
                <select class="input" style="width:auto" [(ngModel)]="pagoMedio">@for (m of medios; track m.id) { <option [value]="m.id">{{ m.nombre }}</option> }</select>
                <button class="btn" [disabled]="!pagoSaldo" (click)="pagarSaldo()"><lucide-icon [img]="iBilletera" [size]="17" />Registrar pago</button>
              </div>
            }
            <div>
              @for (c of comprasDe(form.id); track c.id) {
                <div class="hist">
                  <span class="ter">{{ fecha(c.fecha) }}</span>
                  <span>{{ resumenCompra(c.items) }}@if (c.comprobante) { <span class="ter">{{ c.items.length ? ' · ' : '' }}{{ c.comprobante }}</span> }</span>
                  <b>{{ plata(c.total) }}</b>
                  @if (pagadoDe(c) >= c.total) { <span class="etiqueta ok">Pagada</span> } @else { <span class="etiqueta atencion">Debe {{ plata(c.total - pagadoDe(c)) }}</span> }
                </div>
              } @empty { <p class="ter">Sin compras todavía.</p> }
            </div>
          }
        </div>
        <div class="lateral-pie">
          @if (!esNuevo) { <button class="btn" style="margin-right:auto" (click)="abrirCompra(form.id)"><lucide-icon [img]="iCamion" [size]="17" />Cargar compra</button> }
          <button class="btn" (click)="panel.set(null)">Cancelar</button>
          <button class="btn primario" [disabled]="!form.nombre.trim()" (click)="guardarProveedor()">Guardar</button>
        </div>
      </aside>
    }

    @if (panel() === 'importar') {
      <aside class="lateral ancho" role="dialog" aria-label="Importar proveedores desde Excel">
        <div class="lateral-cab"><h2>Importar proveedores</h2><button class="btn icono fantasma" (click)="panel.set(null)" aria-label="Cerrar"><lucide-icon [img]="iX" [size]="20" /></button></div>
        <div class="lateral-cuerpo">
          <p class="sec">Cargá muchos proveedores de una vez. La planilla necesita la columna <b>Nombre</b>; <b>Teléfono</b> y <b>Deuda</b> son opcionales. La deuda que les tenías queda anotada como «Saldo del sistema anterior» y se descuenta con «Registrar pago». Los proveedores que ya existen no se tocan.</p>
          <div class="fila">
            <button class="btn" (click)="bajarPlantilla()"><lucide-icon [img]="iPlanilla" [size]="18" />Bajar planilla de ejemplo</button>
            <label class="btn primario"><lucide-icon [img]="iSubir" [size]="18" />Elegir archivo<input type="file" accept=".xlsx,.xls,.csv" hidden (change)="leer($any($event.target).files?.[0])" /></label>
          </div>
          @if (filasImportar().length) {
            <div class="fila">
              <span class="etiqueta ok contador">{{ cuenta('nuevo') }} nuevos</span>
              @if (cuenta('existe')) { <span class="etiqueta contador">{{ cuenta('existe') }} ya existen (no se tocan)</span> }
              @if (cuenta('error')) { <span class="etiqueta error contador">{{ cuenta('error') }} con errores (no se importan)</span> }
            </div>
            <div class="vista-previa">
              <table class="tabla">
                <thead><tr><th>Fila</th><th>Nombre</th><th>Teléfono</th><th class="num">Deuda</th><th>Qué pasa</th></tr></thead>
                <tbody>
                  @for (f of filasImportar(); track f.fila) {
                    <tr>
                      <td class="ter">{{ f.fila }}</td><td>{{ f.nombre || '—' }}</td><td class="sec">{{ f.telefono || '—' }}</td>
                      <td class="num">{{ f.deuda !== null ? plata(f.deuda) : '—' }}</td>
                      <td>
                        @if (f.accion === 'error') { <span class="etiqueta error"><lucide-icon [img]="iError" [size]="12" />{{ f.error }}</span> }
                        @else if (f.accion === 'nuevo') { <span class="etiqueta ok">Nuevo</span> }
                        @else { <span class="etiqueta">Ya existe</span> }
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
          <button class="btn primario" [disabled]="!cuenta('nuevo')" (click)="importar()">Importar {{ cuenta('nuevo') }} proveedores</button>
        </div>
      </aside>
    }
  `,
})
export class Proveedores {
  protected readonly tienda = inject(Tienda);
  private readonly avisos = inject(Avisos);
  protected readonly busqueda = signal('');
  protected readonly panel = signal<'compra' | 'ficha' | 'importar' | null>(null);
  protected readonly filasImportar = signal<FilaProveedor[]>([]);
  protected readonly compraProv = signal<string | null>(null);
  protected filasCompra: FilaCompra[] = [];
  protected comprobante = '';
  protected pagoMonto: number | null = null;
  protected pagoMedio: MedioPago = 'transferencia';
  protected deCaja = true;
  protected pagoSaldo: number | null = null;
  protected form: Proveedor = this.vacio();
  protected esNuevo = false;
  protected readonly medios = MEDIOS_PAGO;

  protected readonly filtrados = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    return this.tienda.estado().proveedores.filter((p) => !q || p.nombre.toLowerCase().includes(q) || p.trae.some((t) => this.nombreInsumo(t.insumoId).toLowerCase().includes(q)));
  });
  protected readonly deudaTotal = computed(() => this.tienda.estado().proveedores.reduce((s, p) => s + this.tienda.saldoProveedor(p.id), 0));

  protected readonly plata = plata;
  protected readonly fecha = fecha;
  protected readonly iMas = Plus;
  protected readonly iCamion = Truck;
  protected readonly iBuscar = Search;
  protected readonly iX = X;
  protected readonly iBorrar = Trash2;
  protected readonly iAlerta = TriangleAlert;
  protected readonly iEditar = Pencil;
  protected readonly iWhatsapp = MessageCircle;
  protected readonly iBilletera = Wallet;
  protected readonly iSubir = Upload;
  protected readonly iPlanilla = FileSpreadsheet;
  protected readonly iError = CircleAlert;

  nombreInsumo(id: string) {
    return this.tienda.estado().insumos.find((i) => i.id === id)?.nombre ?? '—';
  }

  unidadDe(id: string) {
    const u = this.tienda.estado().insumos.find((i) => i.id === id)?.unidad;
    return u === 'u' ? 'u.' : u ?? '';
  }

  costoDe(id: string) {
    return this.tienda.estado().insumos.find((i) => i.id === id)?.costo ?? 0;
  }

  ultimaCompra(provId: string) {
    // El saldo que vino del sistema anterior no es una compra de verdad.
    const c = this.comprasDe(provId).find((x) => x.items.length);
    return c ? fecha(c.fecha) : 'nunca';
  }

  comprasDe(provId: string) {
    return this.tienda.estado().compras.filter((c) => c.proveedorId === provId).sort((a, b) => b.fecha - a.fecha);
  }

  pagadoDe(c: { pagos: { monto: number }[] }) {
    return c.pagos.reduce((s, p) => s + p.monto, 0);
  }

  resumenCompra(items: { insumoId: string; cantidad: number }[]) {
    return items.map((i) => {
      const ins = this.tienda.estado().insumos.find((x) => x.id === i.insumoId);
      return ins ? `${this.nombreInsumo(i.insumoId)} ${cantidadConUnidad(i.cantidad, ins.unidad)}` : '';
    }).join(', ');
  }

  subio(f: FilaCompra) {
    return f.anterior ? Math.round(((f.precio - f.anterior) / f.anterior) * 100) : 0;
  }

  totalCompra() {
    return Math.round(this.filasCompra.reduce((s, f) => s + (f.cantidad || 0) * f.precio, 0));
  }

  abrirCompra(provId: string | null) {
    this.comprobante = '';
    this.pagoMonto = null;
    this.pagoMedio = 'transferencia';
    this.deCaja = true;
    this.elegirProveedor(provId);
    this.panel.set('compra');
  }

  elegirProveedor(provId: string | null) {
    this.compraProv.set(provId);
    const p = this.tienda.estado().proveedores.find((x) => x.id === provId);
    this.filasCompra = (p?.trae ?? []).map((t) => ({ insumoId: t.insumoId, cantidad: null, precio: t.ultimoPrecio, anterior: t.ultimoPrecio }));
  }

  guardarCompra() {
    const prov = this.compraProv();
    if (!prov) return;
    const total = this.totalCompra();
    const pago = this.pagoMonto ?? 0;
    this.tienda.registrarCompra(prov, this.filasCompra.filter((f) => (f.cantidad || 0) > 0).map((f) => ({ insumoId: f.insumoId, cantidad: f.cantidad!, precio: f.precio })), { monto: pago, medio: this.pagoMedio, deCaja: this.deCaja }, this.comprobante);
    const n = this.filasCompra.filter((f) => (f.cantidad || 0) > 0).length;
    this.avisos.mostrar(`Compra guardada: ${n} ${n === 1 ? 'producto sumado' : 'productos sumados'} al inventario.${pago < total ? ' Quedan ' + plata(total - pago) + ' a deber.' : ''}`);
    this.panel.set(null);
  }

  private vacio(): Proveedor {
    return { id: nuevoId('pr'), nombre: '', contacto: '', telefono: '', diasEntrega: '', notas: '', trae: [] };
  }

  nuevo() {
    this.form = this.vacio();
    this.esNuevo = true;
    this.panel.set('ficha');
  }

  verFicha(p: Proveedor) {
    this.form = structuredClone(p);
    this.esNuevo = false;
    this.pagoSaldo = null;
    this.pagoMedio = 'transferencia';
    this.panel.set('ficha');
  }

  sumarTrae(insumoId: string) {
    if (!insumoId || this.form.trae.some((t) => t.insumoId === insumoId)) return;
    this.form.trae.push({ insumoId, ultimoPrecio: this.costoDe(insumoId) });
  }

  guardarProveedor() {
    this.tienda.guardarProveedor(this.form);
    this.avisos.mostrar(`${this.form.nombre} guardado`);
    this.panel.set(null);
  }

  abrirImportar() {
    this.filasImportar.set([]);
    this.panel.set('importar');
  }

  async leer(archivo: File | undefined) {
    if (!archivo) return;
    try {
      this.filasImportar.set(revisarImportacionProveedores(await leerPlanilla(archivo), this.tienda.estado().proveedores));
    } catch {
      this.avisos.mostrar('No se pudo leer el archivo. Guardalo como .xlsx o .csv y probá de nuevo.', 'error');
    }
  }

  cuenta(accion: FilaProveedor['accion']) {
    return this.filasImportar().filter((f) => f.accion === accion).length;
  }

  importar() {
    const r = this.tienda.importarProveedores(this.filasImportar());
    this.avisos.mostrar(`Importados ${r.nuevos} proveedores${r.conDeuda ? `, ${r.conDeuda} con deuda anterior` : ''}`);
    this.panel.set(null);
  }

  bajarPlantilla() {
    descargarPlanilla('planilla-proveedores.xlsx', [{
      nombre: 'Proveedores',
      filas: [
        { Nombre: 'Distribuidora del Centro', Teléfono: '3415550000', Deuda: 25000 },
        { Nombre: 'Lácteos La Vaquita', Teléfono: '', Deuda: 0 },
      ],
    }]);
  }

  pagarSaldo() {
    if (!this.pagoSaldo) return;
    this.tienda.pagarProveedor(this.form.id, this.pagoSaldo, this.pagoMedio, this.pagoMedio === 'efectivo');
    this.avisos.mostrar(`Pago de ${plata(this.pagoSaldo)} registrado`);
    this.pagoSaldo = null;
  }

  whatsapp(tel: string) {
    return `https://wa.me/549${tel.replace(/\D/g, '')}`;
  }

  protected readonly num = num;
}

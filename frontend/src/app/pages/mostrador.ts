import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { Avisos } from '../core/avisos';
import { plata } from '../core/formato';
import { Check, Minus, Plus, Search, Store, Trash2 } from '../core/iconos';
import { LineaVenta, MEDIOS_PAGO, MedioPago, Producto } from '../core/modelos';
import { vuelto } from '../core/reglas';
import { Tienda } from '../core/tienda';
import { Impresion } from '../shared/ticket';

@Component({
  selector: 'app-mostrador',
  imports: [FormsModule, LucideAngularModule, RouterLink],
  styles: `
    :host { display: block; }
    .mostrador { display: grid; grid-template-columns: minmax(0, 1fr) 380px; min-height: calc(100vh - 61px); }
    .catalogo { padding: 20px 24px; display: flex; flex-direction: column; gap: 14px; min-width: 0; }
    .cab { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; .buscador { margin-left: auto; } }
    .categorias { display: flex; gap: 6px; flex-wrap: wrap; }
    .grilla { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 10px; align-content: start; }
    .producto { display: flex; flex-direction: column; gap: 8px; padding: 12px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-lg); box-shadow: var(--shadow-1);
      b { font-size: var(--fs); } .cat { color: var(--text-3); font-size: var(--fs-xs); }
      .tamanos { display: flex; flex-wrap: wrap; gap: 6px; margin-top: auto; }
      .btn { flex: 1 1 auto; flex-direction: column; gap: 0; min-height: 46px; line-height: 1.15; padding: 4px 8px; small { font-weight: 500; color: var(--text-2); font-variant-numeric: tabular-nums; } } }
    .carrito { border-left: 1px solid var(--border); background: var(--surface); position: sticky; top: 61px; height: calc(100vh - 61px); display: flex; flex-direction: column; }
    .carrito-cab { padding: 16px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; }
    .lineas { flex: 1; overflow: auto; padding: 4px 16px; }
    .linea { display: grid; grid-template-columns: auto 1fr auto; gap: 10px; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--border);
      .nombre { font-weight: 600; } .num { font-weight: 650; } }
    .cantidad { display: inline-flex; align-items: center; gap: 6px; b { min-width: 18px; text-align: center; } }
    .pie { border-top: 1px solid var(--border); padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; }
    .total { display: flex; justify-content: space-between; align-items: baseline; font-size: 28px; font-weight: 750; font-variant-numeric: tabular-nums; span { font-size: var(--fs-sm); color: var(--text-2); font-weight: 600; } }
    .medios { display: grid; grid-template-columns: repeat(3, 1fr); button { justify-content: center; padding: 0 6px; white-space: nowrap; font-size: var(--fs-sm); } }
    .vuelto { font-size: 20px; font-weight: 700; font-variant-numeric: tabular-nums; min-height: 40px; display: flex; align-items: center; }
    @media (max-width: 900px) { .mostrador { grid-template-columns: 1fr; } .carrito { position: static; height: auto; border-left: 0; border-top: 1px solid var(--border); } .catalogo { padding: 16px; } }
  `,
  template: `
    <div class="mostrador">
      <section class="catalogo">
        <div class="cab">
          <h1>Mostrador</h1>
          <label class="buscador"><lucide-icon [img]="iBuscar" [size]="17" /><input class="input" placeholder="Buscar producto" [ngModel]="busqueda()" (ngModelChange)="busqueda.set($event)" /></label>
        </div>
        @if (!tienda.turnoAbierto()) {
          <p class="aviso-linea atencion">La caja está cerrada. <a routerLink="/caja">Abrila</a> para poder vender.</p>
        }
        <div class="categorias">
          <button class="chip" [class.activo]="categoria() === null" (click)="categoria.set(null)">Todo</button>
          @for (c of categorias(); track c) { <button class="chip" [class.activo]="categoria() === c" (click)="categoria.set(c)">{{ c }}</button> }
        </div>
        <div class="grilla">
          @for (p of productos(); track p.id) {
            <div class="producto">
              <div><b>{{ p.nombre }}</b><div class="cat">{{ p.categoria }}</div></div>
              <div class="tamanos">
                @for (v of p.variantes; track v.id) {
                  <button class="btn" [disabled]="!tienda.turnoAbierto()" (click)="agregar(p, v.id)">
                    {{ p.variantes.length > 1 ? v.nombre : 'Agregar' }}<small>{{ plata(v.precio) }}</small>
                  </button>
                }
              </div>
            </div>
          } @empty {
            <p class="sec">No hay productos con ese nombre.</p>
          }
        </div>
      </section>

      <aside class="carrito">
        <div class="carrito-cab">
          <h2>Venta</h2>
          @if (lineas().length) { <button class="btn chico fantasma" (click)="lineas.set([])"><lucide-icon [img]="iBorrar" [size]="15" />Vaciar</button> }
        </div>
        <div class="lineas">
          @for (l of lineas(); track $index) {
            <div class="linea">
              <span class="cantidad">
                <button class="btn icono chico" (click)="cambiar($index, -1)" aria-label="Uno menos"><lucide-icon [img]="iMenos" [size]="14" /></button>
                <b class="num">{{ l.cantidad }}</b>
                <button class="btn icono chico" (click)="cambiar($index, 1)" aria-label="Uno más"><lucide-icon [img]="iMas" [size]="14" /></button>
              </span>
              <span class="nombre">{{ l.nombre }}{{ l.variante && l.variante !== 'Unidad' && l.variante !== 'Único' ? ' ' + l.variante.toLowerCase() : '' }}</span>
              <span class="num">{{ plata(l.precio * l.cantidad) }}</span>
            </div>
          } @empty {
            <div class="vacio"><lucide-icon [img]="iLocal" [size]="28" /><h3>Venta para llevar o en la barra</h3><p>Tocá los productos para sumarlos. Para mesas, usá «Mesas».</p></div>
          }
        </div>
        <div class="pie">
          <div class="total"><span>Total</span>{{ plata(total()) }}</div>
          <div class="segmentos medios">
            @for (m of medios(); track m.id) { <button [class.activo]="medio() === m.id" (click)="medio.set(m.id)">{{ m.nombre }}</button> }
          </div>
          @if (medio() === 'efectivo') {
            <div class="grilla-2">
              <label class="campo"><span>Con cuánto paga</span><span class="input-plata"><input class="input" type="number" min="0" step="100" [(ngModel)]="recibido" /></span></label>
              <div class="campo"><span>Vuelto</span><span class="vuelto">{{ plata(vuelto(recibido || 0, total())) }}</span></div>
            </div>
          }
          <button class="btn primario grande bloque" [disabled]="!lineas().length || !tienda.turnoAbierto() || (medio() === 'efectivo' && !!recibido && recibido < total())" (click)="cobrar()">
            <lucide-icon [img]="iCheck" [size]="20" />Cobrar {{ plata(total()) }}
          </button>
        </div>
      </aside>
    </div>
  `,
})
export class Mostrador {
  protected readonly tienda = inject(Tienda);
  private readonly avisos = inject(Avisos);
  private readonly impresion = inject(Impresion);
  protected readonly busqueda = signal('');
  protected readonly categoria = signal<string | null>(null);
  protected readonly lineas = signal<LineaVenta[]>([]);
  protected readonly medio = signal<MedioPago>('efectivo');
  protected recibido: number | null = null;

  protected readonly categorias = computed(() => this.tienda.estado().categorias.filter((c) => this.tienda.productosActivos().some((p) => p.categoria === c)));
  protected readonly productos = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    return this.tienda.productosActivos().filter((p) => (!this.categoria() || p.categoria === this.categoria()) && (!q || p.nombre.toLowerCase().includes(q)));
  });
  protected readonly total = computed(() => this.lineas().reduce((s, l) => s + l.precio * l.cantidad, 0));
  protected readonly medios = computed(() => MEDIOS_PAGO.filter((m) => this.tienda.estado().ajustes.mediosActivos.includes(m.id)));

  protected readonly plata = plata;
  protected readonly vuelto = vuelto;
  protected readonly iBuscar = Search;
  protected readonly iMas = Plus;
  protected readonly iMenos = Minus;
  protected readonly iBorrar = Trash2;
  protected readonly iCheck = Check;
  protected readonly iLocal = Store;

  agregar(p: Producto, varianteId: string) {
    const v = p.variantes.find((x) => x.id === varianteId)!;
    this.lineas.update((ls) => {
      const ya = ls.find((l) => l.productoId === p.id && l.varianteId === varianteId);
      if (ya) return ls.map((l) => (l === ya ? { ...l, cantidad: l.cantidad + 1 } : l));
      return [...ls, { productoId: p.id, varianteId, nombre: p.nombre, variante: p.variantes.length > 1 ? v.nombre : '', categoria: p.categoria, esCafe: p.esCafe, precio: v.precio, cantidad: 1 }];
    });
  }

  cambiar(i: number, delta: number) {
    this.lineas.update((ls) => ls.map((l, k) => (k === i ? { ...l, cantidad: l.cantidad + delta } : l)).filter((l) => l.cantidad > 0));
  }

  cobrar() {
    const total = this.total();
    const venta = this.tienda.venderMostrador(this.lineas(), [{ medio: this.medio(), monto: total }]);
    if (!venta) return;
    const vueltoTexto = this.medio() === 'efectivo' && this.recibido && this.recibido > total ? ` Vuelto ${plata(this.recibido - total)}.` : '';
    this.avisos.mostrar(`Venta #${venta.numero} cobrada: ${plata(total)}.${vueltoTexto}`, 'ok', {
      texto: 'Imprimir ticket',
      fn: () => {
        const a = this.tienda.estado().ajustes;
        this.impresion.imprimir({
          titulo: `TICKET #${venta.numero}`, local: a.nombreLocal, direccion: a.direccion, fecha: venta.fecha, detalle: 'Mostrador',
          lineas: venta.lineas.map((l) => ({ cantidad: l.cantidad, nombre: `${l.nombre}${l.variante ? ' ' + l.variante.toLowerCase() : ''}`, importe: l.precio * l.cantidad })),
          total: venta.total, pagos: venta.pagos,
        });
      },
    });
    this.lineas.set([]);
    this.recibido = null;
  }
}

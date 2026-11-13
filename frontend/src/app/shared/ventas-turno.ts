import { Component, input } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { hora, nombreMedio, plata } from '../core/formato';
import { LayoutGrid, Store } from '../core/iconos';
import { Venta } from '../core/modelos';

/** Lista compacta de ventas (de mesas y mostrador), para la caja y el detalle de un turno. */
@Component({
  selector: 'app-ventas-turno',
  imports: [LucideAngularModule],
  styles: `
    :host { display: block; max-height: 420px; overflow: auto; }
    .fila { display: grid; grid-template-columns: 52px 24px 1fr auto; gap: 10px; align-items: center; padding: 8px 18px; border-bottom: 1px solid var(--border); font-size: var(--fs-sm); font-variant-numeric: tabular-nums;
      &:last-child { border: 0; } &.anulada { opacity: 0.5; text-decoration: line-through; } }
    .donde { display: flex; flex-direction: column; min-width: 0; b { font-size: var(--fs); } small { color: var(--text-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } }
    lucide-icon { color: var(--text-3); }
    .num { font-weight: 650; }
  `,
  template: `
    @for (v of ventas(); track v.id) {
      <div class="fila" [class.anulada]="!!v.anulada">
        <span class="ter">{{ hora(v.fecha) }}</span>
        <lucide-icon [img]="v.origen === 'mesa' ? iMesa : iMostrador" [size]="16" [attr.aria-label]="v.origen === 'mesa' ? 'Mesa' : 'Mostrador'" />
        <span class="donde"><b>{{ v.origen === 'mesa' ? 'Mesa ' + v.mesa : 'Mostrador' }} <span class="ter">· {{ pagos(v) }}</span></b><small>{{ resumen(v) }}</small></span>
        <span class="num">{{ plata(v.total) }}</span>
      </div>
    } @empty {
      <p class="ter" style="padding:14px 18px">Todavía no hay ventas en este turno.</p>
    }
  `,
})
export class VentasTurno {
  readonly ventas = input.required<Venta[]>();
  protected readonly hora = hora;
  protected readonly plata = plata;
  protected readonly iMesa = LayoutGrid;
  protected readonly iMostrador = Store;

  resumen(v: Venta) {
    return v.lineas.map((l) => `${l.cantidad} ${l.nombre}${l.variante && !['Unidad', 'Único'].includes(l.variante) ? ' ' + l.variante.toLowerCase() : ''}`).join(', ');
  }

  pagos(v: Venta) {
    return v.pagos.map((p) => nombreMedio(p.medio)).filter((x, i, a) => a.indexOf(x) === i).join(' + ');
  }
}

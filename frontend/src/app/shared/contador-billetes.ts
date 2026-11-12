import { Component, computed, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { plata } from '../core/formato';
import { Billetes } from '../core/modelos';

/** Billetes en circulación en Argentina, de mayor a menor. */
export const BILLETES = [20000, 10000, 2000, 1000, 500, 200, 100, 50, 20, 10];

export function totalBilletes(b: Billetes): number {
  return Object.entries(b).reduce((s, [valor, cantidad]) => s + (valor === 'otros' ? cantidad || 0 : Number(valor) * (cantidad || 0)), 0);
}

/** Contador de billetes: se anota cuántos hay de cada valor y se calcula el total solo. */
@Component({
  selector: 'app-contador-billetes',
  imports: [FormsModule],
  styles: `
    :host { display: block; }
    .grilla { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px 14px; }
    .billete { display: grid; grid-template-columns: 64px 92px 1fr; gap: 8px; align-items: center; font-size: var(--fs-sm);
      .valor { font-weight: 700; font-variant-numeric: tabular-nums; }
      .input { text-align: center; font-variant-numeric: tabular-nums; }
      .sub { color: var(--text-3); text-align: right; font-variant-numeric: tabular-nums; } }
    .monedas { display: grid; grid-template-columns: 64px 1fr; gap: 8px; align-items: center; margin-top: 8px; font-size: var(--fs-sm); .valor { font-weight: 700; } }
    .total { display: flex; justify-content: space-between; align-items: baseline; margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--border);
      b { font-size: 22px; font-variant-numeric: tabular-nums; } }
    @media (max-width: 700px) { .grilla { grid-template-columns: 1fr; } }
  `,
  template: `
    <div class="grilla">
      @for (v of valores; track v) {
        <label class="billete">
          <span class="valor">$ {{ formatear(v) }}</span>
          <input class="input chico" type="number" min="0" inputmode="numeric" [ngModel]="billetes()[v] || null" (ngModelChange)="cambiar(v, $event)" placeholder="0" [attr.aria-label]="'Billetes de ' + v" />
          <span class="sub">{{ (billetes()[v] || 0) > 0 ? plata(v * (billetes()[v] || 0)) : '' }}</span>
        </label>
      }
    </div>
    <label class="monedas">
      <span class="valor">Otros</span>
      <span class="input-plata"><input class="input chico" type="number" min="0" [ngModel]="billetes()['otros'] || null" (ngModelChange)="cambiar('otros', $event)" placeholder="monedas, billetes chicos" aria-label="Monedas y otros" /></span>
    </label>
    <div class="total"><span>{{ etiqueta() }}</span><b>{{ plata(total()) }}</b></div>
  `,
})
export class ContadorBilletes {
  readonly billetes = model<Billetes>({});
  readonly etiqueta = input('Total contado');
  protected readonly valores = BILLETES;
  protected readonly total = computed(() => totalBilletes(this.billetes()));
  protected readonly plata = plata;

  formatear(v: number) {
    return v.toLocaleString('es-AR');
  }

  cambiar(valor: number | 'otros', cantidad: number | null) {
    const b = { ...this.billetes() };
    const n = Math.max(0, Number(cantidad) || 0);
    // En "otros" se anota plata (monedas, billetes chicos), no una cantidad de billetes.
    b[valor] = n;
    this.billetes.set(b);
  }
}

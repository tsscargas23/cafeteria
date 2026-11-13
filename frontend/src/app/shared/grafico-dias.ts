import { Component, DestroyRef, ElementRef, afterNextRender, computed, inject, input, signal } from '@angular/core';
import { fecha, plata, plataCorta } from '../core/formato';

/** Columnas por día (una sola serie), con tooltip al pasar el mouse. */
@Component({
  selector: 'app-grafico-dias',
  styles: `
    :host { display: block; position: relative; }
    svg { width: 100%; height: auto; display: block; overflow: visible; }
    .eje { font-size: 11px; fill: var(--text-3); font-variant-numeric: tabular-nums; }
    .grilla { stroke: var(--border); stroke-width: 1; }
    .barra { fill: var(--series-1); }
    .golpe { fill: transparent; cursor: pointer; }
    .golpe:hover + .barra, .activa { fill: var(--accent-text); }
    .tip { position: absolute; transform: translate(-50%, calc(-100% - 8px)); background: var(--text); color: #fff; padding: 6px 10px; border-radius: var(--r-sm); font-size: var(--fs-sm); pointer-events: none; white-space: nowrap; box-shadow: var(--shadow-2);
      b { font-variant-numeric: tabular-nums; } }
  `,
  template: `
    <svg [attr.viewBox]="'0 0 ' + ancho + ' ' + alto" role="img" [attr.aria-label]="'Ventas por día, máximo ' + plata(maximo())">
      @for (t of marcas(); track t) {
        <line class="grilla" [attr.x1]="izq" [attr.x2]="ancho" [attr.y1]="y(t)" [attr.y2]="y(t)" />
        <text class="eje" [attr.x]="izq - 6" [attr.y]="y(t) + 4" text-anchor="end">{{ plataCorta(t) }}</text>
      }
      @for (d of datos(); track d.dia; let i = $index) {
        <rect class="golpe" [attr.x]="izq + i * paso()" y="0" [attr.width]="paso()" [attr.height]="alto - abajo" (mouseenter)="activo.set(i)" (mouseleave)="activo.set(null)" />
        <path class="barra" [class.activa]="activo() === i" [attr.d]="barra(i, d.total)" />
        @if (mostrarEtiqueta(i)) {
          <text class="eje" [attr.x]="izq + i * paso() + paso() / 2" [attr.y]="alto - 6" text-anchor="middle">{{ fecha(d.dia) }}</text>
        }
      }
    </svg>
    @if (activo() !== null) {
      @let d = datos()[activo()!];
      <div class="tip" [style.left.%]="((izq + activo()! * paso() + paso() / 2) / ancho) * 100" [style.top.%]="(y(d.total) / alto) * 100">
        {{ fecha(d.dia) }} · <b>{{ plata(d.total) }}</b> · {{ d.ventas }} ventas
      </div>
    }
  `,
})
export class GraficoDias {
  readonly datos = input.required<{ dia: number; total: number; ventas: number }[]>();
  protected readonly activo = signal<number | null>(null);
  private readonly _ancho = signal(800);
  protected get ancho() { return this._ancho(); }
  protected readonly alto = 220;
  protected readonly izq = 56;
  protected readonly abajo = 24;
  protected readonly maximo = computed(() => Math.max(1, ...this.datos().map((d) => d.total)));
  protected readonly tope = computed(() => {
    const m = this.maximo();
    const paso = Math.pow(10, Math.floor(Math.log10(m)));
    return Math.ceil(m / paso) * paso;
  });
  protected readonly marcas = computed(() => [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(this.tope() * f)));
  protected readonly paso = computed(() => (this._ancho() - this.izq) / Math.max(1, this.datos().length));

  constructor() {
    // El gráfico se dibuja al ancho real (en píxeles), así las barras y los textos no se deforman.
    const el = inject(ElementRef<HTMLElement>).nativeElement as HTMLElement;
    afterNextRender(() => {
      const ro = new ResizeObserver(() => this._ancho.set(Math.max(300, Math.round(el.clientWidth))));
      ro.observe(el);
      this.limpiar = () => ro.disconnect();
    });
    inject(DestroyRef).onDestroy(() => this.limpiar());
  }

  private limpiar = () => {};
  protected readonly plata = plata;
  protected readonly plataCorta = plataCorta;
  protected readonly fecha = fecha;

  y(v: number) {
    return this.alto - this.abajo - (v / this.tope()) * (this.alto - this.abajo - 8);
  }

  barra(i: number, v: number) {
    const w = Math.min(24, this.paso() - 2);
    const x = this.izq + i * this.paso() + (this.paso() - w) / 2;
    const base = this.alto - this.abajo;
    const top = this.y(v);
    if (v <= 0) return '';
    const r = Math.min(4, (base - top) / 2, w / 2);
    return `M${x},${base} V${top + r} Q${x},${top} ${x + r},${top} H${x + w - r} Q${x + w},${top} ${x + w},${top + r} V${base} Z`;
  }

  mostrarEtiqueta(i: number) {
    const n = this.datos().length;
    const entran = Math.max(1, Math.floor((this._ancho() - this.izq) / 56));
    const cada = Math.max(1, Math.ceil(n / entran));
    return i % cada === 0;
  }
}

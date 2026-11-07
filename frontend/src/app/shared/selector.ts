import { Component, ElementRef, HostListener, computed, inject, input, model, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { ChevronDown, Search } from '../core/iconos';

export interface Opcion {
  valor: string;
  texto: string;
  grupo?: string;
  /** Opción hija (por ejemplo un tamaño dentro de un producto). */
  sangria?: boolean;
}

/** Filtro de selección múltiple con buscador, para la barra de filtros. */
@Component({
  selector: 'app-selector',
  imports: [LucideAngularModule],
  styles: `
    :host { position: relative; display: inline-block; }
    .disparador { gap: 6px; }
    .disparador.con-valor { background: var(--accent-soft); border-color: var(--accent); color: var(--accent-text); }
    .menu { position: absolute; top: calc(100% + 6px); left: 0; z-index: 30; width: 300px; max-height: 380px; display: flex; flex-direction: column;
      background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-lg); box-shadow: var(--shadow-2); animation: subir 0.15s var(--ease); }
    .buscar { padding: 10px; border-bottom: 1px solid var(--border); .buscador { display: block; min-width: 0; width: 100%; } }
    .opciones { overflow: auto; padding: 6px; }
    .grupo { font-size: var(--fs-xs); font-weight: 700; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.04em; padding: 8px 8px 4px; }
    .opciones label { display: flex; align-items: center; gap: 10px; padding: 7px 8px; border-radius: var(--r-sm); cursor: pointer; font-size: var(--fs-sm);
      &:hover { background: var(--surface-2); } &.sangria { padding-left: 32px; color: var(--text-2); }
      input { width: 16px; height: 16px; accent-color: var(--accent); } }
    .pie { display: flex; justify-content: space-between; padding: 8px 10px; border-top: 1px solid var(--border); }
  `,
  template: `
    <button type="button" class="btn chico disparador" [class.con-valor]="valor().length" (click)="abierto.set(!abierto())" [attr.aria-expanded]="abierto()">
      {{ resumen() }} <lucide-icon [img]="iAbajo" [size]="15" />
    </button>
    @if (abierto()) {
      <div class="menu" role="listbox" [attr.aria-label]="nombre()">
        @if (opciones().length > 8) {
          <div class="buscar"><label class="buscador"><lucide-icon [img]="iBuscar" [size]="16" /><input class="input chico" placeholder="Buscar" (input)="busqueda.set($any($event.target).value)" /></label></div>
        }
        <div class="opciones">
          @for (o of visibles(); track o.valor; let i = $index) {
            @if (o.grupo && (i === 0 || visibles()[i - 1].grupo !== o.grupo)) { <div class="grupo">{{ o.grupo }}</div> }
            <label [class.sangria]="o.sangria"><input type="checkbox" [checked]="valor().includes(o.valor)" (change)="alternar(o.valor)" />{{ o.texto }}</label>
          }
        </div>
        <div class="pie">
          <button type="button" class="btn chico fantasma" (click)="valor.set([])">Limpiar</button>
          <button type="button" class="btn chico primario" (click)="abierto.set(false)">Listo</button>
        </div>
      </div>
    }
  `,
})
export class Selector {
  private readonly el = inject(ElementRef);
  readonly nombre = input.required<string>();
  readonly opciones = input.required<Opcion[]>();
  readonly valor = model<string[]>([]);
  protected readonly abierto = signal(false);
  protected readonly busqueda = signal('');
  protected readonly visibles = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    return this.opciones().filter((o) => !q || o.texto.toLowerCase().includes(q) || (o.grupo ?? '').toLowerCase().includes(q));
  });
  protected readonly resumen = computed(() => {
    const v = this.valor();
    if (!v.length) return this.nombre();
    if (v.length === 1) return this.opciones().find((o) => o.valor === v[0])?.texto ?? this.nombre();
    return `${this.nombre()}: ${v.length}`;
  });
  protected readonly iAbajo = ChevronDown;
  protected readonly iBuscar = Search;

  alternar(v: string) {
    this.valor.update((l) => (l.includes(v) ? l.filter((x) => x !== v) : [...l, v]));
  }

  @HostListener('document:click', ['$event'])
  fuera(ev: MouseEvent) {
    if (this.abierto() && !this.el.nativeElement.contains(ev.target)) this.abierto.set(false);
  }
}

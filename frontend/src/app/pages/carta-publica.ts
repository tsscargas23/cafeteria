import { Component, computed, inject, input, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { plata } from '../core/formato';
import { Coffee, Phone } from '../core/iconos';
import { Tienda } from '../core/tienda';

/** La carta que ve el cliente al escanear el QR. Sin login, pensada para celular. */
@Component({
  selector: 'app-carta-publica',
  imports: [LucideAngularModule],
  styles: `
    :host { display: block; min-height: 100vh; background: var(--surface); }
    header { padding: 28px 20px 18px; text-align: center; border-bottom: 1px solid var(--border);
      .logo { width: 52px; height: 52px; border-radius: 14px; background: var(--accent); color: #fff; display: inline-grid; place-items: center; margin-bottom: 10px; }
      h1 { font-size: 24px; } p { color: var(--text-2); } }
    .mesa { display: inline-block; margin-top: 10px; }
    nav { position: sticky; top: 0; background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(8px); display: flex; gap: 6px; overflow-x: auto; padding: 10px 16px; border-bottom: 1px solid var(--border); z-index: 2; }
    main { max-width: 640px; margin: 0 auto; padding: 8px 20px 40px; }
    section { padding-top: 18px; scroll-margin-top: 60px; }
    h2 { font-size: var(--fs-lg); margin-bottom: 6px; }
    .prod { padding: 12px 0; border-bottom: 1px solid var(--border); }
    .prod-cab { display: flex; justify-content: space-between; gap: 12px; align-items: baseline; b { font-size: var(--fs-md); } }
    .desc { color: var(--text-2); font-size: var(--fs-sm); margin-top: 2px; }
    .precio { font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .tamanos { display: flex; flex-wrap: wrap; gap: 6px 14px; margin-top: 6px; font-size: var(--fs-sm); color: var(--text-2); span b { color: var(--text); font-variant-numeric: tabular-nums; } }
    footer { text-align: center; color: var(--text-3); font-size: var(--fs-sm); padding: 20px; display: flex; flex-direction: column; gap: 4px; align-items: center; }
  `,
  template: `
    <header>
      <span class="logo"><lucide-icon [img]="iCafe" [size]="26" /></span>
      <h1>{{ ajustes().nombreLocal }}</h1>
      <p>{{ ajustes().direccion }}</p>
      @if (mesa()) { <span class="etiqueta acento mesa">Estás en la mesa {{ mesa() }}</span> }
    </header>
    <nav aria-label="Categorías">
      @for (c of secciones(); track c.nombre) { <a class="chip" [class.activo]="activa() === c.nombre" [href]="'#' + ancla(c.nombre)" (click)="activa.set(c.nombre)">{{ c.nombre }}</a> }
    </nav>
    <main>
      @for (c of secciones(); track c.nombre) {
        <section [id]="ancla(c.nombre)">
          <h2>{{ c.nombre }}</h2>
          @for (p of c.productos; track p.id) {
            <div class="prod">
              <div class="prod-cab"><b>{{ p.nombre }}</b>@if (p.variantes.length === 1) { <span class="precio">{{ plata(p.variantes[0].precio) }}</span> }</div>
              @if (p.descripcion) { <div class="desc">{{ p.descripcion }}</div> }
              @if (p.variantes.length > 1) {
                <div class="tamanos">@for (v of p.variantes; track v.id) { <span>{{ v.nombre }} <b>{{ plata(v.precio) }}</b></span> }</div>
              }
            </div>
          }
        </section>
      }
    </main>
    <footer>
      <span><lucide-icon [img]="iTel" [size]="14" /> {{ ajustes().telefono }}</span>
      <span>Precios en pesos. Pedíselo a quien te atiende.</span>
    </footer>
  `,
})
export class CartaPublica {
  private readonly tienda = inject(Tienda);
  readonly mesa = input<string>();
  protected readonly activa = signal<string | null>(null);
  protected readonly ajustes = computed(() => this.tienda.estado().ajustes);
  protected readonly secciones = computed(() => {
    const e = this.tienda.estado();
    return e.categorias
      .map((nombre) => ({ nombre, productos: e.productos.filter((p) => p.categoria === nombre && p.activo && p.dondeSeVende !== 'online') }))
      .filter((s) => s.productos.length);
  });
  protected readonly plata = plata;
  protected readonly iCafe = Coffee;
  protected readonly iTel = Phone;

  ancla(nombre: string) {
    return nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '-');
  }
}

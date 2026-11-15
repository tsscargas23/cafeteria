import { Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { plata } from '../core/formato';
import { Coffee, Phone } from '../core/iconos';
import { Supabase } from '../core/supabase';
import { Tienda } from '../core/tienda';
import { categoriasOrdenadas } from './carta-qr';

interface DatosCarta {
  nombreLocal: string;
  direccion: string;
  telefono: string;
  frase: string;
  aviso: string;
  ordenCategorias: string[];
  categorias: string[];
  productos: { id: string; nombre: string; categoria: string; descripcion: string; variantes: { id: string; nombre: string; precio: number }[] }[];
}

/** La carta que ve el cliente al escanear el QR. Sin login, pensada para celular. */
@Component({
  selector: 'app-carta-publica',
  imports: [LucideAngularModule],
  styles: `
    :host { display: block; min-height: 100vh; background: var(--surface); }
    header { padding: 28px 20px 18px; text-align: center; border-bottom: 1px solid var(--border);
      .logo { width: 52px; height: 52px; border-radius: 14px; background: var(--accent); color: var(--accent-ink); display: inline-grid; place-items: center; margin-bottom: 10px; }
      h1 { font-size: 24px; } p { color: var(--text-2); } .frase { color: var(--text); font-size: var(--fs-md); margin: 6px auto 4px; max-width: 32ch; text-wrap: balance; } }
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
      <h1>{{ d().nombreLocal }}</h1>
      @if (d().frase) { <p class="frase">{{ d().frase }}</p> }
      @if (d().direccion) { <p>{{ d().direccion }}</p> }
      @if (mesa()) { <span class="etiqueta acento mesa">Estás en la mesa {{ mesa() }}</span> }
    </header>
    <nav aria-label="Categorías">
      @for (c of secciones(); track c.nombre) { <button class="chip" [class.activo]="activa() === c.nombre" (click)="irA(c.nombre)">{{ c.nombre }}</button> }
    </nav>
    <main>
      @if (cargando()) { <p class="ter" style="padding:24px 0;text-align:center">Cargando la carta…</p> }
      @else if (!secciones().length) { <p class="ter" style="padding:24px 0;text-align:center">La carta todavía no tiene productos.</p> }
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
      @if (d().telefono) { <span><lucide-icon [img]="iTel" [size]="14" /> {{ d().telefono }}</span> }
      @if (d().aviso) { <span>{{ d().aviso }}</span> }
      <span>Precios en pesos. Pedíselo a quien te atiende.</span>
    </footer>
  `,
})
export class CartaPublica {
  private readonly tienda = inject(Tienda);
  readonly mesa = input<string>();
  protected readonly activa = signal<string | null>(null);
  private readonly sb = inject(Supabase).cliente;
  /** En el sistema real, lo que devuelve la función pública carta_publica() (los clientes no tienen sesión). */
  private readonly remota = signal<DatosCarta | null>(null);
  protected readonly cargando = computed(() => this.sb !== null && this.remota() === null);

  /** Datos de la carta: de la base (sistema real) o del estado en memoria (demo). */
  protected readonly d = computed<DatosCarta>(() => {
    if (this.sb) return this.remota() ?? { nombreLocal: 'Panacota', direccion: '', telefono: '', frase: '', aviso: '', ordenCategorias: [], categorias: [], productos: [] };
    const e = this.tienda.estado();
    const ocultos = e.ajustes.carta.ocultos;
    return {
      nombreLocal: e.ajustes.nombreLocal, direccion: e.ajustes.direccion, telefono: e.ajustes.telefono, frase: e.ajustes.carta.frase,
      aviso: e.ajustes.carta.aviso, ordenCategorias: e.ajustes.carta.ordenCategorias, categorias: e.categorias,
      productos: e.productos.filter((p) => p.activo && p.dondeSeVende !== 'online' && !ocultos.includes(p.id)),
    };
  });
  protected readonly secciones = computed(() => {
    const d = this.d();
    return categoriasOrdenadas(d.categorias, d.ordenCategorias)
      .map((nombre) => ({ nombre, productos: d.productos.filter((p) => p.categoria === nombre) }))
      .filter((s) => s.productos.length);
  });

  constructor() {
    if (!this.sb) return;
    void this.cargar();
    // Dentro de la vista previa de "Carta QR" se refresca seguido, para ver al instante lo que se edita.
    if (window.self !== window.top) {
      const t = setInterval(() => void this.cargar(), 3000);
      inject(DestroyRef).onDestroy(() => clearInterval(t));
    }
  }

  private async cargar() {
    const { data, error } = await this.sb!.rpc('carta_publica');
    if (!error && data) this.remota.set(data as DatosCarta);
    else if (!this.remota()) this.remota.set({ nombreLocal: 'Panacota', direccion: '', telefono: '', frase: '', aviso: '', ordenCategorias: [], categorias: [], productos: [] });
  }
  protected readonly plata = plata;
  protected readonly iCafe = Coffee;
  protected readonly iTel = Phone;

  ancla(nombre: string) {
    return 'cat-' + nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-');
  }

  /** Baja hasta la categoría sin cambiar la dirección (con # en la URL el navegador la tomaría como otra pantalla). */
  irA(nombre: string) {
    this.activa.set(nombre);
    document.getElementById(this.ancla(nombre))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

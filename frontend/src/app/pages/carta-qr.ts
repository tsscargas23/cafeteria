import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { DomSanitizer } from '@angular/platform-browser';
import { plata } from '../core/formato';
import { ArrowDown, ArrowUp, Download, Eye, EyeOff, Printer } from '../core/iconos';
import { Producto } from '../core/modelos';
import { Tienda } from '../core/tienda';

/** Pone primero las categorías en el orden elegido; las nuevas van al final. */
export function categoriasOrdenadas(todas: string[], orden: string[]): string[] {
  return [...orden.filter((c) => todas.includes(c)), ...todas.filter((c) => !orden.includes(c))];
}

@Component({
  selector: 'app-carta-qr',
  imports: [FormsModule, LucideAngularModule],
  styles: `
    .dos { display: grid; grid-template-columns: minmax(0, 1fr) 380px; gap: 18px; align-items: start; }
    .col { display: flex; flex-direction: column; gap: 18px; min-width: 0; }
    .qr-card { display: grid; grid-template-columns: auto 1fr; gap: 24px; align-items: center; padding: 20px;
      img { width: 200px; height: 200px; border: 1px solid var(--border); border-radius: var(--r); }
      .acciones { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; } }
    .categoria { border-top: 1px solid var(--border); }
    .cat-cab { display: flex; align-items: center; gap: 8px; padding: 10px 0; h3 { flex: 1; } }
    .prod { display: grid; grid-template-columns: auto minmax(0, 1fr) minmax(0, 230px); gap: 10px; align-items: center; padding: 8px 0 8px 12px; border-top: 1px dashed var(--border);
      &.oculto .nombre, &.oculto .desc { opacity: 0.45; }
      .nombre { font-weight: 650; }
      .desc { width: 100%; margin-top: 4px; }
      .precios { color: var(--text-3); font-size: var(--fs-sm); text-align: right; } }
    .telefono { border: 10px solid #1f2937; border-radius: 32px; overflow: hidden; height: 700px; box-shadow: var(--shadow-2); background: #fff; position: sticky; top: 80px;
      iframe { width: 100%; height: 100%; border: 0; } }
    .hoja { width: 190mm; text-align: center; font-family: var(--font); color: #000; padding-top: 20mm;
      img { width: 120mm; height: 120mm; } h1 { font-size: 28pt; margin-top: 8mm; } p { font-size: 14pt; color: #333; } }
    @media (max-width: 1100px) { .dos { grid-template-columns: 1fr; } .telefono { position: static; height: 600px; max-width: 380px; } .qr-card { grid-template-columns: 1fr; } }
  `,
  template: `
    <div class="pagina">
      <div class="pagina-cab">
        <div class="titulo"><h1>Carta QR</h1><p>Un solo código para todas las mesas. La carta se arma con tus productos y precios; acá elegís qué se muestra y cómo.</p></div>
      </div>
      <div class="dos">
        <div class="col">
          <section class="panel qr-card">
            @if (qr(); as src) { <img [src]="src" alt="Código QR de la carta" /> }
            <div>
              <h2>El QR de la carta</h2>
              <p class="sec">Imprimilo y ponelo en las mesas, el mostrador o la vidriera. Abre la carta en el celular sin instalar nada.</p>
              <a class="ter" [href]="url()" target="_blank" rel="noopener" style="word-break:break-all">{{ url() }}</a>
              <div class="acciones">
                <button class="btn primario" (click)="imprimir()"><lucide-icon [img]="iImprimir" [size]="18" />Imprimir en hoja A4</button>
                <a class="btn" [href]="qr()" download="qr-carta.png"><lucide-icon [img]="iBajar" [size]="18" />Bajar imagen</a>
              </div>
            </div>
          </section>

          <section class="panel">
            <div class="panel-cab"><h3>Editar la carta</h3><span class="ter derecha">Los cambios se ven al instante en la vista previa</span></div>
            <div class="panel-cuerpo" style="display:flex;flex-direction:column;gap:14px">
              <div class="grilla-2">
                <label class="campo"><span>Frase de arriba</span><input class="input" [ngModel]="carta().frase" (ngModelChange)="cambiar('frase', $event)" placeholder="Ej.: Café de especialidad y tortas caseras" /></label>
                <label class="campo"><span>Aviso de abajo</span><input class="input" [ngModel]="carta().aviso" (ngModelChange)="cambiar('aviso', $event)" placeholder="Ej.: Consultá por opciones sin TACC" /></label>
              </div>
              <p class="ter">Ordená las categorías con las flechas. El ojo oculta un producto de la carta sin pausarlo en el local. Los precios y los nombres se cambian en «Productos».</p>
              @for (cat of categorias(); track cat; let i = $index; let ultimo = $last) {
                <div class="categoria">
                  <div class="cat-cab">
                    <h3>{{ cat }}</h3>
                    <button class="btn icono chico" [disabled]="i === 0" (click)="mover(i, -1)" [attr.aria-label]="'Subir ' + cat"><lucide-icon [img]="iArriba" [size]="15" /></button>
                    <button class="btn icono chico" [disabled]="ultimo" (click)="mover(i, 1)" [attr.aria-label]="'Bajar ' + cat"><lucide-icon [img]="iAbajo" [size]="15" /></button>
                  </div>
                  @for (p of productosDe(cat); track p.id) {
                    <div class="prod" [class.oculto]="carta().ocultos.includes(p.id)">
                      <button class="btn icono chico fantasma" (click)="alternarOculto(p.id)" [attr.aria-label]="(carta().ocultos.includes(p.id) ? 'Mostrar ' : 'Ocultar ') + p.nombre">
                        <lucide-icon [img]="carta().ocultos.includes(p.id) ? iOculto : iVisible" [size]="17" />
                      </button>
                      <div>
                        <div class="nombre">{{ p.nombre }} @if (!p.activo) { <span class="etiqueta atencion">Hoy no hay</span> }</div>
                        <input class="input chico desc" [ngModel]="p.descripcion" (change)="tienda.editarDescripcion(p.id, $any($event.target).value)" placeholder="Descripción (opcional)" [attr.aria-label]="'Descripción de ' + p.nombre" />
                      </div>
                      <span class="precios">{{ precios(p) }}</span>
                    </div>
                  }
                </div>
              }
            </div>
          </section>
        </div>
        <div class="telefono" aria-label="Vista previa de la carta en un celular"><iframe [src]="vistaPrevia" title="Vista previa de la carta"></iframe></div>
      </div>
    </div>

    @if (imprimiendo()) {
      <div class="solo-impresion">
        <div class="hoja">
          <img [src]="qr()" alt="" />
          <h1>{{ tienda.estado().ajustes.nombreLocal }}</h1>
          <p>Escaneá el código para ver la carta</p>
        </div>
      </div>
    }
  `,
})
export class CartaQr {
  protected readonly tienda = inject(Tienda);
  protected readonly qr = signal('');
  protected readonly imprimiendo = signal(false);
  protected readonly url = computed(() => `${location.href.split('#')[0]}#/carta`);
  protected readonly vistaPrevia = inject(DomSanitizer).bypassSecurityTrustResourceUrl(this.url());
  protected readonly carta = computed(() => this.tienda.estado().ajustes.carta);
  protected readonly categorias = computed(() => categoriasOrdenadas(this.tienda.estado().categorias, this.carta().ordenCategorias));
  protected readonly iImprimir = Printer;
  protected readonly iBajar = Download;
  protected readonly iArriba = ArrowUp;
  protected readonly iAbajo = ArrowDown;
  protected readonly iVisible = Eye;
  protected readonly iOculto = EyeOff;

  constructor() {
    effect(async () => {
      const url = this.url();
      // Según cómo se empaquete, la librería llega directa o dentro de "default".
      const modulo = await import('qrcode');
      const QR = modulo.default ?? modulo;
      this.qr.set(await QR.toDataURL(url, { margin: 1, width: 640, color: { dark: '#111827', light: '#ffffff' } }));
    });
  }

  productosDe(cat: string): Producto[] {
    return this.tienda.estado().productos.filter((p) => p.categoria === cat && p.dondeSeVende !== 'online');
  }

  precios(p: Producto) {
    return p.variantes.map((v) => (p.variantes.length > 1 ? `${v.nombre} ${plata(v.precio)}` : plata(v.precio))).join(' · ');
  }

  cambiar(campo: 'frase' | 'aviso', valor: string) {
    this.tienda.guardarCarta({ ...this.carta(), [campo]: valor });
  }

  mover(i: number, delta: number) {
    const orden = [...this.categorias()];
    const j = i + delta;
    [orden[i], orden[j]] = [orden[j], orden[i]];
    this.tienda.guardarCarta({ ...this.carta(), ordenCategorias: orden });
  }

  alternarOculto(id: string) {
    const c = this.carta();
    const ocultos = c.ocultos.includes(id) ? c.ocultos.filter((x) => x !== id) : [...c.ocultos, id];
    this.tienda.guardarCarta({ ...c, ocultos });
  }

  imprimir() {
    this.imprimiendo.set(true);
    setTimeout(() => {
      window.print();
      this.imprimiendo.set(false);
    }, 100);
  }
}

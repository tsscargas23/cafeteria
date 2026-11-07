import { Component, computed, effect, inject, signal } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { LucideAngularModule } from 'lucide-angular';
import { Printer, QrCode } from '../core/iconos';
import { Tienda } from '../core/tienda';
import { Impresion } from '../shared/ticket';

@Component({
  selector: 'app-carta-qr',
  imports: [LucideAngularModule],
  styles: `
    .dos { display: grid; grid-template-columns: minmax(0, 1fr) 380px; gap: 18px; align-items: start; }
    .general { display: flex; gap: 20px; align-items: center; padding: 18px; img { width: 160px; height: 160px; } }
    .grilla { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; }
    .qr { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 12px; img { width: 120px; height: 120px; } b { font-size: var(--fs-md); } }
    .telefono { border: 10px solid #1f2937; border-radius: 32px; overflow: hidden; height: 700px; box-shadow: var(--shadow-2); background: #fff; position: sticky; top: 80px;
      iframe { width: 100%; height: 100%; border: 0; } }
    .hoja { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8mm; width: 190mm; font-family: var(--font); color: #000;
      div { border: 1px dashed #999; border-radius: 4mm; padding: 5mm; text-align: center; } img { width: 40mm; height: 40mm; } b { display: block; font-size: 16pt; } small { font-size: 9pt; } }
    @media (max-width: 1100px) { .dos { grid-template-columns: 1fr; } .telefono { position: static; height: 600px; max-width: 380px; } }
  `,
  template: `
    <div class="pagina">
      <div class="pagina-cab">
        <div class="titulo"><h1>Carta QR</h1><p>La carta se arma sola con tus productos y precios. Si cambiás un precio o pausás un producto, la carta cambia al instante.</p></div>
        <div class="acciones"><button class="btn primario" (click)="imprimir()"><lucide-icon [img]="iImprimir" [size]="18" />Imprimir QR de las mesas</button></div>
      </div>
      <div class="dos">
        <div style="display:flex;flex-direction:column;gap:18px;min-width:0">
          <section class="panel general">
            @if (qrs()['general']; as src) { <img [src]="src" alt="Código QR de la carta" /> }
            <div style="display:flex;flex-direction:column;gap:8px">
              <h2>QR general</h2>
              <p class="sec">Para el mostrador, la vidriera o Instagram. Abre la carta en el celular, sin instalar nada.</p>
              <a class="ter" [href]="url()" target="_blank" rel="noopener">{{ url() }}</a>
            </div>
          </section>
          <section class="panel">
            <div class="panel-cab"><h3>Un QR por mesa</h3><span class="ter derecha">Se imprimen de a 9 por hoja A4</span></div>
            <div class="panel-cuerpo grilla">
              @for (m of mesas(); track m.id) {
                <div class="panel qr">@if (qrs()[m.id]; as src) { <img [src]="src" [alt]="'QR mesa ' + m.nombre" /> }<b>Mesa {{ m.nombre }}</b><span class="ter">{{ m.salon }}</span></div>
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
          @for (m of mesas(); track m.id) {
            <div><img [src]="qrs()[m.id]" alt="" /><b>Mesa {{ m.nombre }}</b><small>Escaneá para ver la carta · {{ tienda.estado().ajustes.nombreLocal }}</small></div>
          }
        </div>
      </div>
    }
  `,
})
export class CartaQr {
  protected readonly tienda = inject(Tienda);
  private readonly impresion = inject(Impresion);
  protected readonly qrs = signal<Record<string, string>>({});
  protected readonly imprimiendo = signal(false);
  protected readonly url = computed(() => `${location.href.split('#')[0]}#/carta`);
  protected readonly vistaPrevia = inject(DomSanitizer).bypassSecurityTrustResourceUrl(this.url());
  protected readonly mesas = computed(() => {
    const e = this.tienda.estado();
    return e.mesas.map((m) => ({ ...m, salon: e.salones.find((s) => s.id === m.salonId)?.nombre ?? '' }));
  });
  protected readonly iImprimir = Printer;
  protected readonly iQr = QrCode;

  constructor() {
    effect(async () => {
      const mesas = this.mesas();
      // Según cómo se empaquete, la librería llega directa o dentro de "default".
      const modulo = await import('qrcode');
      const QR = modulo.default ?? modulo;
      const opciones = { margin: 1, width: 320, color: { dark: '#111827', light: '#ffffff' } };
      const r: Record<string, string> = { general: await QR.toDataURL(this.url(), opciones) };
      for (const m of mesas) r[m.id] = await QR.toDataURL(`${this.url()}?mesa=${encodeURIComponent(m.nombre)}`, opciones);
      this.qrs.set(r);
    });
  }

  imprimir() {
    this.impresion.ticket.set(null);
    this.imprimiendo.set(true);
    setTimeout(() => {
      window.print();
      this.imprimiendo.set(false);
    }, 100);
  }
}

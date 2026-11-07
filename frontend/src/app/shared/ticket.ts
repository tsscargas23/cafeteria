import { Component, Injectable, inject, signal } from '@angular/core';
import { fechaHora, nombreMedio, plata } from '../core/formato';
import { MedioPago } from '../core/modelos';

export interface DatosTicket {
  titulo: string;
  local: string;
  direccion: string;
  fecha: number;
  detalle: string;
  lineas: { cantidad: number; nombre: string; importe: number }[];
  total: number;
  pagos: { medio: MedioPago; monto: number; quien: string }[];
  falta?: number;
}

/** Arma el ticket y abre el diálogo de impresión (impresora térmica USB de 58 u 80 mm). */
@Injectable({ providedIn: 'root' })
export class Impresion {
  readonly ticket = signal<DatosTicket | null>(null);

  imprimir(datos: DatosTicket) {
    this.ticket.set(datos);
    setTimeout(() => window.print(), 50);
  }
}

@Component({
  selector: 'app-ticket',
  styles: `
    .ticket { width: 72mm; font: 12px/1.35 ui-monospace, 'Courier New', monospace; color: #000; }
    .centro { text-align: center; }
    h1 { font-size: 15px; margin: 0; }
    .linea { display: flex; justify-content: space-between; gap: 8px; }
    hr { border: 0; border-top: 1px dashed #000; margin: 6px 0; }
    .total { font-size: 15px; font-weight: 700; }
  `,
  template: `
    @if (impresion.ticket(); as t) {
      <div class="solo-impresion">
        <div class="ticket">
          <div class="centro"><h1>{{ t.local }}</h1><div>{{ t.direccion }}</div></div>
          <hr />
          <div class="centro"><b>{{ t.titulo }}</b></div>
          <div>{{ fechaHora(t.fecha) }}</div>
          <div>{{ t.detalle }}</div>
          <hr />
          @for (l of t.lineas; track $index) {
            <div class="linea"><span>{{ l.cantidad }} x {{ l.nombre }}</span><span>{{ plata(l.importe) }}</span></div>
          }
          <hr />
          <div class="linea total"><span>TOTAL</span><span>{{ plata(t.total) }}</span></div>
          @for (p of t.pagos; track $index) {
            <div class="linea"><span>{{ nombreMedio(p.medio) }}{{ p.quien ? ' (' + p.quien + ')' : '' }}</span><span>{{ plata(p.monto) }}</span></div>
          }
          @if (t.falta) { <div class="linea"><span>Falta pagar</span><span>{{ plata(t.falta) }}</span></div> }
          <hr />
          <div class="centro">Documento no válido como factura</div>
          <div class="centro">¡Gracias por venir!</div>
        </div>
      </div>
    }
  `,
})
export class Ticket {
  protected readonly impresion = inject(Impresion);
  protected readonly plata = plata;
  protected readonly fechaHora = fechaHora;
  protected readonly nombreMedio = nombreMedio;
}

import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { Avisos } from '../core/avisos';
import { descargarTexto } from '../core/excel';
import { aInputFecha, cantidadConUnidad, duracion, fechaLarga, hora, num, plata } from '../core/formato';
import { ChevronRight, Download, ShieldCheck, TriangleAlert, Truck } from '../core/iconos';
import { estadoStock, filtrarVentas, filtrosVacios, inicioDelDia, kilosCafe, porDia, porProducto, resumen, variacion } from '../core/reglas';
import { Tienda } from '../core/tienda';
import { GraficoDias } from '../shared/grafico-dias';

@Component({
  selector: 'app-inicio',
  imports: [RouterLink, LucideAngularModule, GraficoDias],
  styles: `
    .dos { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr); gap: 18px; align-items: start; }
    .col { display: flex; flex-direction: column; gap: 18px; min-width: 0; }
    .linea { display: grid; grid-template-columns: 1fr auto; gap: 8px; padding: 9px 0; border-bottom: 1px solid var(--border); font-variant-numeric: tabular-nums; &:last-child { border: 0; } }
    .linea small { display: block; color: var(--text-3); }
    .copia { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; .btn { margin-left: auto; } }
    @media (max-width: 1100px) { .dos { grid-template-columns: 1fr; } }
  `,
  template: `
    <div class="pagina">
      <div class="pagina-cab">
        <div class="titulo"><h1>Hola, {{ tienda.usuario()?.nombre }}</h1><p>{{ fechaLarga(ahora) }}</p></div>
        <div class="acciones">
          <a class="btn" routerLink="/reportes">Ver reportes</a>
          <a class="btn primario" routerLink="/mesas">Ir a mesas</a>
        </div>
      </div>

      @if (diasSinCopia() >= tienda.estado().ajustes.copia.cadaDias) {
        <div class="aviso-linea atencion copia">
          <lucide-icon [img]="iEscudo" [size]="18" />
          <span>Hace {{ diasSinCopia() }} días que no se hace una copia de seguridad.</span>
          <button class="btn chico" (click)="copia()"><lucide-icon [img]="iBajar" [size]="15" />Hacer copia ahora</button>
        </div>
      }

      <div class="indicadores">
        <div class="indicador"><div class="nombre">Vendido hoy</div><div class="valor">{{ plata(hoy().total) }}</div>
          <div class="detalle">@if (cambioHoy(); as c) { <span [class]="c > 0 ? 'sube' : 'baja'">{{ c > 0 ? '▲' : '▼' }} {{ abs(c) }} %</span> vs. el {{ diaSemana }} pasado } @else { Sin datos para comparar }</div></div>
        <div class="indicador"><div class="nombre">Ventas de hoy</div><div class="valor">{{ hoy().ventas }}</div><div class="detalle">Ticket promedio {{ plata(hoy().ticketPromedio) }}</div></div>
        <div class="indicador"><div class="nombre">Cafés de hoy</div><div class="valor">{{ hoy().cafes }}</div><div class="detalle">{{ num(kilosHoy()) }} kg de café</div></div>
        <div class="indicador"><div class="nombre">Mesas ocupadas</div><div class="valor">{{ tienda.estado().cuentas.length }} de {{ tienda.estado().mesas.length }}</div><div class="detalle">{{ plata(abierto()) }} por cobrar</div></div>
      </div>

      <div class="dos">
        <div class="col">
          <section class="panel">
            <div class="panel-cab"><h3>Últimos 14 días</h3><a class="derecha btn chico fantasma" routerLink="/reportes">Más detalle <lucide-icon [img]="iFlecha" [size]="15" /></a></div>
            <div class="panel-cuerpo"><app-grafico-dias [datos]="catorce()" /></div>
          </section>
          <section class="panel">
            <div class="panel-cab"><h3>Lo más vendido hoy</h3></div>
            <div class="panel-cuerpo">
              @for (p of topHoy(); track p.clave) {
                <div class="linea"><b>{{ p.nombre }}{{ p.variante !== 'Unidad' && p.variante !== 'Único' ? ' ' + p.variante.toLowerCase() : '' }}</b><span>{{ p.cantidad }} · {{ plata(p.total) }}</span></div>
              } @empty { <p class="ter">Todavía no hay ventas hoy.</p> }
            </div>
          </section>
        </div>
        <div class="col">
          @if (tienda.turnoAbierto(); as t) {
            <section class="panel">
              <div class="panel-cab"><h3>Turno abierto</h3><a class="derecha btn chico" routerLink="/caja">Ver caja</a></div>
              <div class="panel-cuerpo">
                <div class="linea"><span>Desde</span><b>{{ hora(t.abiertoEn) }} ({{ duracion(t.abiertoEn) }})</b></div>
                <div class="linea"><span>Trabajan</span><b>{{ nombres(t.empleadaIds) }}</b></div>
              </div>
            </section>
          }
          <section class="panel">
            <div class="panel-cab"><lucide-icon [img]="iAlerta" [size]="18" /><h3>Para reponer</h3><a class="derecha btn chico" routerLink="/proveedores"><lucide-icon [img]="iCamion" [size]="15" />Cargar compra</a></div>
            <div class="panel-cuerpo">
              @for (i of reponer(); track i.id) {
                <div class="linea"><span><b>{{ i.nombre }}</b><small>Mínimo {{ cantidadConUnidad(i.minimo, i.unidad) }}</small></span>
                  <span [class]="i.stock <= 0 ? 'etiqueta error' : 'etiqueta atencion'">{{ i.stock <= 0 ? 'Sin stock' : 'Quedan ' + cantidadConUnidad(i.stock, i.unidad) }}</span></div>
              } @empty { <p class="ter">Todo en orden.</p> }
            </div>
          </section>
          <section class="panel">
            <div class="panel-cab"><h3>Les debés a proveedores</h3><b class="derecha num">{{ plata(deuda()) }}</b></div>
          </section>
        </div>
      </div>
    </div>
  `,
})
export class Inicio {
  protected readonly tienda = inject(Tienda);
  private readonly avisos = inject(Avisos);
  protected readonly ahora = Date.now();
  protected readonly diaSemana = new Date().toLocaleDateString('es-AR', { weekday: 'long' });

  private readonly fHoy = filtrosVacios(inicioDelDia(this.ahora), this.ahora + 86_400_000);
  private readonly fSemanaPasada = filtrosVacios(inicioDelDia(this.ahora) - 7 * 86_400_000, this.ahora - 7 * 86_400_000);
  private readonly ventasHoy = computed(() => filtrarVentas(this.tienda.estado().ventas, this.fHoy, []));
  protected readonly hoy = computed(() => resumen(this.ventasHoy(), this.fHoy));
  protected readonly cambioHoy = computed(() => variacion(this.hoy().total, resumen(filtrarVentas(this.tienda.estado().ventas, this.fSemanaPasada, []), this.fSemanaPasada).total));
  protected readonly kilosHoy = computed(() => Math.round(kilosCafe(this.ventasHoy(), this.fHoy, this.tienda.estado().productos, 'i-cafe') * 100) / 100);
  protected readonly abierto = computed(() => this.tienda.estado().cuentas.reduce((s, c) => s + c.items.reduce((a, i) => a + i.precio * i.cantidad, 0) - c.pagos.reduce((a, p) => a + p.monto, 0), 0));
  protected readonly catorce = computed(() => {
    const f = filtrosVacios(inicioDelDia(this.ahora) - 13 * 86_400_000, this.ahora + 1);
    return porDia(filtrarVentas(this.tienda.estado().ventas, f, []), f);
  });
  protected readonly topHoy = computed(() => porProducto(this.ventasHoy(), this.fHoy).sort((a, b) => b.cantidad - a.cantidad).slice(0, 6));
  protected readonly reponer = computed(() => this.tienda.estado().insumos.filter((i) => estadoStock(i) !== 'ok').sort((a, b) => a.stock / (a.minimo || 1) - b.stock / (b.minimo || 1)));
  protected readonly deuda = computed(() => this.tienda.estado().proveedores.reduce((s, p) => s + this.tienda.saldoProveedor(p.id), 0));
  protected readonly diasSinCopia = computed(() => {
    const u = this.tienda.estado().ajustes.copia.ultima;
    return u ? Math.floor((Date.now() - u) / 86_400_000) : 999;
  });

  protected readonly plata = plata;
  protected readonly num = num;
  protected readonly hora = hora;
  protected readonly duracion = duracion;
  protected readonly fechaLarga = fechaLarga;
  protected readonly cantidadConUnidad = cantidadConUnidad;
  protected readonly abs = Math.abs;
  protected readonly iEscudo = ShieldCheck;
  protected readonly iBajar = Download;
  protected readonly iFlecha = ChevronRight;
  protected readonly iAlerta = TriangleAlert;
  protected readonly iCamion = Truck;

  nombres(ids: string[]) {
    return ids.map((id) => this.tienda.nombreUsuario(id)).join(', ');
  }

  copia() {
    descargarTexto(`copia-${aInputFecha(Date.now())}.json`, this.tienda.copiaDeSeguridad());
    this.avisos.mostrar('Copia descargada. Guardala en un lugar seguro.');
  }
}

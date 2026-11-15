import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { Avisos } from '../core/avisos';
import { duracion, fecha, hora, nombreMedio, plata } from '../core/formato';
import { Banknote, CircleCheck, Clock, Lock, Plus, TriangleAlert, X } from '../core/iconos';
import { Billetes, MedioPago } from '../core/modelos';
import { efectivoEsperado, totalesPorMedio, ventasDelTurno } from '../core/reglas';
import { Tienda } from '../core/tienda';
import { ContadorBilletes, totalBilletes } from '../shared/contador-billetes';
import { VentasTurno } from '../shared/ventas-turno';

@Component({
  selector: 'app-caja',
  imports: [FormsModule, LucideAngularModule, RouterLink, ContadorBilletes, VentasTurno],
  styles: `
    .tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--border); }
    .tab { padding: 10px 14px; border: 0; background: transparent; border-bottom: 2px solid transparent; margin-bottom: -1px; font-weight: 650; color: var(--text-2); cursor: pointer;
      &.activo { color: var(--accent-text); border-color: var(--accent-text); } }
    .estado-caja { display: flex; align-items: center; gap: 14px; padding: 16px 18px; flex-wrap: wrap;
      .icono { width: 44px; height: 44px; border-radius: 12px; display: grid; place-items: center; background: var(--ok-soft); color: var(--ok); &.cerrada { background: var(--surface-2); color: var(--text-3); } }
      .texto { flex: 1; min-width: 200px; h2 { font-size: var(--fs-lg); } p { color: var(--text-2); } } }
    .dos { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 18px; align-items: start; }
    .col { display: flex; flex-direction: column; gap: 18px; min-width: 0; }
    .paso { display: flex; flex-direction: column; gap: 14px; }
    .paso h3 { display: flex; align-items: center; gap: 10px; }
    .numero { width: 28px; height: 28px; border-radius: 50%; background: var(--accent); color: var(--accent-ink); display: inline-grid; place-items: center; font-size: var(--fs-sm); font-weight: 700; }
    .medios-lista div { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border); font-variant-numeric: tabular-nums; &:last-child { border: 0; } }
    .mov { display: grid; grid-template-columns: 56px 1fr auto; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--border); align-items: center; font-variant-numeric: tabular-nums; }
    .form-mov { display: grid; grid-template-columns: 170px 130px 1fr auto; gap: 8px; align-items: end; }
    .dif { font-size: 22px; font-weight: 750; font-variant-numeric: tabular-nums; }
    .empleadas { display: flex; flex-wrap: wrap; gap: 14px; }
    .resumen-cierre { display: flex; flex-direction: column; gap: 6px; padding: 12px 14px; background: var(--surface-2); border-radius: var(--r);
      div { display: flex; justify-content: space-between; font-variant-numeric: tabular-nums; } }
    .cuenta-efectivo .linea { display: flex; justify-content: space-between; gap: 12px; padding: 7px 0; border-bottom: 1px solid var(--border); font-variant-numeric: tabular-nums; &.total { border: 0; padding-top: 10px; font-size: var(--fs-md); } }
    .billetes-lista { display: flex; flex-wrap: wrap; gap: 6px; }
    @media (max-width: 1100px) { .dos { grid-template-columns: 1fr; } .form-mov { grid-template-columns: 1fr 1fr; } }
  `,
  template: `
    <div class="pagina">
      <div class="pagina-cab">
        <div class="titulo"><h1>Caja</h1><p>Se abre con el cambio del día y se cierra contando la plata. Todo lo que pasa entre medio es un turno.</p></div>
      </div>

      @if (tienda.esDuena()) {
        <div class="tabs" role="tablist">
          <button class="tab" role="tab" [class.activo]="pestana() === 'hoy'" (click)="pestana.set('hoy')">Caja de hoy</button>
          <button class="tab" role="tab" [class.activo]="pestana() === 'historial'" (click)="pestana.set('historial')">Turnos anteriores</button>
        </div>
      }

      @if (pestana() === 'hoy') {
        @if (turno(); as t) {
          <section class="panel estado-caja">
            <span class="icono"><lucide-icon [img]="iReloj" [size]="22" /></span>
            <div class="texto">
              <h2>Caja abierta · turno {{ nombreDef(t.defId) }}</h2>
              <p>Desde las {{ hora(t.abiertoEn) }} ({{ duracion(t.abiertoEn) }}). Abrió {{ tienda.nombreUsuario(t.abiertoPorId) }} con {{ plata(t.efectivoInicial) }} de cambio. Trabajan: {{ nombresEmpleadas(t.empleadaIds) }}.</p>
            </div>
            @if (pasado()) { <span class="etiqueta atencion"><lucide-icon [img]="iAlerta" [size]="13" />Pasó su horario ({{ defDe(t.defId)?.hasta }})</span> }
            @else { <span class="etiqueta ok"><lucide-icon [img]="iOk" [size]="13" />En horario</span> }
          </section>
          @if (pasado()) {
            <p class="aviso-linea atencion"><lucide-icon [img]="iAlerta" [size]="16" /><span>Ya pasó el horario de referencia. No pasa nada: si siguen trabajando, todo lo que vendan cuenta en este turno. Cuando terminen, cerrá la caja acá abajo.</span></p>
          }

          <div class="indicadores">
            <div class="indicador"><div class="nombre">Vendido en el turno</div><div class="valor">{{ plata(vendido()) }}</div><div class="detalle">{{ ventasTurno().length }} ventas, de mesas y mostrador</div></div>
            <div class="indicador"><div class="nombre">Cobrado en efectivo</div><div class="valor">{{ plata(porMedioMapa().efectivo) }}</div><div class="detalle">Lo demás entró por transferencia, QR o tarjeta</div></div>
            <div class="indicador"><div class="nombre">Efectivo que debería haber en la caja</div><div class="valor">{{ plata(esperado()) }}</div><div class="detalle">Es lo que tenés que contar al cerrar</div></div>
          </div>

          <section class="panel cuenta-efectivo">
            <div class="panel-cab"><h3>Cómo se llega al efectivo que debería haber</h3></div>
            <div class="panel-cuerpo">
              <div class="linea"><span>Cambio con el que se abrió la caja</span><b>{{ plata(t.efectivoInicial) }}</b></div>
              <div class="linea"><span>+ Cobrado en efectivo (mesas y mostrador)</span><b>{{ plata(porMedioMapa().efectivo) }}</b></div>
              <div class="linea"><span>+ Plata que entró</span><b>{{ plata(entradas()) }}</b></div>
              <div class="linea"><span>− Plata que salió (proveedores, compras chicas)</span><b>{{ plata(salidas()) }}</b></div>
              <div class="linea total"><span>= Debería haber</span><b>{{ plata(esperado()) }}</b></div>
            </div>
          </section>

          <div class="dos">
            <div class="col">
              <section class="panel">
                <div class="panel-cab"><h3>Cobrado por medio de pago</h3></div>
                <div class="panel-cuerpo medios-lista">
                  @for (m of porMedio(); track m.medio) { <div><span>{{ nombreMedio(m.medio) }}</span><b>{{ plata(m.total) }}</b></div> }
                </div>
              </section>
              <section class="panel">
                <div class="panel-cab"><h3>Plata que entró o salió de la caja</h3></div>
                <div class="panel-cuerpo">
                  <p class="ter" style="margin-bottom:10px">Pagos a proveedores en efectivo, compras chicas, o si traés más cambio.</p>
                  @for (m of t.movimientos; track m.id) {
                    <div class="mov"><span class="ter">{{ hora(m.fecha) }}</span><span>{{ m.motivo }}</span><b [style.color]="m.tipo === 'egreso' ? 'var(--danger)' : 'var(--ok)'">{{ m.tipo === 'egreso' ? '−' : '+' }}{{ plata(m.monto) }}</b></div>
                  } @empty { <p class="ter">Sin movimientos todavía.</p> }
                  <form class="form-mov" (ngSubmit)="agregarMovimiento()" style="margin-top:12px">
                    <label class="campo"><span>Qué pasó</span><select class="input" name="tipo" [(ngModel)]="movTipo"><option value="egreso">Salió plata</option><option value="ingreso">Entró plata</option></select></label>
                    <label class="campo"><span>Monto</span><span class="input-plata"><input class="input" name="monto" type="number" min="0" [(ngModel)]="movMonto" /></span></label>
                    <label class="campo"><span>Motivo</span><input class="input" name="motivo" [(ngModel)]="movMotivo" placeholder="Ej.: hielo, pago a la panadería" /></label>
                    <button class="btn" type="submit" [disabled]="!movMonto || !movMotivo.trim()"><lucide-icon [img]="iMas" [size]="17" />Anotar</button>
                  </form>
                </div>
              </section>
              <section class="panel">
                <div class="panel-cab"><h3>Ventas del turno</h3><span class="ter derecha">Mesas y mostrador</span></div>
                <app-ventas-turno [ventas]="ventasTurno()" />
              </section>
            </div>

            <section class="panel col" style="gap:0">
              <div class="panel-cab"><lucide-icon [img]="iBillete" [size]="20" /><h3>Cerrar la caja</h3></div>
              <form class="panel-cuerpo paso" (ngSubmit)="cerrar()">
                <p class="sec">Contá los billetes que hay en la caja y anotá cuántos de cada uno. El total se calcula solo.</p>
                <app-contador-billetes [(billetes)]="billetesCierre" etiqueta="Contado en la caja" />
                @if (!ciego()) {
                  <div class="resumen-cierre">
                    <div><span class="sec">Debería haber</span><b>{{ plata(esperado()) }}</b></div>
                    <div><span class="sec">Contaste</span><b>{{ plata(contado()) }}</b></div>
                    <div><span class="sec">Diferencia</span>
                      <span class="dif" [style.color]="diferencia() === 0 ? 'var(--ok)' : 'var(--danger)'">{{ diferencia() === 0 ? 'Cierra justo' : (diferencia() > 0 ? 'Sobran ' : 'Faltan ') + plata(abs(diferencia())) }}</span>
                    </div>
                  </div>
                } @else {
                  <p class="aviso-linea info">Arqueo ciego: la diferencia la ve solo la dueña.</p>
                }
                <label class="campo"><span>Nota (opcional)</span><input class="input" name="nota" [(ngModel)]="nota" placeholder="Ej.: faltó cambio de 100" /></label>
                @if (contado() === 0) { <label class="check"><input type="checkbox" [ngModel]="confirmarCero()" (ngModelChange)="confirmarCero.set($event)" name="cero" />La caja quedó realmente en $ 0</label> }
                <button class="btn primario grande" type="submit" [disabled]="contado() === 0 && !confirmarCero()">Cerrar caja y terminar el turno</button>
              </form>
            </section>
          </div>
        } @else {
          <section class="panel estado-caja">
            <span class="icono cerrada"><lucide-icon [img]="iCandado" [size]="22" /></span>
            <div class="texto"><h2>Caja cerrada</h2><p>Para vender hay que abrirla. Lleva un minuto: quién trabaja y con cuánto cambio arranca.</p></div>
          </section>

          <form class="dos" (ngSubmit)="abrir()">
            <section class="panel col" style="gap:0">
              <div class="panel-cab"><h3><span class="numero">1</span> ¿Qué turno arranca y quiénes trabajan?</h3></div>
              <div class="panel-cuerpo paso">
                <div class="segmentos">
                  @for (d of defs(); track d.id) {
                    <button type="button" [class.activo]="abrirDef === d.id" (click)="abrirDef = d.id">{{ d.nombre }} <span class="ter">{{ d.desde }}–{{ d.hasta }}</span></button>
                  }
                </div>
                <p class="ter">El horario es solo de referencia: el turno dura hasta que cierres la caja. @if (tienda.esDuena()) { Los turnos se cambian en <a routerLink="/ajustes">Ajustes</a>. }</p>
                <span class="campo"><span>Trabajan</span></span>
                <div class="empleadas">
                  @for (u of activas(); track u.id) {
                    <label class="check"><input type="checkbox" [checked]="abrirEquipo.includes(u.id)" (change)="alternarEquipo(u.id)" />{{ u.nombre }}</label>
                  }
                </div>
              </div>
            </section>
            <section class="panel col" style="gap:0">
              <div class="panel-cab"><h3><span class="numero">2</span> ¿Con cuánto cambio arranca?</h3></div>
              <div class="panel-cuerpo paso">
                <p class="sec">Anotá los billetes que dejás en la caja para dar vuelto.</p>
                <app-contador-billetes [(billetes)]="billetesInicio" etiqueta="Arranca con" />
                <p class="aviso-linea"><lucide-icon [img]="iBillete" [size]="16" /><span>Arrancás el día con <b>{{ plata(inicial()) }}</b> de cambio.</span></p>
                <button class="btn primario grande" type="submit" [disabled]="!abrirDef"><lucide-icon [img]="iReloj" [size]="18" />Abrir la caja</button>
              </div>
            </section>
          </form>
        }
      } @else {
        <section class="panel">
          <div class="panel-cab"><h3>Turnos anteriores</h3><span class="ter">Tocá un turno para ver qué se vendió y cómo cerró la caja</span></div>
          <div class="tabla-envoltura">
            <table class="tabla">
              <thead><tr><th>Día</th><th>Turno</th><th>Horario real</th><th>Duración</th><th>Trabajaron</th><th class="num">Cambio inicial</th><th class="num">Vendido</th><th>Caja</th></tr></thead>
              <tbody>
                @for (t of historial(); track t.id) {
                  <tr class="clic" (click)="detalle.set(t.id)">
                    <td>{{ fecha(t.abiertoEn) }}</td>
                    <td>{{ nombreDef(t.defId) }}</td>
                    <td class="num" style="text-align:left">{{ hora(t.abiertoEn) }} a {{ hora(t.cerradoEn!) }}</td>
                    <td>{{ duracion(t.abiertoEn, t.cerradoEn!) }}</td>
                    <td class="sec">{{ nombresEmpleadas(trabajaron(t)) }}</td>
                    <td class="num sec">{{ plata(t.efectivoInicial) }}</td>
                    <td class="num">{{ plata(t.vendido) }}</td>
                    <td>
                      @if (!t.arqueo || t.arqueo.diferencia === 0) { <span class="etiqueta ok"><lucide-icon [img]="iOk" [size]="12" />Cerró justo</span> }
                      @else if (t.arqueo.diferencia < 0) { <span class="etiqueta error">Faltaron {{ plata(-t.arqueo.diferencia) }}</span> }
                      @else { <span class="etiqueta atencion">Sobraron {{ plata(t.arqueo.diferencia) }}</span> }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>
      }
    </div>

    @if (turnoDetalle(); as t) {
      <div class="lateral-fondo" (click)="detalle.set(null)"></div>
      <aside class="lateral ancho" role="dialog" aria-label="Detalle del turno">
        <div class="lateral-cab">
          <div><h2>Turno {{ nombreDef(t.defId) }} · {{ fecha(t.abiertoEn) }}</h2><p class="ter">{{ hora(t.abiertoEn) }} a {{ hora(t.cerradoEn!) }} ({{ duracion(t.abiertoEn, t.cerradoEn!) }}) · {{ nombresEmpleadas(trabajaron(t)) }}</p></div>
          <button class="btn icono fantasma" (click)="detalle.set(null)" aria-label="Cerrar"><lucide-icon [img]="iX" [size]="20" /></button>
        </div>
        <div class="lateral-cuerpo">
          <div class="indicadores">
            <div class="indicador"><div class="nombre">Vendido</div><div class="valor">{{ plata(t.vendido) }}</div><div class="detalle">{{ t.cantidad }} ventas</div></div>
            <div class="indicador"><div class="nombre">En efectivo</div><div class="valor">{{ plata(t.medios.efectivo) }}</div></div>
            <div class="indicador"><div class="nombre">Caja al cerrar</div><div class="valor">{{ t.arqueo ? plata(t.arqueo.contado) : '—' }}</div>
              <div class="detalle">@if (t.arqueo) { Debía haber {{ plata(t.arqueo.esperado) }} }</div></div>
          </div>
          @if (t.arqueo?.nota) { <p class="aviso-linea">Nota: {{ t.arqueo!.nota }}</p> }
          <h3>Cobrado por medio de pago</h3>
          <div class="medios-lista">
            @for (m of mediosLista(t.medios); track m.medio) { <div><span>{{ nombreMedio(m.medio) }}</span><b>{{ plata(m.total) }}</b></div> }
          </div>
          @if (t.movimientos.length) {
            <h3>Plata que entró o salió</h3>
            <div>@for (m of t.movimientos; track m.id) { <div class="mov"><span class="ter">{{ hora(m.fecha) }}</span><span>{{ m.motivo }}</span><b>{{ m.tipo === 'egreso' ? '−' : '+' }}{{ plata(m.monto) }}</b></div> }</div>
          }
          @if (t.arqueo?.billetes) {
            <h3>Billetes contados al cerrar</h3>
            <div class="billetes-lista">
              @for (b of billetesLista(t.arqueo!.billetes!); track b.valor) { <span class="etiqueta">{{ b.valor === 'otros' ? 'Otros ' + plata(b.cantidad) : b.cantidad + ' × $ ' + formatear(+b.valor) }}</span> }
            </div>
          }
          <h3>Ventas del turno</h3>
          <app-ventas-turno [ventas]="t.ventas" />
        </div>
      </aside>
    }
  `,
})
export class Caja {
  protected readonly tienda = inject(Tienda);
  private readonly avisos = inject(Avisos);

  protected readonly pestana = signal<'hoy' | 'historial'>('hoy');
  protected readonly turno = this.tienda.turnoAbierto;
  protected readonly defs = computed(() => this.tienda.estado().turnoDefs);
  protected readonly activas = computed(() => this.tienda.estado().usuarios.filter((u) => u.activo && u.rol === 'empleada'));
  protected readonly ventasTurno = computed(() => (this.turno() ? ventasDelTurno(this.tienda.estado().ventas, this.turno()!.id) : []));
  protected readonly vendido = computed(() => this.ventasTurno().reduce((s, v) => s + v.total, 0));
  protected readonly esperado = computed(() => (this.turno() ? efectivoEsperado(this.turno()!, this.tienda.estado().ventas) : 0));
  protected readonly porMedioMapa = computed(() => totalesPorMedio(this.ventasTurno()));
  protected readonly porMedio = computed(() => {
    const t = this.porMedioMapa();
    return (Object.keys(t) as MedioPago[]).map((medio) => ({ medio, total: t[medio] }));
  });
  protected readonly ciego = computed(() => this.tienda.estado().ajustes.arqueoCiego && !this.tienda.esDuena());
  protected readonly pasado = computed(() => {
    const t = this.turno();
    const d = t && this.defDe(t.defId);
    if (!t || !d) return false;
    const [h, m] = d.hasta.split(':').map(Number);
    const lim = new Date(t.abiertoEn);
    lim.setHours(h, m, 0, 0);
    return Date.now() > lim.getTime();
  });
  protected readonly entradas = computed(() => this.turno()?.movimientos.filter((m) => m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0) ?? 0);
  protected readonly salidas = computed(() => this.turno()?.movimientos.filter((m) => m.tipo === 'egreso').reduce((s, m) => s + m.monto, 0) ?? 0);
  protected readonly historial = computed(() => {
    const e = this.tienda.estado();
    return e.turnos.filter((t) => t.cerradoEn).sort((a, b) => b.abiertoEn - a.abiertoEn).slice(0, 60)
      .map((t) => ({ ...t, vendido: ventasDelTurno(e.ventas, t.id).reduce((s, v) => s + v.total, 0) }));
  });
  protected readonly detalle = signal<string | null>(null);
  protected readonly turnoDetalle = computed(() => {
    const t = this.tienda.estado().turnos.find((x) => x.id === this.detalle());
    if (!t) return null;
    const ventas = ventasDelTurno(this.tienda.estado().ventas, t.id);
    // En la lista se ven también las anuladas (tachadas); en los totales, no.
    const todas = this.tienda.estado().ventas.filter((v) => v.turnoId === t.id).sort((a, b) => b.fecha - a.fecha);
    return { ...t, ventas: todas, cantidad: ventas.length, vendido: ventas.reduce((s, v) => s + v.total, 0), medios: totalesPorMedio(ventas) };
  });

  protected readonly billetesCierre = signal<Billetes>({});
  protected readonly contado = computed(() => totalBilletes(this.billetesCierre()));
  protected readonly diferencia = computed(() => this.contado() - this.esperado());
  protected readonly confirmarCero = signal(false);
  protected readonly billetesInicio = signal<Billetes>(this.ultimoCambio());
  protected readonly inicial = computed(() => totalBilletes(this.billetesInicio()));

  protected movTipo: 'ingreso' | 'egreso' = 'egreso';
  protected movMonto: number | null = null;
  protected movMotivo = '';
  protected nota = '';
  protected abrirDef = this.sugerirDef();
  protected abrirEquipo: string[] = [this.tienda.usuario()?.id ?? ''].filter((id) => this.tienda.estado().usuarios.find((u) => u.id === id)?.rol === 'empleada');

  protected readonly plata = plata;
  protected readonly hora = hora;
  protected readonly fecha = fecha;
  protected readonly duracion = duracion;
  protected readonly nombreMedio = nombreMedio;
  protected readonly abs = Math.abs;
  protected readonly iReloj = Clock;
  protected readonly iAlerta = TriangleAlert;
  protected readonly iMas = Plus;
  protected readonly iCandado = Lock;
  protected readonly iBillete = Banknote;
  protected readonly iOk = CircleCheck;
  protected readonly iX = X;

  mediosLista(m: Record<MedioPago, number>) {
    return (Object.keys(m) as MedioPago[]).map((medio) => ({ medio, total: m[medio] })).filter((x) => x.total > 0);
  }

  billetesLista(b: Billetes) {
    return Object.entries(b).filter(([, c]) => c > 0).map(([valor, cantidad]) => ({ valor, cantidad })).sort((a, b) => (b.valor === 'otros' ? -1 : +b.valor) - (a.valor === 'otros' ? -1 : +a.valor));
  }

  formatear(v: number) {
    return v.toLocaleString('es-AR');
  }

  defDe(id: string) {
    return this.tienda.estado().turnoDefs.find((d) => d.id === id);
  }

  nombreDef(id: string) {
    return this.defDe(id)?.nombre.toLowerCase() ?? 'turno';
  }

  /** Las que se anotaron al abrir la caja y, además, quienes cobraron algo en el turno. */
  trabajaron(t: { id: string; empleadaIds: string[] }): string[] {
    const cobraron = this.tienda.estado().ventas.filter((v) => v.turnoId === t.id).map((v) => v.usuarioId);
    return [...new Set([...t.empleadaIds, ...cobraron])].filter(Boolean);
  }

  nombresEmpleadas(ids: string[]) {
    return ids.map((id) => this.tienda.nombreUsuario(id)).join(', ') || '—';
  }

  /** Sugiere los billetes del último turno, para no cargarlos de nuevo cada día. */
  private ultimoCambio(): Billetes {
    const t = [...this.tienda.estado().turnos].sort((a, b) => b.abiertoEn - a.abiertoEn)[0];
    return t?.billetesInicial ? { ...t.billetesInicial } : {};
  }

  private sugerirDef(): string {
    const ahora = new Date();
    const min = ahora.getHours() * 60 + ahora.getMinutes();
    const defs = this.tienda.estado().turnoDefs;
    // El último turno que ya empezó (con una hora de margen antes); si todavía no empezó ninguno, el primero.
    const aMin = (h: string) => { const [a, b] = h.split(':').map(Number); return a * 60 + b; };
    const empezados = defs.filter((x) => min >= aMin(x.desde) - 60).sort((a, b) => aMin(b.desde) - aMin(a.desde));
    return (empezados[0] ?? defs[0])?.id ?? '';
  }

  alternarEquipo(id: string) {
    this.abrirEquipo = this.abrirEquipo.includes(id) ? this.abrirEquipo.filter((x) => x !== id) : [...this.abrirEquipo, id];
  }

  async abrir() {
    this.tienda.abrirTurno(this.abrirDef, this.abrirEquipo, this.inicial(), this.billetesInicio());
    // Si la base lo rechaza, ya se avisó el error y se recargaron los datos.
    if (!(await this.tienda.confirmarGuardado())) return;
    this.avisos.mostrar(`Caja abierta con ${plata(this.inicial())} de cambio`);
    this.billetesCierre.set({});
    this.confirmarCero.set(false);
  }

  agregarMovimiento() {
    if (!this.movMonto || !this.movMotivo.trim()) return;
    this.tienda.movimientoCaja(this.movTipo, this.movMonto, this.movMotivo.trim());
    this.movMonto = null;
    this.movMotivo = '';
  }

  async cerrar() {
    const dif = this.diferencia();
    this.tienda.cerrarTurno(this.contado(), this.esperado(), this.nota, this.billetesCierre());
    if (!(await this.tienda.confirmarGuardado())) return;
    this.avisos.mostrar(dif === 0 ? 'Caja cerrada. Cerró justo.' : `Caja cerrada. ${dif > 0 ? 'Sobraron' : 'Faltaron'} ${plata(Math.abs(dif))}.`, dif === 0 ? 'ok' : 'info');
    this.nota = '';
    this.billetesCierre.set({});
    this.billetesInicio.set(this.ultimoCambio());
    this.abrirDef = this.sugerirDef();
  }
}

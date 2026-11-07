import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { Avisos } from '../core/avisos';
import { duracion, fecha, hora, nombreMedio, plata } from '../core/formato';
import { Banknote, CircleCheck, Clock, Lock, Plus, Trash2, TriangleAlert } from '../core/iconos';
import { MedioPago, TurnoDef } from '../core/modelos';
import { efectivoEsperado, totalesPorMedio, ventasDelTurno } from '../core/reglas';
import { nuevoId, Tienda } from '../core/tienda';

@Component({
  selector: 'app-caja',
  imports: [FormsModule, LucideAngularModule],
  styles: `
    .dos { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); gap: 18px; align-items: start; }
    .col { display: flex; flex-direction: column; gap: 18px; min-width: 0; }
    .turno-cab { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .medios-lista { display: flex; flex-direction: column; }
    .medios-lista div { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border); font-variant-numeric: tabular-nums; &:last-child { border: 0; } }
    .mov { display: grid; grid-template-columns: 56px 1fr auto; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--border); align-items: center; font-variant-numeric: tabular-nums; }
    .form-mov { display: grid; grid-template-columns: 170px 130px 1fr auto; gap: 8px; align-items: end; }
    .cierre { display: flex; flex-direction: column; gap: 12px; }
    .dif { font-size: 22px; font-weight: 750; font-variant-numeric: tabular-nums; }
    .defs { display: grid; grid-template-columns: minmax(0, 1fr) 128px 128px auto; gap: 8px; align-items: center; }
    .empleadas { display: flex; flex-wrap: wrap; gap: 14px; }
    @media (max-width: 1100px) { .dos { grid-template-columns: 1fr; } .form-mov { grid-template-columns: 1fr 1fr; } }
  `,
  template: `
    <div class="pagina">
      <div class="pagina-cab">
        <div class="titulo"><h1>Turnos y caja</h1><p>El turno dura hasta que se cierra la caja. Si se quedan más tiempo, todo lo vendido cuenta en ese turno.</p></div>
      </div>

      <div class="dos">
        <div class="col">
          @if (turno(); as t) {
            <section class="panel">
              <div class="panel-cab">
                <lucide-icon [img]="iReloj" [size]="20" />
                <h2>Turno {{ nombreDef(t.defId) }} · abierto</h2>
                <span class="etiqueta ok derecha">Desde {{ hora(t.abiertoEn) }} · {{ duracion(t.abiertoEn) }}</span>
              </div>
              <div class="panel-cuerpo" style="display:flex;flex-direction:column;gap:14px">
                <p class="sec">Lo abrió {{ tienda.nombreUsuario(t.abiertoPorId) }}. Trabajan: {{ nombresEmpleadas(t.empleadaIds) }}. Horario de referencia: {{ defDe(t.defId)?.desde }} a {{ defDe(t.defId)?.hasta }}.</p>
                @if (pasado()) {
                  <p class="aviso-linea atencion"><lucide-icon [img]="iAlerta" [size]="16" /><span>Ya pasó el horario de referencia ({{ defDe(t.defId)?.hasta }}). Si terminaron, cerrá la caja. Si siguen trabajando, no pasa nada: todo cuenta en este turno.</span></p>
                }
                <div class="indicadores">
                  <div class="indicador"><div class="nombre">Vendido en el turno</div><div class="valor">{{ plata(vendido()) }}</div><div class="detalle">{{ ventasTurno().length }} ventas</div></div>
                  <div class="indicador"><div class="nombre">Efectivo que debería haber</div><div class="valor">{{ plata(esperado()) }}</div><div class="detalle">Incluye {{ plata(t.efectivoInicial) }} de inicio</div></div>
                </div>
              </div>
            </section>

            <section class="panel">
              <div class="panel-cab"><h3>Cobrado por medio de pago</h3></div>
              <div class="panel-cuerpo medios-lista">
                @for (m of porMedio(); track m.medio) {
                  <div><span>{{ nombreMedio(m.medio) }}</span><b>{{ plata(m.total) }}</b></div>
                }
              </div>
            </section>

            <section class="panel">
              <div class="panel-cab"><h3>Entradas y salidas de efectivo</h3><span class="ter">Pagos al proveedor, cambio, compras chicas</span></div>
              <div class="panel-cuerpo">
                @for (m of t.movimientos; track m.id) {
                  <div class="mov"><span class="ter">{{ hora(m.fecha) }}</span><span>{{ m.motivo }}</span><b [style.color]="m.tipo === 'egreso' ? 'var(--danger)' : 'var(--ok)'">{{ m.tipo === 'egreso' ? '−' : '+' }}{{ plata(m.monto) }}</b></div>
                } @empty {
                  <p class="ter" style="margin-bottom:12px">Sin movimientos en este turno.</p>
                }
                <form class="form-mov" (ngSubmit)="agregarMovimiento()" style="margin-top:12px">
                  <label class="campo"><span>Tipo</span><select class="input" name="tipo" [(ngModel)]="movTipo"><option value="egreso">Sale de la caja</option><option value="ingreso">Entra a la caja</option></select></label>
                  <label class="campo"><span>Monto</span><span class="input-plata"><input class="input" name="monto" type="number" min="0" [(ngModel)]="movMonto" /></span></label>
                  <label class="campo"><span>Motivo</span><input class="input" name="motivo" [(ngModel)]="movMotivo" placeholder="Ej.: hielo, cambio, pago a la panadería" /></label>
                  <button class="btn" type="submit" [disabled]="!movMonto || !movMotivo.trim()"><lucide-icon [img]="iMas" [size]="17" />Anotar</button>
                </form>
              </div>
            </section>
          } @else {
            <section class="panel">
              <div class="panel-cab"><lucide-icon [img]="iCandado" [size]="20" /><h2>La caja está cerrada</h2></div>
              <form class="panel-cuerpo cierre" (ngSubmit)="abrir()">
                <label class="campo"><span>¿Qué turno arranca?</span>
                  <select class="input" name="def" [(ngModel)]="abrirDef">
                    @for (d of defs(); track d.id) { <option [value]="d.id">{{ d.nombre }} ({{ d.desde }} a {{ d.hasta }})</option> }
                  </select>
                </label>
                <span class="campo"><span>¿Quiénes trabajan?</span></span>
                <div class="empleadas">
                  @for (u of activas(); track u.id) {
                    <label class="check"><input type="checkbox" [checked]="abrirEquipo.includes(u.id)" (change)="alternarEquipo(u.id)" />{{ u.nombre }}</label>
                  }
                </div>
                <label class="campo" style="max-width:240px"><span>Efectivo con el que arranca la caja</span><span class="input-plata"><input class="input" name="inicial" type="number" min="0" [(ngModel)]="abrirInicial" /></span></label>
                <div><button class="btn primario grande" type="submit"><lucide-icon [img]="iReloj" [size]="18" />Abrir turno</button></div>
              </form>
            </section>
          }
        </div>

        <div class="col">
          @if (turno()) {
            <section class="panel">
              <div class="panel-cab"><lucide-icon [img]="iBillete" [size]="20" /><h3>Cerrar la caja</h3></div>
              <form class="panel-cuerpo cierre" (ngSubmit)="cerrar()">
                <p class="sec">Contá el efectivo que hay en la caja y anotalo.</p>
                <label class="campo"><span>Efectivo contado</span><span class="input-plata"><input class="input" name="contado" type="number" min="0" [(ngModel)]="contado" /></span></label>
                @if (!ciego()) {
                  <div class="fila" style="justify-content:space-between">
                    <span class="sec">Debería haber</span><b class="num">{{ plata(esperado()) }}</b>
                  </div>
                  @if (contado !== null) {
                    <div class="fila" style="justify-content:space-between">
                      <span class="sec">Diferencia</span>
                      <span class="dif" [style.color]="contado - esperado() === 0 ? 'var(--ok)' : 'var(--danger)'">
                        {{ contado - esperado() === 0 ? 'Cierra justo' : (contado - esperado() > 0 ? 'Sobran ' : 'Faltan ') + plata(abs(contado - esperado())) }}
                      </span>
                    </div>
                  }
                } @else {
                  <p class="aviso-linea info">Arqueo ciego: la diferencia la ve solo la dueña.</p>
                }
                <label class="campo"><span>Nota (opcional)</span><input class="input" name="nota" [(ngModel)]="nota" placeholder="Ej.: faltó cambio" /></label>
                <button class="btn primario grande" type="submit" [disabled]="contado === null">Cerrar caja y terminar turno</button>
              </form>
            </section>
          }

          @if (tienda.esDuena()) {
            <section class="panel">
              <div class="panel-cab"><h3>Turnos de referencia</h3><span class="ter derecha">No cortan solos</span></div>
              <div class="panel-cuerpo" style="display:flex;flex-direction:column;gap:10px">
                <div class="defs ter"><span>Nombre</span><span>Desde</span><span>Hasta</span><span></span></div>
                @for (d of editDefs; track d.id) {
                  <div class="defs">
                    <input class="input" [(ngModel)]="d.nombre" [name]="'n' + d.id" />
                    <input class="input" type="time" [(ngModel)]="d.desde" [name]="'d' + d.id" />
                    <input class="input" type="time" [(ngModel)]="d.hasta" [name]="'h' + d.id" />
                    <button class="btn icono fantasma" (click)="quitarDef(d.id)" [disabled]="editDefs.length === 1" aria-label="Quitar turno"><lucide-icon [img]="iBorrar" [size]="17" /></button>
                  </div>
                }
                <div class="fila">
                  <button class="btn chico" (click)="sumarDef()"><lucide-icon [img]="iMas" [size]="15" />Agregar turno</button>
                  <button class="btn chico primario" style="margin-left:auto" (click)="guardarDefs()">Guardar turnos</button>
                </div>
              </div>
            </section>
          }
        </div>
      </div>

      @if (tienda.esDuena()) {
        <section class="panel">
          <div class="panel-cab"><h3>Turnos anteriores</h3><span class="ter">Horario real de cada turno y cómo cerró la caja</span></div>
          <div class="tabla-envoltura">
            <table class="tabla">
              <thead><tr><th>Día</th><th>Turno</th><th>Horario real</th><th>Duración</th><th>Trabajaron</th><th class="num">Vendido</th><th>Caja</th></tr></thead>
              <tbody>
                @for (t of historial(); track t.id) {
                  <tr>
                    <td>{{ fecha(t.abiertoEn) }}</td>
                    <td>{{ nombreDef(t.defId) }}</td>
                    <td class="num" style="text-align:left">{{ hora(t.abiertoEn) }} a {{ hora(t.cerradoEn!) }}</td>
                    <td>{{ duracion(t.abiertoEn, t.cerradoEn!) }}</td>
                    <td class="sec">{{ nombresEmpleadas(t.empleadaIds) }}</td>
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
  `,
})
export class Caja {
  protected readonly tienda = inject(Tienda);
  private readonly avisos = inject(Avisos);

  protected readonly turno = this.tienda.turnoAbierto;
  protected readonly defs = computed(() => this.tienda.estado().turnoDefs);
  protected readonly activas = computed(() => this.tienda.estado().usuarios.filter((u) => u.activo && u.rol === 'empleada'));
  protected readonly ventasTurno = computed(() => (this.turno() ? ventasDelTurno(this.tienda.estado().ventas, this.turno()!.id) : []));
  protected readonly vendido = computed(() => this.ventasTurno().reduce((s, v) => s + v.total, 0));
  protected readonly esperado = computed(() => (this.turno() ? efectivoEsperado(this.turno()!, this.tienda.estado().ventas) : 0));
  protected readonly porMedio = computed(() => {
    const t = totalesPorMedio(this.ventasTurno());
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
  protected readonly historial = computed(() => {
    const e = this.tienda.estado();
    return e.turnos
      .filter((t) => t.cerradoEn)
      .sort((a, b) => b.abiertoEn - a.abiertoEn)
      .slice(0, 30)
      .map((t) => ({ ...t, vendido: ventasDelTurno(e.ventas, t.id).reduce((s, v) => s + v.total, 0) }));
  });

  protected movTipo: 'ingreso' | 'egreso' = 'egreso';
  protected movMonto: number | null = null;
  protected movMotivo = '';
  protected contado: number | null = null;
  protected nota = '';
  protected abrirDef = this.sugerirDef();
  protected abrirEquipo: string[] = [this.tienda.usuario()?.id ?? ''].filter((id) => this.tienda.estado().usuarios.find((u) => u.id === id)?.rol === 'empleada');
  protected abrirInicial = 20000;
  protected editDefs: TurnoDef[] = this.tienda.estado().turnoDefs.map((d) => ({ ...d }));

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
  protected readonly iBorrar = Trash2;
  protected readonly iOk = CircleCheck;

  defDe(id: string) {
    return this.tienda.estado().turnoDefs.find((d) => d.id === id);
  }

  nombreDef(id: string) {
    return this.defDe(id)?.nombre ?? 'Turno';
  }

  nombresEmpleadas(ids: string[]) {
    return ids.map((id) => this.tienda.nombreUsuario(id)).join(', ') || '—';
  }

  private sugerirDef(): string {
    const ahora = new Date();
    const min = ahora.getHours() * 60 + ahora.getMinutes();
    const defs = this.tienda.estado().turnoDefs;
    const d = defs.find((x) => {
      const [h1, m1] = x.desde.split(':').map(Number);
      const [h2, m2] = x.hasta.split(':').map(Number);
      return min >= h1 * 60 + m1 - 60 && min < h2 * 60 + m2;
    });
    return (d ?? defs[0])?.id ?? '';
  }

  alternarEquipo(id: string) {
    this.abrirEquipo = this.abrirEquipo.includes(id) ? this.abrirEquipo.filter((x) => x !== id) : [...this.abrirEquipo, id];
  }

  abrir() {
    this.tienda.abrirTurno(this.abrirDef, this.abrirEquipo, this.abrirInicial || 0);
    this.avisos.mostrar(`Turno ${this.nombreDef(this.abrirDef).toLowerCase()} abierto`);
  }

  agregarMovimiento() {
    if (!this.movMonto || !this.movMotivo.trim()) return;
    this.tienda.movimientoCaja(this.movTipo, this.movMonto, this.movMotivo.trim());
    this.movMonto = null;
    this.movMotivo = '';
  }

  cerrar() {
    if (this.contado === null) return;
    const dif = this.contado - this.esperado();
    this.tienda.cerrarTurno(this.contado, this.esperado(), this.nota);
    this.avisos.mostrar(dif === 0 ? 'Caja cerrada. Cerró justo.' : `Caja cerrada. ${dif > 0 ? 'Sobraron' : 'Faltaron'} ${plata(Math.abs(dif))}.`, dif === 0 ? 'ok' : 'info');
    this.contado = null;
    this.nota = '';
    this.abrirDef = this.sugerirDef();
  }

  sumarDef() {
    this.editDefs = [...this.editDefs, { id: nuevoId('td'), nombre: 'Noche', desde: '20:00', hasta: '02:00' }];
  }

  quitarDef(id: string) {
    this.editDefs = this.editDefs.filter((d) => d.id !== id);
  }

  guardarDefs() {
    this.tienda.guardarTurnoDefs(this.editDefs.filter((d) => d.nombre.trim()));
    this.avisos.mostrar('Turnos guardados');
  }
}

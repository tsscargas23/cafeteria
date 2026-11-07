import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { Avisos } from '../core/avisos';
import { descargarTexto } from '../core/excel';
import { aInputFecha, fechaHora } from '../core/formato';
import { Download, Info, Mail, RotateCcw, ShieldCheck, Upload } from '../core/iconos';
import { Ajustes, MEDIOS_PAGO, MedioPago } from '../core/modelos';
import { Tienda } from '../core/tienda';

@Component({
  selector: 'app-ajustes',
  imports: [FormsModule, LucideAngularModule],
  styles: `
    .dos { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; align-items: start; }
    form, .bloque { display: flex; flex-direction: column; gap: 14px; }
    .medios { display: flex; flex-wrap: wrap; gap: 14px; }
    @media (max-width: 1000px) { .dos { grid-template-columns: 1fr; } }
  `,
  template: `
    <div class="pagina">
      <div class="pagina-cab"><div class="titulo"><h1>Ajustes</h1><p>Datos del local, cómo cobrás y las copias de seguridad.</p></div></div>
      <div class="dos">
        <section class="panel">
          <div class="panel-cab"><h3>Datos del local</h3></div>
          <form class="panel-cuerpo" (ngSubmit)="guardar()">
            <label class="campo"><span>Nombre de la cafetería</span><input class="input" name="nombre" [(ngModel)]="a.nombreLocal" /><small>Sale en el panel, en los tickets y en la carta.</small></label>
            <label class="campo"><span>Dirección</span><input class="input" name="dir" [(ngModel)]="a.direccion" /></label>
            <div class="grilla-2">
              <label class="campo"><span>Teléfono</span><input class="input" name="tel" [(ngModel)]="a.telefono" /></label>
              <label class="campo"><span>Alias para transferencias</span><input class="input" name="alias" [(ngModel)]="a.alias" /></label>
            </div>
            <span class="campo"><span>Medios de pago que aceptás</span></span>
            <div class="medios">
              @for (m of medios; track m.id) {
                <label class="check"><input type="checkbox" [checked]="a.mediosActivos.includes(m.id)" (change)="alternarMedio(m.id)" />{{ m.nombre }}</label>
              }
            </div>
            <label class="interruptor"><input type="checkbox" name="ciego" [(ngModel)]="a.arqueoCiego" />Arqueo ciego: las empleadas cuentan la caja sin ver cuánto debería haber</label>
            <div><button class="btn primario" type="submit">Guardar cambios</button></div>
          </form>
        </section>

        <section class="panel">
          <div class="panel-cab"><lucide-icon [img]="iEscudo" [size]="20" /><h3>Copia de seguridad</h3></div>
          <div class="panel-cuerpo bloque">
            <p class="sec">Como en WhatsApp: cada tanto se guarda una copia con todos tus datos (ventas, productos, inventario, empleadas). Si algo pasa, se restaura desde ahí.</p>
            <div class="grilla-2">
              <label class="campo"><span>Hacer una copia cada</span>
                <select class="input" [(ngModel)]="a.copia.cadaDias"><option [ngValue]="1">Todos los días</option><option [ngValue]="3">3 días</option><option [ngValue]="7">Semana</option><option [ngValue]="15">15 días</option><option [ngValue]="30">Mes</option></select>
              </label>
              <label class="campo"><span>Mandarla a este email</span><input class="input" type="email" [(ngModel)]="a.copia.email" /></label>
            </div>
            <p class="aviso-linea info"><lucide-icon [img]="iMail" [size]="16" /><span>En el sistema real la copia llega sola por email con un archivo adjunto. En esta demo se descarga a la compu.</span></p>
            <p class="ter">Última copia: {{ tienda.estado().ajustes.copia.ultima ? fechaHora(tienda.estado().ajustes.copia.ultima!) : 'nunca' }}</p>
            <div class="fila">
              <button class="btn primario" (click)="copia()"><lucide-icon [img]="iBajar" [size]="18" />Descargar copia ahora</button>
              <label class="btn"><lucide-icon [img]="iSubir" [size]="18" />Restaurar desde una copia<input type="file" accept=".json,application/json" hidden (change)="restaurar($any($event.target).files?.[0])" /></label>
              <button class="btn fantasma" (click)="guardar()">Guardar frecuencia</button>
            </div>
          </div>
        </section>

        <section class="panel">
          <div class="panel-cab"><lucide-icon [img]="iInfo" [size]="20" /><h3>Sobre esta demo</h3></div>
          <div class="panel-cuerpo bloque">
            <p class="sec">Los datos son de ejemplo y se guardan solo en este navegador. Podés probar todo sin miedo: con este botón vuelve a como estaba al principio.</p>
            @if (confirmar()) {
              <div class="fila"><span class="sec">¿Seguro? Se pierde lo que cargaste.</span><button class="btn peligro" (click)="reiniciar()">Sí, reiniciar</button><button class="btn" (click)="confirmar.set(false)">No</button></div>
            } @else {
              <div><button class="btn" (click)="confirmar.set(true)"><lucide-icon [img]="iReiniciar" [size]="18" />Reiniciar la demo</button></div>
            }
          </div>
        </section>
      </div>
    </div>
  `,
})
export class AjustesPagina {
  protected readonly tienda = inject(Tienda);
  private readonly avisos = inject(Avisos);
  private readonly router = inject(Router);
  protected a: Ajustes = structuredClone(this.tienda.estado().ajustes);
  protected readonly confirmar = signal(false);
  protected readonly medios = MEDIOS_PAGO;
  protected readonly fechaHora = fechaHora;
  protected readonly iEscudo = ShieldCheck;
  protected readonly iBajar = Download;
  protected readonly iSubir = Upload;
  protected readonly iMail = Mail;
  protected readonly iInfo = Info;
  protected readonly iReiniciar = RotateCcw;

  alternarMedio(m: MedioPago) {
    this.a.mediosActivos = this.a.mediosActivos.includes(m) ? this.a.mediosActivos.filter((x) => x !== m) : [...this.a.mediosActivos, m];
  }

  guardar() {
    if (!this.a.nombreLocal.trim()) {
      this.avisos.mostrar('El nombre del local no puede quedar vacío.', 'error');
      return;
    }
    if (!this.a.mediosActivos.length) {
      this.avisos.mostrar('Dejá al menos un medio de pago.', 'error');
      return;
    }
    this.tienda.guardarAjustes({ ...this.a, copia: { ...this.a.copia, ultima: this.tienda.estado().ajustes.copia.ultima } });
    this.avisos.mostrar('Ajustes guardados');
  }

  copia() {
    descargarTexto(`copia-${aInputFecha(Date.now())}.json`, this.tienda.copiaDeSeguridad());
    this.avisos.mostrar('Copia descargada. Guardala en un lugar seguro (por ejemplo, Google Drive).');
  }

  async restaurar(archivo: File | undefined) {
    if (!archivo) return;
    const error = this.tienda.restaurar(await archivo.text());
    if (error) this.avisos.mostrar(error, 'error');
    else {
      this.a = structuredClone(this.tienda.estado().ajustes);
      this.avisos.mostrar('Copia restaurada');
    }
  }

  reiniciar() {
    this.tienda.reiniciarDemo();
    this.a = structuredClone(this.tienda.estado().ajustes);
    this.confirmar.set(false);
    this.avisos.mostrar('La demo volvió a empezar');
    this.router.navigateByUrl('/inicio');
  }
}

import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { Avisos } from './core/avisos';
import { CircleCheck, CircleX, Info, X } from './core/iconos';
import { Ticket } from './shared/ticket';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, LucideAngularModule, Ticket],
  template: `
    <router-outlet />
    <app-ticket />
    <div class="avisos" aria-live="polite">
      @for (a of avisos.lista(); track a.id) {
        <div class="aviso" role="status">
          <lucide-icon [img]="a.tipo === 'ok' ? iOk : a.tipo === 'error' ? iError : iInfo" [size]="18" [class]="a.tipo" />
          <span>{{ a.texto }}</span>
          @if (a.accion; as ac) {
            <button class="btn chico" (click)="ac.fn(); avisos.cerrar(a.id)">{{ ac.texto }}</button>
          }
          <button class="btn chico icono fantasma" style="color:#fff" (click)="avisos.cerrar(a.id)" aria-label="Cerrar aviso"><lucide-icon [img]="iX" [size]="16" /></button>
        </div>
      }
    </div>
  `,
})
export class App {
  protected readonly avisos = inject(Avisos);
  protected readonly iOk = CircleCheck;
  protected readonly iError = CircleX;
  protected readonly iInfo = Info;
  protected readonly iX = X;
}

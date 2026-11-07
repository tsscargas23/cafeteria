import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { iniciales } from '../core/formato';
import { Coffee, Eye, EyeOff, Info, Lock } from '../core/iconos';
import { Usuario } from '../core/modelos';
import { Tienda } from '../core/tienda';

@Component({
  selector: 'app-ingresar',
  imports: [FormsModule, LucideAngularModule],
  styles: `
    :host { display: grid; place-items: center; min-height: 100vh; padding: 24px 16px; }
    .tarjeta { width: min(440px, 100%); display: flex; flex-direction: column; gap: 18px; }
    .cab { display: flex; align-items: center; gap: 12px; }
    .logo { width: 44px; height: 44px; border-radius: 12px; background: var(--accent); color: #fff; display: grid; place-items: center; }
    form { display: flex; flex-direction: column; gap: 14px; padding: 22px; }
    .clave { position: relative; .input { padding-right: 44px; } button { position: absolute; right: 4px; top: 4px; } }
    .personas { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 8px; }
    .persona { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 12px 8px; border: 1px solid var(--border-strong); border-radius: var(--r); background: var(--surface); cursor: pointer; font-weight: 600;
      &:hover { background: var(--surface-2); } &.activo { border-color: var(--accent); background: var(--accent-soft); color: var(--accent-text); } }
    .av { width: 40px; height: 40px; border-radius: 50%; background: var(--surface-3); display: grid; place-items: center; font-weight: 700; color: var(--text-2); }
    .pin { font-size: 28px; letter-spacing: 0.5em; text-align: center; font-variant-numeric: tabular-nums; }
    .demo { display: flex; flex-direction: column; gap: 10px; }
    .demo .fila .btn { flex: 1; }
  `,
  template: `
    <div class="tarjeta">
      <div class="cab">
        <span class="logo"><lucide-icon [img]="iCafe" [size]="24" /></span>
        <div><h1 style="font-size:22px">{{ tienda.estado().ajustes.nombreLocal }}</h1><p class="sec">Panel de gestión</p></div>
      </div>

      <div class="panel">
        <div style="padding: 14px 22px 0">
          <div class="segmentos grandes" role="tablist">
            <button role="tab" [class.activo]="modo() === 'clave'" (click)="modo.set('clave')">Usuario y contraseña</button>
            <button role="tab" [class.activo]="modo() === 'pin'" (click)="modo.set('pin')">PIN rápido</button>
          </div>
        </div>
        @if (modo() === 'clave') {
          <form (ngSubmit)="entrar()">
            <label class="campo"><span>Usuario</span>
              <input class="input" name="usuario" [(ngModel)]="usuario" autocomplete="username" autofocus />
            </label>
            <label class="campo"><span>Contraseña</span>
              <span class="clave">
                <input class="input" name="contrasena" [(ngModel)]="contrasena" [type]="ver() ? 'text' : 'password'" autocomplete="current-password" />
                <button type="button" class="btn icono chico fantasma" (click)="ver.set(!ver())" [attr.aria-label]="ver() ? 'Ocultar contraseña' : 'Ver contraseña'">
                  <lucide-icon [img]="ver() ? iOcultar : iVer" [size]="18" />
                </button>
              </span>
            </label>
            @if (error()) { <p class="aviso-linea atencion">{{ error() }}</p> }
            <button class="btn primario grande" type="submit"><lucide-icon [img]="iCandado" [size]="18" />Entrar</button>
          </form>
        } @else {
          <form (ngSubmit)="entrarPin()">
            <span class="campo"><span>¿Quién sos?</span></span>
            <div class="personas">
              @for (u of activos(); track u.id) {
                <button type="button" class="persona" [class.activo]="elegida()?.id === u.id" (click)="elegida.set(u); pin = ''">
                  <span class="av">{{ iniciales(u.nombre) }}</span>{{ u.nombre }}
                </button>
              }
            </div>
            @if (elegida()) {
              <label class="campo"><span>PIN de {{ elegida()!.nombre }}</span>
                <input class="input pin" name="pin" [(ngModel)]="pin" inputmode="numeric" maxlength="4" type="password" autocomplete="off" />
              </label>
            }
            @if (error()) { <p class="aviso-linea atencion">{{ error() }}</p> }
            <button class="btn primario grande" type="submit" [disabled]="!elegida() || pin.length < 4">Entrar</button>
          </form>
        }
      </div>

      <div class="aviso-linea info demo">
        <span class="fila"><lucide-icon [img]="iInfo" [size]="18" /><b>Demo:</b> probá con estas cuentas de ejemplo.</span>
        <span>Dueña: <b>claudia</b> / <b>cafe1234</b> (PIN 1111) · Empleada: <b>lucia</b> / <b>lucia123</b> (PIN 2222)</span>
        <span class="fila">
          <button class="btn chico" (click)="rapido('claudia', 'cafe1234')">Entrar como dueña</button>
          <button class="btn chico" (click)="rapido('lucia', 'lucia123')">Entrar como empleada</button>
        </span>
      </div>
    </div>
  `,
})
export class Ingresar {
  protected readonly tienda = inject(Tienda);
  private readonly router = inject(Router);
  protected readonly modo = signal<'clave' | 'pin'>('clave');
  protected readonly ver = signal(false);
  protected readonly error = signal('');
  protected readonly elegida = signal<Usuario | null>(null);
  protected readonly activos = computed(() => this.tienda.estado().usuarios.filter((u) => u.activo));
  protected usuario = '';
  protected contrasena = '';
  protected pin = '';
  protected readonly iniciales = iniciales;
  protected readonly iCafe = Coffee;
  protected readonly iVer = Eye;
  protected readonly iOcultar = EyeOff;
  protected readonly iCandado = Lock;
  protected readonly iInfo = Info;

  entrar() {
    const u = this.tienda.ingresar(this.usuario, this.contrasena);
    if (!u) {
      this.error.set('El usuario o la contraseña no coinciden. Revisalos y probá de nuevo.');
      return;
    }
    this.router.navigateByUrl(u.rol === 'duena' ? '/inicio' : '/mesas');
  }

  entrarPin() {
    const u = this.tienda.ingresarConPin(this.elegida()!.id, this.pin);
    if (!u) {
      this.error.set('Ese PIN no es correcto.');
      this.pin = '';
      return;
    }
    this.router.navigateByUrl(u.rol === 'duena' ? '/inicio' : '/mesas');
  }

  rapido(usuario: string, contrasena: string) {
    this.usuario = usuario;
    this.contrasena = contrasena;
    this.entrar();
  }
}

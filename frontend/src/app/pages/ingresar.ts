import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { iniciales } from '../core/formato';
import { Delete, Eye, EyeOff, Lock } from '../core/iconos';
import { Usuario } from '../core/modelos';
import { Tienda } from '../core/tienda';

@Component({
  selector: 'app-ingresar',
  imports: [FormsModule, LucideAngularModule],
  styles: `
    :host { display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 6fr); min-height: 100vh; background: var(--surface); }

    /* Panel de marca: el acento como campo entero, con el nombre como pieza central. */
    .marca { position: relative; overflow: hidden; background: var(--accent); color: var(--accent-ink); padding: 40px 48px; display: flex; flex-direction: column; justify-content: space-between; }
    .marca .nombre { font-size: clamp(56px, 8vw, 104px); font-weight: 800; letter-spacing: -0.04em; line-height: 0.95; }
    .marca .frase { margin-top: 18px; font-size: var(--fs-lg); font-weight: 500; max-width: 26ch; text-wrap: balance; opacity: 0.85; }
    .marca .pie { display: flex; gap: 16px; font-size: var(--fs-sm); font-weight: 600; opacity: 0.75; }
    .taza { position: absolute; right: -8%; bottom: -10%; width: 62%; max-width: 520px; opacity: 0.22; pointer-events: none; }
    .reloj { font-size: var(--fs-sm); font-weight: 600; opacity: 0.75; }

    .acceso { display: grid; place-items: center; padding: 40px 24px; }
    .caja { width: min(420px, 100%); display: flex; flex-direction: column; gap: 18px; }
    .caja h1 { font-size: 28px; }
    .caja .sub { color: var(--text-2); margin-top: 4px; }
    form { display: flex; flex-direction: column; gap: 14px; }
    .clave { position: relative; .input { padding-right: 44px; } button { position: absolute; right: 4px; top: 4px; } }

    .personas { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 8px; }
    .persona { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 12px 6px; border: 1px solid var(--border-strong); border-radius: var(--r); background: var(--surface); cursor: pointer; font-weight: 600; font-size: var(--fs-sm);
      &:hover { background: var(--surface-2); } &.activo { border-color: var(--accent-text); background: var(--accent-soft); color: var(--accent-text); } }
    .av { width: 40px; height: 40px; border-radius: 50%; background: var(--surface-3); display: grid; place-items: center; font-weight: 700; color: var(--text-2); }
    .activo .av { background: var(--accent); color: var(--accent-ink); }

    .puntos { display: flex; justify-content: center; gap: 14px; padding: 6px 0; }
    .punto { width: 14px; height: 14px; border-radius: 50%; border: 2px solid var(--border-strong); transition: background 0.15s, border-color 0.15s; &.lleno { background: var(--accent-text); border-color: var(--accent-text); } }
    .teclado { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; max-width: 300px; margin: 0 auto; width: 100%; }
    .tecla { min-height: 56px; font-size: 22px; font-weight: 600; border: 1px solid var(--border-strong); border-radius: var(--r); background: var(--surface); cursor: pointer; display: grid; place-items: center;
      &:hover { background: var(--surface-2); } &:active { transform: translateY(1px); } &:disabled { opacity: 0.4; cursor: not-allowed; } }

    .demo { border: 1px dashed var(--border-strong); border-radius: var(--r-lg); padding: 14px; display: flex; flex-direction: column; gap: 8px; font-size: var(--fs-sm); color: var(--text-2);
      .fila .btn { flex: 1; } }

    @media (max-width: 900px) {
      :host { grid-template-columns: 1fr; grid-template-rows: auto 1fr; }
      .marca { padding: 28px 24px; min-height: 200px; }
      .marca .nombre { font-size: 48px; }
      .marca .frase { display: none; }
      .marca .pie { display: none; }
      .taza { width: 45%; right: -6%; bottom: -30%; }
      .acceso { padding: 24px 16px 40px; align-items: start; }
    }
  `,
  template: `
    <section class="marca" aria-label="Panacota">
      <div class="reloj">{{ fechaHoy }}</div>
      <div>
        <div class="nombre">{{ nombre() }}</div>
        <p class="frase">Panel de gestión: mesas, caja, productos y números del día.</p>
      </div>
      <div class="pie"><span>Café</span><span>·</span><span>Tortas</span><span>·</span><span>Facturas</span></div>
      <svg class="taza" viewBox="0 0 200 160" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">
        <path d="M30 60h100v40a40 40 0 0 1-40 40H70a40 40 0 0 1-40-40z" />
        <path d="M130 70h14a20 20 0 0 1 0 40h-14" />
        <path d="M60 20v14M82 12v22M104 20v14" />
        <path d="M18 150h150" />
      </svg>
    </section>

    <section class="acceso">
      <div class="caja">
        <div><h1>Hola, ¿quién entra?</h1><p class="sub">Elegí cómo entrar.</p></div>
        <div class="segmentos grandes" role="tablist">
          <button role="tab" [class.activo]="modo() === 'pin'" (click)="modo.set('pin'); error.set('')">Con PIN</button>
          <button role="tab" [class.activo]="modo() === 'clave'" (click)="modo.set('clave'); error.set('')">Usuario y contraseña</button>
        </div>

        @if (modo() === 'clave') {
          <form (ngSubmit)="entrar()">
            <label class="campo"><span>Usuario</span><input class="input" name="usuario" [(ngModel)]="usuario" autocomplete="username" /></label>
            <label class="campo"><span>Contraseña</span>
              <span class="clave">
                <input class="input" name="contrasena" [(ngModel)]="contrasena" [type]="ver() ? 'text' : 'password'" autocomplete="current-password" />
                <button type="button" class="btn icono chico fantasma" (click)="ver.set(!ver())" [attr.aria-label]="ver() ? 'Ocultar contraseña' : 'Ver contraseña'"><lucide-icon [img]="ver() ? iOcultar : iVer" [size]="18" /></button>
              </span>
            </label>
            @if (error()) { <p class="aviso-linea atencion" role="alert">{{ error() }}</p> }
            <button class="btn primario grande" type="submit"><lucide-icon [img]="iCandado" [size]="18" />Entrar</button>
          </form>
        } @else {
          <div class="personas" role="radiogroup" aria-label="¿Quién sos?">
            @for (u of activos(); track u.id) {
              <button type="button" class="persona" role="radio" [attr.aria-checked]="elegida()?.id === u.id" [class.activo]="elegida()?.id === u.id" (click)="elegir(u)">
                <span class="av">{{ iniciales(u.nombre) }}</span>{{ u.nombre }}
              </button>
            }
          </div>
          <div class="puntos" aria-live="polite" [attr.aria-label]="elegida() ? 'PIN de ' + elegida()!.nombre + ': ' + pin().length + ' de 4' : 'Elegí tu nombre'">
            @for (i of [0, 1, 2, 3]; track i) { <span class="punto" [class.lleno]="pin().length > i"></span> }
          </div>
          <div class="teclado">
            @for (n of ['1', '2', '3', '4', '5', '6', '7', '8', '9']; track n) {
              <button type="button" class="tecla" [disabled]="!elegida()" (click)="tecla(n)">{{ n }}</button>
            }
            <button type="button" class="tecla" [disabled]="!pin().length" (click)="borrar()" aria-label="Borrar"><lucide-icon [img]="iBorrar" [size]="22" /></button>
            <button type="button" class="tecla" [disabled]="!elegida()" (click)="tecla('0')">0</button>
            <span></span>
          </div>
          @if (error()) { <p class="aviso-linea atencion" role="alert">{{ error() }}</p> }
          @else if (!elegida()) { <p class="ter" style="text-align:center">Tocá tu nombre y marcá tu PIN de 4 números.</p> }
        }

        <div class="demo">
          <span><b>Demo:</b> dueña <b>claudia</b> / <b>cafe1234</b> (PIN 1111) · empleada <b>lucia</b> / <b>lucia123</b> (PIN 2222)</span>
          <span class="fila">
            <button class="btn chico" (click)="rapido('claudia', 'cafe1234')">Entrar como dueña</button>
            <button class="btn chico" (click)="rapido('lucia', 'lucia123')">Entrar como empleada</button>
          </span>
        </div>
      </div>
    </section>
  `,
})
export class Ingresar {
  protected readonly tienda = inject(Tienda);
  private readonly router = inject(Router);
  protected readonly modo = signal<'clave' | 'pin'>('pin');
  protected readonly ver = signal(false);
  protected readonly error = signal('');
  protected readonly elegida = signal<Usuario | null>(null);
  protected readonly pin = signal('');
  protected readonly activos = computed(() => this.tienda.estado().usuarios.filter((u) => u.activo));
  protected readonly nombre = computed(() => this.tienda.estado().ajustes.nombreLocal);
  protected readonly fechaHoy = capitalizar(new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }));
  protected usuario = '';
  protected contrasena = '';
  protected readonly iniciales = iniciales;
  protected readonly iVer = Eye;
  protected readonly iOcultar = EyeOff;
  protected readonly iCandado = Lock;
  protected readonly iBorrar = Delete;

  elegir(u: Usuario) {
    this.elegida.set(u);
    this.pin.set('');
    this.error.set('');
  }

  tecla(n: string) {
    if (this.pin().length >= 4) return;
    this.pin.set(this.pin() + n);
    this.error.set('');
    if (this.pin().length === 4) this.entrarPin();
  }

  borrar() {
    this.pin.set(this.pin().slice(0, -1));
    this.error.set('');
  }

  entrar() {
    const u = this.tienda.ingresar(this.usuario, this.contrasena);
    if (!u) {
      this.error.set('El usuario o la contraseña no coinciden. Revisalos y probá de nuevo.');
      return;
    }
    this.router.navigateByUrl(u.rol === 'duena' ? '/inicio' : '/mesas');
  }

  private entrarPin() {
    const u = this.tienda.ingresarConPin(this.elegida()!.id, this.pin());
    if (!u) {
      this.error.set('Ese PIN no es el de ' + this.elegida()!.nombre + '. Probá de nuevo.');
      this.pin.set('');
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

function capitalizar(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { CircleCheck, Eye, EyeOff, Lock, Mail } from '../core/iconos';
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
    .caja { width: min(400px, 100%); display: flex; flex-direction: column; gap: 18px; }
    .caja h1 { font-size: 28px; }
    .caja .sub { color: var(--text-2); margin-top: 4px; }
    form { display: flex; flex-direction: column; gap: 14px; }
    .clave { position: relative; .input { padding-right: 44px; } button { position: absolute; right: 4px; top: 4px; } }
    .enlace { align-self: flex-start; background: none; border: 0; padding: 0; color: var(--accent-text); font-weight: 600; cursor: pointer; text-decoration: underline; text-underline-offset: 3px; }
    .ok-grande { color: var(--ok); }
    .demo { border: 1px dashed var(--border-strong); border-radius: var(--r-lg); padding: 14px; display: flex; flex-direction: column; gap: 8px; font-size: var(--fs-sm); color: var(--text-2);
      .fila .btn { flex: 1; } }

    @media (max-width: 900px) {
      :host { grid-template-columns: 1fr; grid-template-rows: auto 1fr; }
      .marca { padding: 28px 24px; min-height: 200px; }
      .marca .nombre { font-size: 48px; }
      .marca .frase, .marca .pie { display: none; }
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
        @if (tienda.recuperando()) {
          <div><h1>Elegí una contraseña nueva</h1><p class="sub">Entraste con el link del email. Escribí tu contraseña nueva dos veces.</p></div>
          <form (ngSubmit)="guardarNueva()">
            <label class="campo"><span>Contraseña nueva</span><input class="input" name="n1" [(ngModel)]="nueva1" type="password" autocomplete="new-password" /><small>Al menos 8 caracteres.</small></label>
            <label class="campo"><span>Repetila</span><input class="input" name="n2" [(ngModel)]="nueva2" type="password" autocomplete="new-password" /></label>
            @if (error()) { <p class="aviso-linea atencion" role="alert">{{ error() }}</p> }
            <button class="btn primario grande" type="submit" [disabled]="enviando()">Guardar y entrar</button>
          </form>
        } @else {
        @switch (vista()) {
          @case ('entrar') {
            <div><h1>Hola, ¿quién entra?</h1><p class="sub">Entrá con tu usuario y tu contraseña.</p></div>
            <form (ngSubmit)="entrar()">
              <label class="campo"><span>Usuario</span><input class="input" name="usuario" [(ngModel)]="usuario" autocomplete="username" autofocus /></label>
              <label class="campo"><span>Contraseña</span>
                <span class="clave">
                  <input class="input" name="contrasena" [(ngModel)]="contrasena" [type]="ver() ? 'text' : 'password'" autocomplete="current-password" />
                  <button type="button" class="btn icono chico fantasma" (click)="ver.set(!ver())" [attr.aria-label]="ver() ? 'Ocultar contraseña' : 'Ver contraseña'"><lucide-icon [img]="ver() ? iOcultar : iVer" [size]="18" /></button>
                </span>
              </label>
              @if (error()) { <p class="aviso-linea atencion" role="alert">{{ error() }}</p> }
              <button class="btn primario grande" type="submit" [disabled]="enviando()"><lucide-icon [img]="iCandado" [size]="18" />{{ enviando() ? 'Entrando…' : 'Entrar' }}</button>
              <button type="button" class="enlace" (click)="vista.set('recuperar'); error.set('')">¿Te olvidaste la contraseña?</button>
            </form>
          }
          @case ('recuperar') {
            <div><h1>Recuperar la contraseña</h1><p class="sub">Escribí tu usuario o tu email y te mandamos un link para elegir una contraseña nueva.</p></div>
            <form (ngSubmit)="recuperar()">
              <label class="campo"><span>Usuario o email</span><input class="input" name="quien" [(ngModel)]="quien" autocomplete="username" autofocus /></label>
              @if (error()) { <p class="aviso-linea atencion" role="alert">{{ error() }}</p> }
              <button class="btn primario grande" type="submit" [disabled]="enviando()"><lucide-icon [img]="iMail" [size]="18" />Mandar el link</button>
              <button type="button" class="enlace" (click)="vista.set('entrar'); error.set('')">Volver</button>
            </form>
          }
          @case ('enviado') {
            <div style="text-align:center;display:flex;flex-direction:column;align-items:center;gap:10px">
              <lucide-icon [img]="iOk" [size]="44" class="ok-grande" />
              <h1>Revisá tu email</h1>
              <p class="sub">Si <b>{{ quien }}</b> está registrado, en unos minutos te llega un email a <b>{{ emailOculto() }}</b> con un link para elegir una contraseña nueva. El link vence en una hora.</p>
              @if (!tienda.real) { <p class="aviso-linea info" style="text-align:left">En esta demo no se manda ningún email. En el sistema real lo manda el servicio de usuarios.</p> }
              <p class="ter">Abrí el link desde esta misma computadora o celular. Si no te llega, la dueña puede cambiarte la contraseña desde «Empleadas».</p>
              <button class="btn" (click)="vista.set('entrar')">Volver a entrar</button>
            </div>
          }
        }
        }

        @if (!tienda.real) {
        <div class="demo">
          <span><b>Demo:</b> dueña <b>claudia</b> / <b>cafe1234</b> · empleada <b>lucia</b> / <b>lucia123</b></span>
          <span class="fila">
            <button class="btn chico" (click)="rapido('claudia', 'cafe1234')">Entrar como dueña</button>
            <button class="btn chico" (click)="rapido('lucia', 'lucia123')">Entrar como empleada</button>
          </span>
        </div>
        }
      </div>
    </section>
  `,
})
export class Ingresar {
  protected readonly tienda = inject(Tienda);
  private readonly router = inject(Router);
  protected readonly vista = signal<'entrar' | 'recuperar' | 'enviado'>('entrar');
  protected readonly ver = signal(false);
  protected readonly error = signal('');
  protected readonly emailOculto = signal('');
  protected readonly enviando = signal(false);
  protected nueva1 = '';
  protected nueva2 = '';
  protected readonly nombre = computed(() => this.tienda.estado().ajustes.nombreLocal);
  protected readonly fechaHoy = capitalizar(new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }));
  protected usuario = '';
  protected contrasena = '';
  protected quien = '';
  protected readonly iVer = Eye;
  protected readonly iOcultar = EyeOff;
  protected readonly iCandado = Lock;
  protected readonly iMail = Mail;
  protected readonly iOk = CircleCheck;

  async entrar() {
    if (this.enviando()) return;
    this.enviando.set(true);
    this.error.set('');
    const r = await this.tienda.ingresar(this.usuario, this.contrasena);
    this.enviando.set(false);
    if (typeof r === 'string') {
      this.error.set(r);
      return;
    }
    this.contrasena = '';
    this.router.navigateByUrl(r.rol === 'duena' ? '/inicio' : '/mesas');
  }

  async recuperar() {
    if (!this.quien.trim()) {
      this.error.set('Escribí tu usuario o tu email.');
      return;
    }
    this.enviando.set(true);
    // Se muestra lo mismo exista o no el usuario, para no revelar quiénes tienen cuenta.
    const email = await this.tienda.pedirRecuperacion(this.quien).catch(() => null);
    this.enviando.set(false);
    this.emailOculto.set(email ? ocultarEmail(email) : 'tu email');
    this.vista.set('enviado');
  }

  async guardarNueva() {
    if (this.nueva1.length < 8) return this.error.set('La contraseña necesita al menos 8 caracteres.');
    if (this.nueva1 !== this.nueva2) return this.error.set('Las dos contraseñas no coinciden.');
    this.enviando.set(true);
    const error = await this.tienda.nuevaContrasena(this.nueva1);
    this.enviando.set(false);
    if (error) return this.error.set(error);
    const u = this.tienda.usuario();
    this.router.navigateByUrl(u?.rol === 'duena' ? '/inicio' : '/mesas');
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

/** cla•••@ejemplo.com */
function ocultarEmail(e: string) {
  const [u, d] = e.split('@');
  return `${u.slice(0, 3)}•••@${d}`;
}

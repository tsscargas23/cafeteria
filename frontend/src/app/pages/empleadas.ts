import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { Avisos } from '../core/avisos';
import { fecha, iniciales } from '../core/formato';
import { Eye, EyeOff, Pencil, Phone, Plus, ShieldCheck, X } from '../core/iconos';
import { Usuario } from '../core/modelos';
import { nuevoId, Tienda } from '../core/tienda';

@Component({
  selector: 'app-empleadas',
  imports: [FormsModule, LucideAngularModule],
  styles: `
    .lista { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }
    .persona { display: flex; flex-direction: column; gap: 12px; padding: 16px; cursor: pointer; &:hover { border-color: var(--border-strong); box-shadow: var(--shadow-2); } }
    .persona.inactiva { opacity: 0.6; }
    .cab { display: flex; align-items: center; gap: 12px; }
    .av { width: 44px; height: 44px; border-radius: 50%; background: var(--accent-soft); color: var(--accent-text); display: grid; place-items: center; font-weight: 750; flex: none; }
    .datos { display: flex; flex-direction: column; flex: 1; min-width: 0; small { color: var(--text-3); } }
    .permisos { display: flex; flex-wrap: wrap; gap: 4px; }
    .clave { position: relative; .input { padding-right: 44px; } button { position: absolute; right: 4px; top: 4px; } }
    .lista-permisos { display: flex; flex-direction: column; gap: 10px; }
  `,
  template: `
    <div class="pagina">
      <div class="pagina-cab">
        <div class="titulo"><h1>Empleadas</h1><p>Cada una entra con su usuario y contraseña. Cada venta queda a su nombre.</p></div>
        <div class="acciones"><button class="btn primario" (click)="nueva()"><lucide-icon [img]="iMas" [size]="18" />Nueva empleada</button></div>
      </div>
      <div class="lista">
        @for (u of usuarios(); track u.id) {
          <article class="panel persona" [class.inactiva]="!u.activo" (click)="editar(u)" tabindex="0" (keydown.enter)="editar(u)">
            <div class="cab">
              <span class="av">{{ iniciales(u.nombre) }}</span>
              <span class="datos"><b>{{ u.nombre }}</b><small>Usuario: {{ u.usuario }}</small></span>
              @if (u.rol === 'duena') { <span class="etiqueta acento"><lucide-icon [img]="iEscudo" [size]="12" />Dueña</span> }
              @else if (!u.activo) { <span class="etiqueta">Desactivada</span> }
              @else { <span class="etiqueta ok">Activa</span> }
            </div>
            <div class="ter fila" style="gap:6px"><lucide-icon [img]="iTel" [size]="14" />{{ u.telefono || 'Sin teléfono' }} · {{ u.email || 'Sin email' }}</div>
            <div class="ter">Último turno: {{ ultimoTurno(u.id) }}</div>
            <div class="permisos">
              @if (u.permisos.cobrar) { <span class="etiqueta">Cobra</span> }
              @if (u.permisos.anular) { <span class="etiqueta">Anula ventas</span> }
              @if (u.permisos.verReportes) { <span class="etiqueta">Ve reportes</span> }
              @if (u.permisos.editarProductos) { <span class="etiqueta">Edita productos</span> }
            </div>
          </article>
        }
      </div>
    </div>

    @if (abierto()) {
      <div class="lateral-fondo" (click)="abierto.set(false)"></div>
      <aside class="lateral" role="dialog" aria-label="Empleada">
        <div class="lateral-cab"><h2>{{ esNueva ? 'Nueva empleada' : form.nombre }}</h2><button class="btn icono fantasma" (click)="abierto.set(false)" aria-label="Cerrar"><lucide-icon [img]="iX" [size]="20" /></button></div>
        <div class="lateral-cuerpo">
          <h3>Perfil</h3>
          <div class="grilla-2">
            <label class="campo"><span>Nombre</span><input class="input" [(ngModel)]="form.nombre" (ngModelChange)="sugerirUsuario()" /></label>
            <label class="campo"><span>Teléfono</span><input class="input" [(ngModel)]="form.telefono" inputmode="tel" /></label>
          </div>
          <div class="separador"></div>
          <h3>Acceso</h3>
          <div class="grilla-2">
            <label class="campo"><span>Usuario</span><input class="input" [(ngModel)]="form.usuario" autocomplete="off" [class.invalido]="!usuarioOk()" />
              @if (!usuarioOk()) { <span class="error">Ese usuario ya existe.</span> }</label>
            <label class="campo"><span>Contraseña</span>
              <span class="clave"><input class="input" [(ngModel)]="form.contrasena" [type]="ver() ? 'text' : 'password'" autocomplete="new-password" />
                <button type="button" class="btn icono chico fantasma" (click)="ver.set(!ver())" [attr.aria-label]="ver() ? 'Ocultar' : 'Ver'"><lucide-icon [img]="ver() ? iOcultar : iVer" [size]="18" /></button></span>
              <small>Al menos 6 caracteres.</small></label>
          </div>
          <label class="campo"><span>Email (para recuperar la contraseña)</span><input class="input" type="email" [(ngModel)]="form.email" autocomplete="off" /></label>
          @if (form.rol === 'empleada') {
            <div class="separador"></div>
            <h3>Qué puede hacer</h3>
            <div class="lista-permisos">
              <label class="interruptor"><input type="checkbox" [(ngModel)]="form.permisos.cobrar" />Cobrar mesas y ventas</label>
              <label class="interruptor"><input type="checkbox" [(ngModel)]="form.permisos.anular" />Anular ventas (siempre con motivo)</label>
              <label class="interruptor"><input type="checkbox" [(ngModel)]="form.permisos.verReportes" />Ver reportes</label>
              <label class="interruptor"><input type="checkbox" [(ngModel)]="form.permisos.editarProductos" />Editar productos y precios</label>
            </div>
            <p class="ter">En la demo, los reportes, productos y ajustes solo los ve la dueña.</p>
            @if (!esNueva) {
              <div class="separador"></div>
              <label class="interruptor"><input type="checkbox" [(ngModel)]="form.activo" />Cuenta activa</label>
              <p class="ter">Si alguien deja de trabajar, desactivá su cuenta: no puede entrar más, pero sus ventas quedan en los reportes.</p>
            }
          }
          @if (error()) { <p class="aviso-linea atencion">{{ error() }}</p> }
        </div>
        <div class="lateral-pie">
          <button class="btn" (click)="abierto.set(false)">Cancelar</button>
          <button class="btn primario" (click)="guardar()">Guardar</button>
        </div>
      </aside>
    }
  `,
})
export class Empleadas {
  protected readonly tienda = inject(Tienda);
  private readonly avisos = inject(Avisos);
  protected readonly abierto = signal(false);
  protected readonly ver = signal(false);
  protected readonly error = signal('');
  protected form: Usuario = this.vacia();
  protected esNueva = false;
  protected readonly usuarios = computed(() => [...this.tienda.estado().usuarios].sort((a, b) => Number(b.rol === 'duena') - Number(a.rol === 'duena') || Number(b.activo) - Number(a.activo)));
  protected readonly iniciales = iniciales;
  protected readonly iMas = Plus;
  protected readonly iX = X;
  protected readonly iVer = Eye;
  protected readonly iOcultar = EyeOff;
  protected readonly iEscudo = ShieldCheck;
  protected readonly iTel = Phone;
  protected readonly iEditar = Pencil;

  private vacia(): Usuario {
    return { id: nuevoId('u'), nombre: '', usuario: '', contrasena: '', email: '', rol: 'empleada', telefono: '', activo: true, permisos: { cobrar: true, anular: false, verReportes: false, editarProductos: false } };
  }

  ultimoTurno(id: string) {
    const t = this.tienda.estado().turnos.filter((x) => x.empleadaIds.includes(id)).sort((a, b) => b.abiertoEn - a.abiertoEn)[0];
    return t ? fecha(t.abiertoEn) : '—';
  }

  usuarioOk() {
    return !this.form.usuario.trim() || this.tienda.usuarioLibre(this.form.usuario, this.form.id);
  }

  nueva() {
    this.form = this.vacia();
    this.esNueva = true;
    this.error.set('');
    this.abierto.set(true);
  }

  editar(u: Usuario) {
    this.form = structuredClone(u);
    this.esNueva = false;
    this.error.set('');
    this.abierto.set(true);
  }

  sugerirUsuario() {
    if (this.esNueva) this.form.usuario = this.form.nombre.trim().split(/\s+/)[0]?.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') ?? '';
  }

  guardar() {
    const f = this.form;
    if (!f.nombre.trim()) return this.error.set('Falta el nombre.');
    if (!f.usuario.trim() || !this.usuarioOk()) return this.error.set('Elegí un usuario que no esté repetido.');
    if (f.contrasena.length < 6) return this.error.set('La contraseña necesita al menos 6 caracteres.');
    if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) return this.error.set('Ese email no parece válido.');
    this.tienda.guardarUsuario({ ...f, nombre: f.nombre.trim(), usuario: f.usuario.trim().toLowerCase() });
    this.avisos.mostrar(this.esNueva ? `Cuenta de ${f.nombre} creada` : `${f.nombre} guardada`);
    this.abierto.set(false);
  }
}

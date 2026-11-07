import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { LucideAngularModule, LucideIconData } from 'lucide-angular';
import { duracion, hora, iniciales } from '../core/formato';
import {
  Boxes, ChartColumn, Clock, Coffee, House, LayoutGrid, LogOut, PanelLeftClose, PanelLeftOpen, QrCode, Settings,
  Menu, Store, Truck, Users,
} from '../core/iconos';
import { Tienda } from '../core/tienda';

interface Seccion {
  ruta: string;
  nombre: string;
  icono: LucideIconData;
  soloDuena: boolean;
}

const SECCIONES: Seccion[] = [
  { ruta: '/inicio', nombre: 'Inicio', icono: House, soloDuena: true },
  { ruta: '/mesas', nombre: 'Mesas', icono: LayoutGrid, soloDuena: false },
  { ruta: '/mostrador', nombre: 'Mostrador', icono: Store, soloDuena: false },
  { ruta: '/caja', nombre: 'Turnos y caja', icono: Clock, soloDuena: false },
  { ruta: '/productos', nombre: 'Productos', icono: Coffee, soloDuena: true },
  { ruta: '/inventario', nombre: 'Inventario', icono: Boxes, soloDuena: true },
  { ruta: '/proveedores', nombre: 'Proveedores', icono: Truck, soloDuena: true },
  { ruta: '/reportes', nombre: 'Reportes', icono: ChartColumn, soloDuena: true },
  { ruta: '/empleadas', nombre: 'Empleadas', icono: Users, soloDuena: true },
  { ruta: '/carta-qr', nombre: 'Carta QR', icono: QrCode, soloDuena: true },
  { ruta: '/ajustes', nombre: 'Ajustes', icono: Settings, soloDuena: true },
];

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, LucideAngularModule],
  styleUrl: './shell.scss',
  template: `
    <div class="app" [class.angosta]="angosta()" [class.menu-abierto]="menuMovil()">
      <nav class="lateral-nav" aria-label="Secciones">
        <div class="marca">
          <span class="logo"><lucide-icon [img]="iCafe" [size]="20" /></span>
          <span class="nombre-local">
            <b>{{ tienda.estado().ajustes.nombreLocal }}</b>
            <small>Demo · datos de ejemplo</small>
          </span>
        </div>
        <ul>
          @for (s of secciones(); track s.ruta) {
            <li>
              <a [routerLink]="s.ruta" routerLinkActive="activo" (click)="menuMovil.set(false)" [attr.title]="angosta() ? s.nombre : null">
                <lucide-icon [img]="s.icono" [size]="19" />
                <span>{{ s.nombre }}</span>
              </a>
            </li>
          }
        </ul>
        <button class="plegar" (click)="angosta.set(!angosta())" [attr.aria-label]="angosta() ? 'Mostrar nombres' : 'Achicar menú'">
          <lucide-icon [img]="angosta() ? iAbrir : iCerrar" [size]="18" />
          <span>Achicar menú</span>
        </button>
      </nav>
      <div class="fondo-movil" (click)="menuMovil.set(false)"></div>

      <div class="principal">
        <header class="barra-sup">
          <button class="btn icono fantasma solo-movil" (click)="menuMovil.set(true)" aria-label="Abrir menú"><lucide-icon [img]="iMenu" [size]="20" /></button>
          @if (tienda.turnoAbierto(); as t) {
            <a class="turno" routerLink="/caja" [class.pasado]="turnoPasado()">
              <span class="punto"></span>
              <span><b>Turno {{ nombreTurno() }}</b><span class="det"> · abierto {{ hora(t.abiertoEn) }} ({{ duracion(t.abiertoEn) }})</span></span>
              @if (turnoPasado()) { <span class="etiqueta atencion">Pasó su horario</span> }
            </a>
          } @else {
            <a class="turno cerrado" routerLink="/caja"><span class="punto"></span><span><b>Caja cerrada</b><span class="det"> · Abrí un turno para vender</span></span></a>
          }
          <div class="usuario">
            <span class="avatar">{{ iniciales(tienda.usuario()?.nombre ?? '') }}</span>
            <span class="quien"><b>{{ tienda.usuario()?.nombre }}</b><small>{{ tienda.esDuena() ? 'Dueña' : 'Empleada' }}</small></span>
            <button class="btn chico" (click)="salir()"><lucide-icon [img]="iSalir" [size]="16" />Cambiar de usuaria</button>
          </div>
        </header>
        <main class="contenido">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
})
export class Shell {
  protected readonly tienda = inject(Tienda);
  private readonly router = inject(Router);
  protected readonly angosta = signal(typeof window !== 'undefined' && window.innerWidth < 1280);
  protected readonly menuMovil = signal(false);
  protected readonly secciones = computed(() => SECCIONES.filter((s) => !s.soloDuena || this.tienda.esDuena()));
  protected readonly nombreTurno = computed(() => {
    const t = this.tienda.turnoAbierto();
    return this.tienda.estado().turnoDefs.find((d) => d.id === t?.defId)?.nombre.toLowerCase() ?? '';
  });
  protected readonly turnoPasado = computed(() => {
    const t = this.tienda.turnoAbierto();
    const def = this.tienda.estado().turnoDefs.find((d) => d.id === t?.defId);
    if (!t || !def) return false;
    const [h, m] = def.hasta.split(':').map(Number);
    const limite = new Date(t.abiertoEn);
    limite.setHours(h, m, 0, 0);
    return Date.now() > limite.getTime();
  });

  protected readonly hora = hora;
  protected readonly duracion = duracion;
  protected readonly iniciales = iniciales;
  protected readonly iCafe = Coffee;
  protected readonly iSalir = LogOut;
  protected readonly iAbrir = PanelLeftOpen;
  protected readonly iCerrar = PanelLeftClose;
  protected readonly iMenu = Menu;

  salir() {
    this.tienda.salir();
    this.router.navigateByUrl('/ingresar');
  }
}

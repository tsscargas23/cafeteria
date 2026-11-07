import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { Tienda } from './core/tienda';

const conSesion: CanActivateFn = () => {
  const t = inject(Tienda);
  return t.usuario() ? true : inject(Router).parseUrl('/ingresar');
};

const soloDuena: CanActivateFn = () => {
  const t = inject(Tienda);
  return t.esDuena() ? true : inject(Router).parseUrl('/mesas');
};

const inicioSegunRol: CanActivateFn = () => {
  const t = inject(Tienda);
  return inject(Router).parseUrl(t.esDuena() ? '/inicio' : '/mesas');
};

export const routes: Routes = [
  { path: 'ingresar', loadComponent: () => import('./pages/ingresar').then((m) => m.Ingresar), title: 'Ingresar' },
  { path: 'carta', loadComponent: () => import('./pages/carta-publica').then((m) => m.CartaPublica), title: 'Carta' },
  {
    path: '',
    canActivate: [conSesion],
    loadComponent: () => import('./layout/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', canActivate: [inicioSegunRol], children: [] },
      { path: 'inicio', canActivate: [soloDuena], loadComponent: () => import('./pages/inicio').then((m) => m.Inicio), title: 'Inicio' },
      { path: 'mesas', loadComponent: () => import('./pages/mesas/mesas').then((m) => m.Mesas), title: 'Mesas' },
      { path: 'mostrador', loadComponent: () => import('./pages/mostrador').then((m) => m.Mostrador), title: 'Mostrador' },
      { path: 'caja', loadComponent: () => import('./pages/caja').then((m) => m.Caja), title: 'Turnos y caja' },
      { path: 'productos', canActivate: [soloDuena], loadComponent: () => import('./pages/productos').then((m) => m.Productos), title: 'Productos' },
      { path: 'inventario', canActivate: [soloDuena], loadComponent: () => import('./pages/inventario').then((m) => m.Inventario), title: 'Inventario' },
      { path: 'proveedores', canActivate: [soloDuena], loadComponent: () => import('./pages/proveedores').then((m) => m.Proveedores), title: 'Proveedores' },
      { path: 'reportes', canActivate: [soloDuena], loadComponent: () => import('./pages/reportes').then((m) => m.Reportes), title: 'Reportes' },
      { path: 'empleadas', canActivate: [soloDuena], loadComponent: () => import('./pages/empleadas').then((m) => m.Empleadas), title: 'Empleadas' },
      { path: 'carta-qr', canActivate: [soloDuena], loadComponent: () => import('./pages/carta-qr').then((m) => m.CartaQr), title: 'Carta QR' },
      { path: 'ajustes', canActivate: [soloDuena], loadComponent: () => import('./pages/ajustes').then((m) => m.AjustesPagina), title: 'Ajustes' },
    ],
  },
  { path: '**', redirectTo: '' },
];

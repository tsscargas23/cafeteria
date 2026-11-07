import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding, withHashLocation } from '@angular/router';
import { routes } from './app.routes';

// Rutas con # (/#/mesas): así anda igual en GitHub Pages, en Cloudflare y abriendo el archivo con doble clic.
export const appConfig: ApplicationConfig = {
  providers: [provideBrowserGlobalErrorListeners(), provideZonelessChangeDetection(), provideRouter(routes, withComponentInputBinding(), withHashLocation())],
};

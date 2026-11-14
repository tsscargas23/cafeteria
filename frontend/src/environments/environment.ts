/**
 * Configuración por entorno. Los valores reales no van en el código: scripts/entorno.mjs los toma de las variables
 * SUPABASE_URL y SUPABASE_ANON_KEY al compilar y genera environment.generado.ts (que no se sube al repositorio).
 * Sin esos valores, la app corre en modo demo (datos en el navegador).
 */
import { entornoGenerado } from './environment.generado';

export const environment = {
  supabaseUrl: entornoGenerado.supabaseUrl,
  supabaseAnonKey: entornoGenerado.supabaseAnonKey,
  demo: !entornoGenerado.supabaseUrl || !entornoGenerado.supabaseAnonKey,
};

import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

/**
 * Conexión con Supabase. Solo existe cuando hay credenciales (ver environments/environment.ts); en la demo es null.
 * La clave "anon" es pública por diseño: lo que protege los datos son las políticas RLS de supabase/migrations.
 */
@Injectable({ providedIn: 'root' })
export class Supabase {
  readonly cliente: SupabaseClient | null = environment.demo
    ? null
    : createClient(environment.supabaseUrl, environment.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' } });

  get activo() {
    return this.cliente !== null;
  }
}

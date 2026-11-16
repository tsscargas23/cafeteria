// Edge Function "copia": entrega la copia de seguridad de todos los datos para que el script de Google de Panacota
// (supabase/copia-google/Codigo.gs) la guarde en Google Drive y la mande por email. Así la copia automática anda sin
// dominio propio y queda fuera de Supabase.
// No la llama el navegador: solo quien tenga la clave COPIA_CLAVE (un secreto de la función en Supabase, guardado
// también en las propiedades del script). Se despliega SIN "Verify JWT": el script no tiene sesión.
import { createClient } from 'npm:@supabase/supabase-js@2.119.0';

/**
 * Claves del proyecto que Supabase pone en el entorno de la función. Se prueban las nuevas (sb_secret, en JSON) y,
 * si no están, la "legacy" (service_role), que Supabase deja de aceptar más adelante.
 */
function clave(): string {
  const nuevas = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (nuevas) {
    try {
      const valores = Object.values(JSON.parse(nuevas) as Record<string, string>);
      if (valores[0]) return valores[0];
    } catch { /* formato inesperado: se usa la legacy */ }
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
}

function respuesta(cuerpo: unknown, estado = 200) {
  return new Response(JSON.stringify(cuerpo), { status: estado, headers: { 'Content-Type': 'application/json' } });
}

/** Compara dos textos sin cortar en la primera diferencia (no da pistas por el tiempo de respuesta). */
function iguales(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let distinto = 0;
  for (let i = 0; i < a.length; i++) distinto |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return distinto === 0;
}

// Todo lo necesario para reconstruir el local. No van intentos_ingreso ni precios_anteriores (son temporales) ni las
// contraseñas: las cuentas de Auth quedan en Supabase.
const TABLAS: { tabla: string; orden: string }[] = [
  { tabla: 'ajustes', orden: 'id' },
  { tabla: 'usuarios', orden: 'id' },
  { tabla: 'categorias', orden: 'nombre' },
  { tabla: 'productos', orden: 'id' },
  { tabla: 'variantes', orden: 'id' },
  { tabla: 'insumos', orden: 'id' },
  { tabla: 'movimientos_stock', orden: 'id' },
  { tabla: 'proveedores', orden: 'id' },
  { tabla: 'compras', orden: 'id' },
  { tabla: 'salones', orden: 'id' },
  { tabla: 'mesas', orden: 'id' },
  { tabla: 'cuentas', orden: 'id' },
  { tabla: 'turno_defs', orden: 'id' },
  { tabla: 'turnos', orden: 'id' },
  { tabla: 'ventas', orden: 'numero' },
];
const PAGINA = 1000;

Deno.serve(async (req) => {
  if (req.method !== 'POST') return respuesta({ error: 'Método no permitido' }, 405);

  const esperada = Deno.env.get('COPIA_CLAVE') ?? '';
  const recibida = req.headers.get('x-clave-copia') ?? '';
  // Sin una clave larga configurada, la función no entrega nada.
  if (esperada.length < 32 || !iguales(recibida, esperada)) return respuesta({ error: 'No autorizado' }, 401);

  let accion = '';
  try {
    accion = String((await req.json()).accion ?? '');
  } catch {
    return respuesta({ error: 'Pedido inválido' }, 400);
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, clave(), { auth: { persistSession: false } });
  const { data: ajustes, error: errAjustes } = await admin.from('ajustes').select('nombre_local, copia').eq('id', 1).single();
  if (errAjustes || !ajustes) return respuesta({ error: 'No se pudieron leer los ajustes' }, 500);
  const copia = (ajustes.copia ?? {}) as { cadaDias?: number; email?: string; ultima?: number | null };

  // Cada cuánto y a quién: el script decide si ya toca, mirando la última copia que guardó en Drive.
  if (accion === 'config') {
    return respuesta({ cadaDias: Number(copia.cadaDias) || 7, email: String(copia.email ?? '').trim(), local: ajustes.nombre_local });
  }

  if (accion === 'copia') {
    const tablas: Record<string, unknown[]> = {};
    for (const { tabla, orden } of TABLAS) {
      const filas: unknown[] = [];
      for (let desde = 0; ; desde += PAGINA) {
        const { data, error } = await admin.from(tabla).select('*').order(orden).range(desde, desde + PAGINA - 1);
        if (error) return respuesta({ error: `No se pudo leer ${tabla}: ${error.message}` }, 500);
        filas.push(...data);
        if (data.length < PAGINA) break;
      }
      tablas[tabla] = filas;
    }
    // "Última copia" en Ajustes. Si falla no importa: la copia ya está armada.
    await admin.from('ajustes').update({ copia: { ...copia, ultima: Date.now() } }).eq('id', 1);
    return respuesta({
      copia: { tipo: 'copia-panacota-tablas', version: 1, creada: new Date().toISOString(), local: ajustes.nombre_local, tablas },
    });
  }

  return respuesta({ error: 'Acción desconocida' }, 400);
});

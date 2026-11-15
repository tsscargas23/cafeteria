// Edge Function "ingresar": entra con NOMBRE DE USUARIO y contraseña.
// Busca el email de la cuenta del lado del servidor e inicia la sesión ahí, así el email nunca llega al navegador
// y nadie puede averiguar emails probando nombres de usuario. Devuelve solo la sesión (tokens) o un error genérico.
// Bloquea un usuario 15 minutos después de 5 intentos fallidos.
// Se despliega SIN "Verify JWT": quien la llama todavía no tiene sesión.
import { createClient } from 'npm:@supabase/supabase-js@2';

/**
 * Claves del proyecto que Supabase pone en el entorno de la función. Se prueban las nuevas (sb_publishable / sb_secret,
 * en JSON) y, si no están, las "legacy" (anon / service_role), que Supabase deja de aceptar más adelante.
 */
function clave(tipo: 'publica' | 'secreta'): string {
  const nuevas = Deno.env.get(tipo === 'publica' ? 'SUPABASE_PUBLISHABLE_KEYS' : 'SUPABASE_SECRET_KEYS');
  if (nuevas) {
    try {
      const valores = Object.values(JSON.parse(nuevas) as Record<string, string>);
      if (valores[0]) return valores[0];
    } catch { /* formato inesperado: se usa la legacy */ }
  }
  return Deno.env.get(tipo === 'publica' ? 'SUPABASE_ANON_KEY' : 'SUPABASE_SERVICE_ROLE_KEY')!;
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MAX_FALLIDOS = 5;
const VENTANA_MIN = 15;
const GENERICO = 'El usuario o la contraseña no coinciden. Revisalos y probá de nuevo.';

function respuesta(cuerpo: unknown, estado = 200) {
  return new Response(JSON.stringify(cuerpo), { status: estado, headers: { ...cors, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return respuesta({ error: 'Método no permitido' }, 405);

  let usuario = '';
  let contrasena = '';
  try {
    const cuerpo = await req.json();
    usuario = String(cuerpo.usuario ?? '').trim().toLowerCase();
    contrasena = String(cuerpo.contrasena ?? '');
  } catch {
    return respuesta({ error: GENERICO }, 400);
  }
  if (!usuario || !contrasena || usuario.length > 60 || contrasena.length > 200) return respuesta({ error: GENERICO }, 400);

  const url = Deno.env.get('SUPABASE_URL')!;
  const admin = createClient(url, clave('secreta'), { auth: { persistSession: false } });

  // ¿Demasiados intentos fallidos recientes para este usuario?
  const desde = new Date(Date.now() - VENTANA_MIN * 60_000).toISOString();
  const { count } = await admin.from('intentos_ingreso').select('id', { count: 'exact', head: true })
    .ilike('usuario', usuario).eq('exitoso', false).gte('fecha', desde);
  if ((count ?? 0) >= MAX_FALLIDOS) {
    return respuesta({ error: `Demasiados intentos. Esperá ${VENTANA_MIN} minutos y probá de nuevo, o pedile a la dueña que te cambie la contraseña.` }, 429);
  }

  const { data: fila } = await admin.from('usuarios').select('email').ilike('usuario', usuario).eq('activo', true).maybeSingle();

  let sesion = null;
  if (fila?.email) {
    // Cliente aparte con la clave pública: inicia la sesión como lo haría el navegador.
    const publico = createClient(url, clave('publica'), { auth: { persistSession: false, autoRefreshToken: false } });
    const { data } = await publico.auth.signInWithPassword({ email: fila.email, password: contrasena });
    sesion = data.session;
  }

  await admin.from('intentos_ingreso').insert({ usuario, exitoso: !!sesion });

  // Mismo mensaje si el usuario no existe o si la contraseña está mal.
  if (!sesion) return respuesta({ error: GENERICO }, 401);
  return respuesta({ access_token: sesion.access_token, refresh_token: sesion.refresh_token });
});

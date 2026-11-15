// Edge Function "empleadas": la dueña crea cuentas y cambia contraseñas o emails de sus empleadas.
// Necesita la clave de servicio (la pone Supabase sola en el entorno de la función, nunca llega al navegador).
// Solo la ejecuta una persona con sesión que sea la dueña activa.
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

function respuesta(cuerpo: unknown, estado = 200) {
  return new Response(JSON.stringify(cuerpo), { status: estado, headers: { ...cors, 'Content-Type': 'application/json' } });
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return respuesta({ error: 'Método no permitido' }, 405);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, clave('secreta'), { auth: { persistSession: false } });

  // ¿Quién llama? Tiene que ser la dueña activa.
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: quien, error: errQuien } = await admin.auth.getUser(token);
  if (errQuien || !quien.user) return respuesta({ error: 'Sesión vencida. Volvé a entrar.' }, 401);
  const { data: fila } = await admin.from('usuarios').select('rol, activo').eq('id', quien.user.id).maybeSingle();
  if (!fila || fila.rol !== 'duena' || !fila.activo) return respuesta({ error: 'Solo la dueña puede hacer esto.' }, 403);

  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = await req.json();
  } catch {
    return respuesta({ error: 'Pedido inválido' }, 400);
  }

  const accion = String(cuerpo.accion ?? '');
  const contrasena = String(cuerpo.contrasena ?? '');
  const email = String(cuerpo.email ?? '').trim().toLowerCase();

  if (accion === 'crear') {
    const nombre = String(cuerpo.nombre ?? '').trim();
    const usuario = String(cuerpo.usuario ?? '').trim().toLowerCase();
    if (!nombre || !/^[a-z0-9._-]{3,30}$/.test(usuario)) return respuesta({ error: 'Nombre o usuario inválido (usuario: 3 a 30 letras o números, sin espacios).' }, 400);
    if (contrasena.length < 8) return respuesta({ error: 'La contraseña necesita al menos 8 caracteres.' }, 400);
    if (!EMAIL.test(email)) return respuesta({ error: 'Hace falta un email válido para la cuenta.' }, 400);
    const { data: repetido } = await admin.from('usuarios').select('id').ilike('usuario', usuario).maybeSingle();
    if (repetido) return respuesta({ error: 'Ese usuario ya existe.' }, 409);

    const { data: creado, error } = await admin.auth.admin.createUser({ email, password: contrasena, email_confirm: true });
    if (error || !creado.user) return respuesta({ error: error?.message.includes('already') ? 'Ese email ya tiene una cuenta.' : 'No se pudo crear la cuenta.' }, 400);

    const permisos = cuerpo.permisos ?? { cobrar: true, anular: false, verReportes: false, editarProductos: false };
    const { error: errFila } = await admin.from('usuarios').insert({
      id: creado.user.id, nombre, usuario, email, rol: 'empleada', telefono: String(cuerpo.telefono ?? ''), activo: true, permisos,
    });
    if (errFila) {
      await admin.auth.admin.deleteUser(creado.user.id); // que no quede una cuenta a medias
      return respuesta({ error: 'No se pudo guardar la empleada.' }, 400);
    }
    return respuesta({ id: creado.user.id });
  }

  const id = String(cuerpo.id ?? '');
  const { data: objetivo } = await admin.from('usuarios').select('id, rol').eq('id', id).maybeSingle();
  if (!objetivo) return respuesta({ error: 'No existe esa persona.' }, 404);

  if (accion === 'contrasena') {
    if (contrasena.length < 8) return respuesta({ error: 'La contraseña necesita al menos 8 caracteres.' }, 400);
    const { error } = await admin.auth.admin.updateUserById(id, { password: contrasena });
    return error ? respuesta({ error: 'No se pudo cambiar la contraseña.' }, 400) : respuesta({ ok: true });
  }

  if (accion === 'email') {
    if (!EMAIL.test(email)) return respuesta({ error: 'Ese email no parece válido.' }, 400);
    const { error } = await admin.auth.admin.updateUserById(id, { email, email_confirm: true });
    if (error) return respuesta({ error: 'No se pudo cambiar el email (¿ya lo usa otra cuenta?).' }, 400);
    await admin.from('usuarios').update({ email }).eq('id', id);
    return respuesta({ ok: true });
  }

  if (accion === 'desactivar') {
    if (id === quien.user.id) return respuesta({ error: 'No podés desactivar tu propia cuenta.' }, 400);
    // Corta la sesión: la cuenta queda bloqueada en Auth además de inactiva en la tabla.
    await admin.auth.admin.updateUserById(id, { ban_duration: '876000h' });
    await admin.from('usuarios').update({ activo: false }).eq('id', id);
    return respuesta({ ok: true });
  }

  if (accion === 'activar') {
    await admin.auth.admin.updateUserById(id, { ban_duration: 'none' });
    await admin.from('usuarios').update({ activo: true }).eq('id', id);
    return respuesta({ ok: true });
  }

  return respuesta({ error: 'Acción desconocida' }, 400);
});

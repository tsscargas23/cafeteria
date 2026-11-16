// Prueba de la Edge Function "copia" con un Supabase simulado (sin red ni Deno: corre en Node).
// Uso: npm test (desde supabase/pruebas)
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const fuente = readFileSync(new URL('../functions/copia/index.ts', import.meta.url), 'utf8')
  .replace(/^import \{ createClient \} from 'npm:@supabase\/supabase-js@[^']+';$/m, 'const { createClient } = (globalThis as any).__supa;');
const archivo = join(mkdtempSync(join(tmpdir(), 'copia-')), 'funcion.ts');
writeFileSync(archivo, fuente);
let ok = 0, mal = 0;
const check = (c, m) => { if (c) { ok++; console.log('  OK  ', m); } else { mal++; console.log('  FALLA', m); } };
const CLAVE = 'x'.repeat(64);
const env = { SUPABASE_URL: 'http://falso.invalid', SUPABASE_SERVICE_ROLE_KEY: 'falsa', COPIA_CLAVE: CLAVE };
let ajustes = { id: 1, nombre_local: 'Panacota', copia: { cadaDias: 3, email: ' sofia@x.invalid ', ultima: null } };
const datos = { ajustes: [ajustes], ventas: Array.from({ length: 2500 }, (_, i) => ({ numero: i + 1 })), usuarios: [{ id: 'u1' }] };
globalThis.__supa = {
  createClient: () => ({
    from: (tabla) => ({
      select: () => {
        const q = {
          eq: () => q, order: () => q,
          single: async () => ({ data: ajustes, error: null }),
          range: async (a, b) => ({ data: (tabla === 'ajustes' ? [ajustes] : datos[tabla] ?? []).slice(a, b + 1), error: null }),
        };
        return q;
      },
      update: (v) => ({ eq: async () => { ajustes = { ...ajustes, ...v }; return { error: null }; } }),
    }),
  }),
};
globalThis.Deno = { env: { get: (k) => env[k] }, serve: (h) => { globalThis.__h = h; } };
await import(archivo);
const llamar = async (cuerpo, clave = CLAVE, metodo = 'POST') => {
  const r = await globalThis.__h(new Request('http://x/copia', { method: metodo, headers: clave === null ? {} : { 'x-clave-copia': clave }, body: metodo === 'POST' ? JSON.stringify(cuerpo) : undefined }));
  return { estado: r.status, cuerpo: await r.json() };
};
let r = await llamar({ accion: 'copia' }, null);
check(r.estado === 401, 'sin clave: 401');
r = await llamar({ accion: 'copia' }, 'x'.repeat(63) + 'y');
check(r.estado === 401, 'clave equivocada: 401');
r = await llamar({ accion: 'copia' }, '', 'GET');
check(r.estado === 405, 'GET: 405');
env.COPIA_CLAVE = 'corta';
r = await llamar({ accion: 'copia' }, 'corta');
check(r.estado === 401, 'si la clave configurada es corta, no entrega nada');
env.COPIA_CLAVE = CLAVE;
r = await llamar({ accion: 'config' });
check(r.estado === 200 && r.cuerpo.cadaDias === 3 && r.cuerpo.email === 'sofia@x.invalid' && r.cuerpo.local === 'Panacota', 'config: ' + JSON.stringify(r.cuerpo));
r = await llamar({ accion: 'copia' });
check(r.estado === 200 && r.cuerpo.copia.tablas.ventas.length === 2500, 'copia con 2500 ventas (3 páginas)');
check(r.cuerpo.copia.tipo === 'copia-panacota-tablas' && Object.keys(r.cuerpo.copia.tablas).length === 15, 'trae las 15 tablas');
check(typeof ajustes.copia.ultima === 'number' && ajustes.copia.cadaDias === 3, '«Última copia» actualizada sin perder la frecuencia');
r = await llamar({ accion: 'otra' });
check(r.estado === 400, 'acción desconocida: 400');
r = await globalThis.__h(new Request('http://x/copia', { method: 'POST', headers: { 'x-clave-copia': CLAVE }, body: 'no es json' }));
check(r.status === 400, 'cuerpo inválido: 400');
console.log(`\nResultado: ${ok} OK, ${mal} fallas`);
process.exit(mal ? 1 : 0);

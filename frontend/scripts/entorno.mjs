// Genera src/environments/environment.generado.ts con las variables de entorno del build.
// En Cloudflare Pages se definen SUPABASE_URL y SUPABASE_ANON_KEY en la configuración del proyecto;
// en la compu, en un archivo .env (que no se sube) o exportándolas antes de `npm run build`.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

if (existsSync('.env')) {
  for (const linea of readFileSync('.env', 'utf8').split('\n')) {
    const m = linea.match(/^\s*([A-Z_]+)\s*=\s*"?([^"#]*)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

const url = process.env.SUPABASE_URL ?? '';
const key = process.env.SUPABASE_ANON_KEY ?? '';
if (!url || !key) console.warn('[entorno] Sin SUPABASE_URL / SUPABASE_ANON_KEY: la app compila en modo demo.');

writeFileSync('src/environments/environment.generado.ts', `// Generado por scripts/entorno.mjs. No editar ni subir al repositorio.
export const entornoGenerado = { supabaseUrl: ${JSON.stringify(url)}, supabaseAnonKey: ${JSON.stringify(key)} };
`);
console.log('[entorno]', url ? `Supabase: ${url}` : 'modo demo');

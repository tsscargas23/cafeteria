// Prueba del script de Google (supabase/copia-google/Codigo.gs) con Drive, Gmail y Supabase simulados.
// Uso: npm test (desde supabase/pruebas)
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
let ok = 0, mal = 0;
const check = (c, m) => { if (c) { ok++; console.log('  OK  ', m); } else { mal++; console.log('  FALLA', m); } };
let ahora = new Date('2026-11-16T23:10:00-03:00').getTime();
const props = {}; const triggers = []; const archivos = []; const mails = []; const pedidos = [];
let config = { cadaDias: 1, email: 'sofia@x.invalid', local: 'Panacota' };
let respuestaCodigo = 200;
class F { constructor(b, fecha) { this.blob = b; this.fecha = new Date(fecha); this.papelera = false; }
  getDateCreated() { return this.fecha; } getSize() { return this.blob.bytes.length; } getBlob() { return this.blob; }
  getUrl() { return 'https://drive/' + this.blob.nombre; } setTrashed(v) { this.papelera = v; } }
const vivos = () => archivos.filter((a) => !a.papelera);
const iter = (l) => { let i = 0; return { hasNext: () => i < l.length, next: () => l[i++] }; };
const carpeta = { createFile: (b) => { const f = new F(b, ahora); archivos.push(f); return f; }, getFiles: () => iter(vivos()) };
let carpetaCreada = false;
const ctx = {
  Date: class extends Date { constructor(...a) { a.length ? super(...a) : super(ahora); } static now() { return ahora; } },
  JSON, Number, String, Error,
  PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props[k] ?? null, setProperty: (k, v) => { props[k] = v; } }) },
  ScriptApp: { getProjectTriggers: () => [...triggers], deleteTrigger: (t) => triggers.splice(triggers.indexOf(t), 1),
    newTrigger: (fn) => { const t = { fn }; const b = { timeBased: () => b, everyDays: (d) => { t.dias = d; return b; }, atHour: (h) => { t.hora = h; return b; }, inTimezone: (z) => { t.zona = z; return b; }, create: () => { triggers.push(t); return t; } }; return b; } },
  Logger: { log: () => {} },
  Utilities: { getUuid: () => crypto.randomUUID(), formatDate: (d, z, f) => '2026-11-16 23.10',
    newBlob: (texto, tipo, nombre) => ({ bytes: Buffer.from(texto), tipo, nombre }) },
  UrlFetchApp: { fetch: (url, o) => { pedidos.push({ url, o }); const accion = JSON.parse(o.payload).accion;
    const cuerpo = accion === 'config' ? config : { copia: { tipo: 'copia-panacota-tablas', tablas: { ventas: [1, 2, 3] } } };
    return { getResponseCode: () => respuestaCodigo, getContentText: () => respuestaCodigo === 200 ? JSON.stringify(cuerpo) : '{"error":"No autorizado"}' }; } },
  DriveApp: { getFoldersByName: () => iter(carpetaCreada ? [carpeta] : []), createFolder: () => { carpetaCreada = true; return carpeta; } },
  MailApp: { sendEmail: (m) => mails.push(m) },
  Session: { getEffectiveUser: () => ({ getEmail: () => 'panacotacafe@gmail.com' }) },
};
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('../copia-google/Codigo.gs', import.meta.url), 'utf8'), ctx);
const correr = (fn) => { try { vm.runInContext(fn + '()', ctx); return null; } catch (e) { return e.message; } };

check(/Falta la clave/.test(correr('copiaAhora')), 'sin configurar, avisa que falta la clave');
correr('configurar');
check(props.CLAVE?.length === 64, 'configurar crea una clave de 64 caracteres');
check(triggers.length === 1 && triggers[0].fn === 'hacerCopia' && triggers[0].hora === 23 && triggers[0].zona === 'America/Argentina/Buenos_Aires', 'una tarea diaria a las 23 (Buenos Aires)');
const clave = props.CLAVE; correr('configurar');
check(props.CLAVE === clave && triggers.length === 1, 'configurar dos veces no cambia la clave ni duplica la tarea');

correr('hacerCopia');
check(vivos().length === 1 && mails.length === 1, 'primera noche: guarda en Drive y manda el email');
check(pedidos.at(-1).o.headers['x-clave-copia'] === clave && pedidos.at(-1).url.endsWith('/functions/v1/copia'), 'llama a la función con la clave');
check(mails[0].to === 'sofia@x.invalid' && mails[0].attachments.length === 1 && /3 ventas/.test(mails[0].body), 'email a la dirección de Ajustes con el adjunto');
correr('hacerCopia');
check(vivos().length === 1, 'la misma noche no copia dos veces');
ahora += 23 * 3600000; correr('hacerCopia');
check(vivos().length === 2, 'cada 1 día: a la noche siguiente copia otra vez');
config = { cadaDias: 7, email: '', local: 'Panacota' };
ahora += 24 * 3600000; correr('hacerCopia');
check(vivos().length === 2, 'cada 7 días: al día siguiente no copia');
ahora += 6 * 24 * 3600000; correr('hacerCopia');
check(vivos().length === 3 && mails.at(-1).to === 'panacotacafe@gmail.com', 'a los 7 días copia; sin email en Ajustes, va al Gmail del negocio');
for (let i = 0; i < 125; i++) { ahora += 3600000; correr('copiaAhora'); }
check(vivos().length === 120, 'en Drive quedan las 120 más nuevas: ' + vivos().length);
respuestaCodigo = 401;
const err = correr('copiaAhora');
check(/Supabase respondió 401/.test(err ?? ''), 'si Supabase rechaza, falla con un error claro (Google avisa por email)');
console.log(`\nResultado: ${ok} OK, ${mal} fallas`);
process.exit(mal ? 1 : 0);

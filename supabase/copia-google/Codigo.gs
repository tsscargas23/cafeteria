/**
 * Copia de seguridad automática de Panacota (Google Apps Script, en la cuenta de Google del negocio).
 *
 * Todas las noches le pide a Supabase la copia (función "copia"), la guarda en la carpeta "Copias Panacota" de
 * Google Drive y la manda por email a la dirección de Ajustes. Respeta la frecuencia elegida en Ajustes
 * ("Hacer una copia cada…"). Si algo falla, Google le avisa por email al dueño del script.
 *
 * Instalación (una sola vez):
 *   1. Pegar este código en un proyecto nuevo de script.google.com y elegir la zona horaria de Buenos Aires.
 *   2. Ejecutar «configurar»: crea la clave y la tarea de todas las noches, y muestra la clave en el registro.
 *   3. Cargar esa clave en Supabase como secreto COPIA_CLAVE de las Edge Functions.
 *   4. Ejecutar «copiaAhora» para probar.
 * La clave vive solo en las propiedades del script y en Supabase: nunca en el código ni en GitHub.
 */

const URL_FUNCION = 'https://bwqwmruqzjzzwxukskqr.supabase.co/functions/v1/copia';
const CARPETA = 'Copias Panacota';
const ZONA = 'America/Argentina/Buenos_Aires';
const HORA = 23; // la tarea corre entre las 23 y las 24
const GUARDAR = 120; // copias que se guardan en Drive; las más viejas van a la papelera
const MAX_ADJUNTO = 20 * 1024 * 1024; // Gmail acepta hasta 25 MB: si la copia pesa más, el email lleva el link

/** Una sola vez: crea la clave (si no existe) y la tarea de todas las noches. */
function configurar() {
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('CLAVE')) {
    props.setProperty('CLAVE', (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, ''));
  }
  ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('hacerCopia').timeBased().everyDays(1).atHour(HORA).inTimezone(ZONA).create();
  Logger.log('Listo. Clave para cargar en Supabase como COPIA_CLAVE:\n' + props.getProperty('CLAVE'));
}

/** La que corre todas las noches: copia solo si ya pasaron los días elegidos en Ajustes. */
function hacerCopia() {
  const config = pedir('config');
  const ultima = ultimaCopia();
  const dias = Number(config.cadaDias) || 7;
  // Margen de 2 horas, para que la tarea de las 23 no se saltee un día por unos minutos.
  if (ultima && Date.now() - ultima.getTime() < dias * 86400000 - 2 * 3600000) return;
  copiar(config);
}

/** Para probar o para tener una copia ya mismo, sin esperar a la noche. */
function copiaAhora() {
  copiar(pedir('config'));
}

function copiar(config) {
  const datos = pedir('copia');
  const fecha = Utilities.formatDate(new Date(), ZONA, 'yyyy-MM-dd HH.mm');
  const archivo = carpeta().createFile(
    Utilities.newBlob(JSON.stringify(datos.copia), 'application/json', 'copia-panacota ' + fecha + '.json'),
  );
  limpiar();

  const para = config.email || Session.getEffectiveUser().getEmail();
  const ventas = (datos.copia.tablas.ventas || []).length;
  const asunto = 'Copia de seguridad de ' + (config.local || 'Panacota') + ' — ' + fecha;
  const texto =
    'Hola:\n\nAdjunta va la copia de seguridad del sistema (' + ventas + ' ventas en total). ' +
    'También quedó guardada en Google Drive, en la carpeta «' + CARPETA + '».\n\n' +
    'No hace falta hacer nada con este email. Si algún día hay que recuperar los datos, ese archivo es el que sirve.\n';
  if (archivo.getSize() <= MAX_ADJUNTO) {
    MailApp.sendEmail({ to: para, subject: asunto, body: texto, attachments: [archivo.getBlob()] });
  } else {
    MailApp.sendEmail({ to: para, subject: asunto, body: texto + '\nEl archivo es grande para adjuntarlo: está acá ' + archivo.getUrl() + '\n' });
  }
}

/** Llama a la función "copia" de Supabase con la clave guardada. */
function pedir(accion) {
  const clave = PropertiesService.getScriptProperties().getProperty('CLAVE');
  if (!clave) throw new Error('Falta la clave: ejecutá «configurar» primero.');
  const r = UrlFetchApp.fetch(URL_FUNCION, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-clave-copia': clave },
    payload: JSON.stringify({ accion: accion }),
    muteHttpExceptions: true,
  });
  if (r.getResponseCode() !== 200) {
    throw new Error('Supabase respondió ' + r.getResponseCode() + ': ' + r.getContentText().slice(0, 300));
  }
  return JSON.parse(r.getContentText());
}

function carpeta() {
  const encontradas = DriveApp.getFoldersByName(CARPETA);
  return encontradas.hasNext() ? encontradas.next() : DriveApp.createFolder(CARPETA);
}

/** Fecha de la copia más nueva de la carpeta, o null si no hay ninguna. */
function ultimaCopia() {
  let ultima = null;
  const archivos = carpeta().getFiles();
  while (archivos.hasNext()) {
    const f = archivos.next().getDateCreated();
    if (!ultima || f > ultima) ultima = f;
  }
  return ultima;
}

/** Deja las GUARDAR copias más nuevas; las demás van a la papelera de Drive (se pueden recuperar 30 días). */
function limpiar() {
  const lista = [];
  const archivos = carpeta().getFiles();
  while (archivos.hasNext()) lista.push(archivos.next());
  lista.sort((a, b) => b.getDateCreated() - a.getDateCreated());
  lista.slice(GUARDAR).forEach((f) => f.setTrashed(true));
}

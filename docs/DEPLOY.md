# Publicar el sistema real

> Escrito el 2026-11-14. Requiere las cuentas de `CUENTAS.md` (Gmail del negocio, Supabase, Cloudflare, dominio).
> Mientras no haya credenciales, la app compila en **modo demo** (datos en el navegador), igual que hoy.

## Cómo está armado

```
Celular / notebook  ──►  Cloudflare Pages (la web: panel + carta)  ──►  Supabase (base PostgreSQL + usuarios + fotos)
                                                                        └─ políticas RLS: quién puede leer y escribir qué
```

La web es estática (Angular). Habla directo con Supabase usando la clave pública `anon`; lo que protege los datos son
las **políticas RLS** de `supabase/migrations/0001_inicial.sql`, no la clave. Nada se calcula "de confianza" en el
navegador: precios, totales y permisos se validan en la base.

## 1. Supabase (una sola vez)

1. Entrar con `panacotacafe@gmail.com` → organización **Panacota** → **New project**.
   - Name: `panacota` · Region: **South America (São Paulo)** (la más cercana) · Database password: generar una fuerte y
     guardarla en el gestor de contraseñas de la dueña (no se usa a diario).
2. **SQL Editor** → correr, en orden, `supabase/migrations/0001_inicial.sql` y `0002_ventas_y_permisos.sql`. Crean tablas,
   permisos, tiempo real, las funciones de venta/anulación/ingreso y los datos iniciales (categorías, turnos, salones y
   las 12 mesas). **Cada migración se corre una sola vez y en orden.** No volver a correr una vieja: la 0002 recrearía
   versiones de las funciones de venta y de los permisos de caja que la 0008 corrigió.
   **Hecho el 2026-11-14:** proyecto `panacota` (ref `bwqwmruqzjzzwxukskqr`, São Paulo), 0001 aplicada, registro abierto
   desactivado, solo Email, dueña creada con `panacotacafe@gmail.com`.
2b. **Edge Functions → Deploy a new function → Via Editor**: nombre `empleadas`, código de
   `supabase/functions/empleadas/index.ts`. Es la que crea cuentas de empleadas y cambia contraseñas (usa la clave de
   servicio, que Supabase pone sola y nunca llega al navegador). En su configuración, **«Verify JWT» apagado**: la función
   valida por su cuenta que quien llama sea la dueña activa (con la opción «legacy» prendida, las sesiones firmadas con
   las claves nuevas pueden dar 401).
2c. Igual con la función `ingresar` (`supabase/functions/ingresar/index.ts`), también con **«Verify JWT» apagado** (quien
   la llama todavía no tiene sesión). Hace el ingreso por nombre de usuario sin devolver el email al navegador y bloquea
   15 minutos un usuario tras 5 intentos fallidos. Requiere las migraciones `0003_ingreso_seguro.sql` y
   `0004_usuarios_en_minuscula.sql` (usuarios siempre en minúscula y con formato fijo; búsqueda exacta, sin `ilike`).
   Después, `0005_permisos_y_tiempo_real.sql` (arregla `permiso()` y suma `insumos` al tiempo real),
   `0006_stock_con_mas_decimales.sql` y `0007_carta_publica.sql` (la carta del QR se lee sin sesión por la función
   `carta_publica()`, que devuelve solo nombres, tamaños, precios y descripciones).
   Después, `0008_arreglos_auditoria.sql` (arreglos de la auditoría de seguridad: turnos cerrados que no se pueden tocar,
   precios y pagos validados en la base, recetas solo de la dueña, anulación que devuelve lo que se descontó y el
   bloqueo de intentos sin carreras). **La función `ingresar` se tiene que volver a desplegar después de la 0008**,
   porque ahora usa `reservar_intento()`.
   Por último, `0009_permisos_funciones.sql`: les saca a las visitas sin sesión el permiso de llamar a las funciones de
   ventas y reportes (Supabase se lo da por defecto) y fija el `search_path` de los reportes. Cierra los avisos de
   *Advisors → Security*; los que quedan (`es_duena`, `es_usuaria_activa`, `permiso` y la protección de contraseñas
   filtradas, que es del plan pago) son esperables.
   Nota para la auditoría: el límite de intentos de Supabase Auth es por IP, y en este flujo la IP es la de la función.
3. **Authentication → Providers**: dejar solo **Email** (sin Google ni otros). En *Email*, desactivar «Confirm email»
   si las cuentas las crea la dueña a mano, o dejarlo activo si cada empleada confirma la suya.
4. **Authentication → URL Configuration**: Site URL = la dirección final (`https://panacota.pages.dev`). En Redirect URLs,
   esa misma con `/**` al final, y para probar en la compu `http://localhost:4200/**` y `http://localhost:4300/**`.
   Es a donde vuelve el link de «recuperar contraseña» (`?recuperar=1&code=...`).
5. **Authentication → Users → Add user**: crear a la dueña con su email y una contraseña provisoria. Copiar su `UUID`.
6. SQL Editor: darle de alta como dueña (reemplazar el UUID y los datos):
   ```sql
   insert into usuarios (id, nombre, usuario, email, rol, permisos)
   values ('UUID-DE-AUTH', 'Claudia', 'claudia', 'dueña@ejemplo.com', 'duena',
           '{"cobrar": true, "anular": true, "verReportes": true, "editarProductos": true}');
   ```
   Las empleadas después las crea la dueña desde el panel (**Empleadas**), que llama a la función `empleadas`.
7. **Project Settings → API**: copiar `Project URL` y `anon public key`. Son las dos variables del paso 3.

## 2. Cargar los datos iniciales

Desde el panel en modo real, la dueña importa productos e insumos con los Excel de **Productos → Importar** e
**Inventario → Importar** (la plantilla se descarga desde ahí). Mesas, salones y turnos se arman desde las pantallas.
Alternativa: un script `supabase/seed.sql` con los datos que ella pase (pendiente).

## 3. Cloudflare Pages (una sola vez)

**Hecho el 2026-11-14:** proyecto `panacota` → **https://panacota.pages.dev**, conectado a `tsscargas23/cafeteria`
(acceso de GitHub solo a ese repositorio). El `.npmrc` de `frontend/` hace que el `npm ci` automático de Cloudflare use
`legacy-peer-deps`, igual que en la Mac. Si un día se deja de trabajar juntos, el sitio publicado sigue andando con la
última versión; solo deja de actualizarse.

1. Entrar con `panacotacafe@gmail.com` → **Workers & Pages → Create → Pages → Connect to Git** → elegir el repositorio
   `tsscargas23/cafeteria` (Cloudflare pide autorizar GitHub; lo hace Alejo con su cuenta la primera vez).
2. Configuración del build:
   - Root directory: `frontend`
   - Build command: `npm ci --legacy-peer-deps && npm run build`
   - Build output directory: `dist/frontend/browser`
3. **Environment variables** (Production y Preview):
   - `SUPABASE_URL` = Project URL
   - `SUPABASE_ANON_KEY` = anon public key
   - `NODE_VERSION` = `22`
4. **Sin dominio propio** (decisión del 2026-11-14): se usa la dirección gratis que da Cloudflare, `panacota.pages.dev`
   (si el nombre está tomado, Cloudflare propone otro). En Supabase, Authentication → URL Configuration: Site URL =
   esa dirección, y agregarla en Redirect URLs con `/**` al final.
   Si algún día quiere dominio: **Custom domains** → agregarlo; para `.com.ar`, en nic.ar apuntar los servidores DNS a
   los de Cloudflare.
5. Probar: entrar al dominio, ingresar con la dueña, cambiar la contraseña provisoria.

Desde entonces, **cada push a `main` publica solo**. GitHub Pages (la demo) puede quedar como demo pública con datos
de ejemplo, porque sin credenciales compila en modo demo.

## 4. Copias de seguridad

- **Automática (sin dominio):** un Google Apps Script en la cuenta de Google del negocio (`supabase/copia-google/`) corre
  todas las noches a las 23, le pide los datos a la Edge Function `copia` y guarda un `.json` en Google Drive (carpeta
  «Copias Panacota», quedan las 120 más nuevas) y lo manda por email a la dirección de Ajustes. Respeta la frecuencia de
  Ajustes. Si falla, Google avisa por email al dueño del script.
  - La función `copia` se despliega con **«Verify JWT» apagado** y solo responde a quien manda la clave `COPIA_CLAVE`
    (secreto de Edge Functions en Supabase; la misma clave vive en las propiedades del script, nunca en el repo).
  - Instalación: pegar `Codigo.gs` en script.google.com (zona horaria Buenos Aires) → ejecutar `configurar` (crea la
    clave y la tarea, muestra la clave en el registro) → cargar esa clave en Supabase como `COPIA_CLAVE` → desplegar la
    función `copia` → ejecutar `copiaAhora` para probar.
  - Formato: `{tipo: 'copia-panacota-tablas', version: 1, creada, local, tablas: {ajustes, usuarios, ventas, ...}}`, las
    filas tal cual están en la base (para restaurar con SQL). Las contraseñas no van: quedan en Supabase Auth.
- **Manual:** **Ajustes → Descargar copia ahora** baja el estado de la app (`tipo: 'copia-cafeteria'`).
- Plan Pro (US$25/mes): además, copias diarias automáticas de Supabase.

## 5. Antes de entregar

- [ ] Correr la skill `security-audit` sobre el repositorio con Supabase conectado (RLS, auth, claves).
- [ ] Probar en la notebook de la caja y en un celular de las mozas, con el wifi del local.
- [ ] Imprimir el QR y probarlo con dos celulares distintos.
- [ ] Entregar accesos: el panel de Supabase y Cloudflare quedan en su Gmail; Alejo como colaborador.
- [ ] Instructivo corto con capturas (abrir caja, cobrar una mesa, cerrar caja, cargar una compra).

## En la compu (desarrollo)

```
cd frontend
cp .env.ejemplo .env      # y completar SUPABASE_URL / SUPABASE_ANON_KEY del proyecto
npm start                 # con .env vacío sigue siendo la demo
```

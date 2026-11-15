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
   las 12 mesas). Se pueden volver a correr sin romper nada.
   **Hecho el 2026-11-14:** proyecto `panacota` (ref `bwqwmruqzjzzwxukskqr`, São Paulo), 0001 aplicada, registro abierto
   desactivado, solo Email, dueña creada con `panacotacafe@gmail.com`.
2b. **Edge Functions → Deploy a new function → Via Editor**: nombre `empleadas`, código de
   `supabase/functions/empleadas/index.ts`. Es la que crea cuentas de empleadas y cambia contraseñas (usa la clave de
   servicio, que Supabase pone sola y nunca llega al navegador).
3. **Authentication → Providers**: dejar solo **Email** (sin Google ni otros). En *Email*, desactivar «Confirm email»
   si las cuentas las crea la dueña a mano, o dejarlo activo si cada empleada confirma la suya.
4. **Authentication → URL Configuration**: Site URL = la dirección final (`https://panacota.com.ar`). En Redirect URLs,
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
4. **Custom domains** → agregar `panacota.com.ar` (y `www`). Si el dominio es `.com.ar`, en nic.ar hay que apuntar los
   **servidores DNS** a los dos que Cloudflare indica (tarda hasta 24 h). Si es `.com` comprado en Cloudflare, es automático.
5. Probar: entrar al dominio, ingresar con la dueña, cambiar la contraseña provisoria.

Desde entonces, **cada push a `main` publica solo**. GitHub Pages (la demo) puede quedar como demo pública con datos
de ejemplo, porque sin credenciales compila en modo demo.

## 4. Copias de seguridad

- Plan Free: el botón **Ajustes → Descargar copia ahora** sigue funcionando (baja todo desde Supabase a un `.json`).
- La copia automática por email se hace con una **función programada** de Supabase (`pg_cron` + Edge Function que arma
  el archivo y lo manda con Resend). Pendiente: requiere el dominio verificado en Resend.
- Plan Pro (US$25/mes): copias diarias automáticas de Supabase, sin configurar nada.

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

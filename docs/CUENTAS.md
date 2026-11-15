# Cuentas que abre la dueña de Panacota

> Guía para ir adelantando el alojamiento. Escrita el 2026-11-13. **Email del negocio creado: panacotacafe@gmail.com** (paso 1 listo).
>
> **2026-11-14:** Supabase (organización «Panacota», plan Free) y Cloudflare creados con ese email. Alejo invitado en los dos
> (`alejotassello23@gmail.com`: Owner en Supabase, Super Administrator en Cloudflare). En Cloudflare la verificación en dos
> pasos está por código al email; falta sumar la app del celular. Pendiente: proyecto de Supabase y dominio.
>
> **Decisión (2026-11-14): sin dominio propio por ahora.** Es un sistema de uso interno del local; se usa la dirección gratis
> de Cloudflare Pages (`panacota.pages.dev` o parecida). La sección 4 queda para el día que quiera uno. Los precios son los que se veían a esa fecha: conviene
> confirmarlos en cada sitio antes de pagar.

**La regla:** todas las cuentas se abren con **un email del negocio** y quedan a nombre de la dueña. Alejo no necesita
las contraseñas: cada servicio permite **invitarlo como colaborador**, y así puede trabajar sin que nadie comparta claves.
Si un día dejan de trabajar juntos, ella sigue siendo la dueña de todo con un clic.

## Antes de empezar: dos consejos

- **Anotar cada contraseña en un lugar seguro** (un cuaderno guardado bajo llave, o el gestor de contraseñas del celular).
  Nunca mandar contraseñas por WhatsApp.
- En cada cuenta, **activar la verificación en dos pasos** con el celular. Si alguien averigua la contraseña, igual no entra.

## 1. Un Gmail para el negocio (gratis, 10 minutos)

Es la cuenta madre: con ese email se abren las demás y ahí llegan los avisos y las copias de seguridad.

1. Entrar a **gmail.com** → «Crear cuenta» → «Para mi trabajo o negocio» (si no aparece, «Para mí» sirve igual).
2. Elegir una dirección del estilo **panacota.sistema@gmail.com** (algo que no dependa de una persona).
3. Poner el **celular de la dueña** como número de recuperación.
4. Activar la verificación en dos pasos: en el menú de la cuenta → **Seguridad** → «Verificación en dos pasos».

Qué me pasa después: el email creado (solo la dirección, no la contraseña).

## 2. Supabase: la base de datos y los usuarios (gratis, 10 minutos)

Acá van a vivir las ventas, los productos, las empleadas y sus contraseñas (cifradas; nadie las ve).

1. Entrar a **supabase.com** → «Start your project» → «Sign up».
2. Elegir **registrarse con email** (no con GitHub) y usar el Gmail del negocio. Confirmar el email que llega.
3. Cuando pida crear una **organización**, ponerle **Panacota** y dejar el plan **Free**.
4. **No crear ningún proyecto** todavía: eso lo armo yo.
5. Invitarme: en la organización → **Team** → «Invite» → poner mi email. Así entro con mi propia cuenta.

Cómo funciona el plan gratis: alcanza para una cafetería (500 MB de base, 1 GB de fotos). Tiene dos cosas que hay que
saber: si **nadie usa el sistema durante 7 días** (por ejemplo, vacaciones), el proyecto se pausa y se reactiva con un
clic desde el panel de Supabase; y **no incluye copias de seguridad descargables**, por eso el sistema tiene su propia copia
por email. El plan **Pro** (US$25 por mes, con tarjeta) saca las dos cosas: no se pausa y hace copias diarias. Se puede
empezar gratis y pasar a Pro cuando quiera.

## 3. Cloudflare: la página web y el dominio (gratis, 10 minutos)

Acá se aloja el panel y la carta del QR, y se maneja el dominio.

1. Entrar a **dash.cloudflare.com/sign-up** → registrarse con el Gmail del negocio. Confirmar el email.
2. Activar la verificación en dos pasos: menú de la cuenta → **My Profile** → **Authentication**.
3. Invitarme: **Manage Account** → **Members** → «Invite» → mi email, con rol de administrador.

No hace falta cargar tarjeta para esto.

## 4. El dominio (opcional: por ahora no se usa)

Es lo que va a decir el QR y el panel, por ejemplo **panacota.com.ar**. Hay dos caminos; conviene decidir uno:

| | `.com.ar` | `.com` |
|---|---|---|
| Dónde | **nic.ar** (NIC Argentina, del Estado) | **Cloudflare**, desde la misma cuenta del punto 3 |
| Qué pide | CUIT y **clave fiscal** de ARCA (ex AFIP). Se paga en pesos | Tarjeta de crédito internacional. Se paga en dólares |
| Precio | Unos $8.500 por año en 2025 (confirmar en nic.ar) | Unos US$11 por año |
| Renovación | **Cada año, a mano.** Si se olvida, la página se cae | Se puede dejar en renovación automática |

Recomendación: si tiene CUIT (monotributo), **`.com.ar`**, que es más barato, en pesos y se ve local. Si no, `.com`.

Para `.com.ar`:
1. Entrar a **nic.ar** y buscar el nombre (por ejemplo «panacota») para ver si está libre.
2. Ingresar con **clave fiscal** (igual que en ARCA) y seguir el trámite de registro. Pagar.
3. Anotar la fecha de vencimiento en el calendario del celular, con un aviso un mes antes. **Es el paso que más se olvida.**
4. No tocar nada más: la configuración para que el dominio apunte a Cloudflare la hago yo.

Para `.com`: en Cloudflare → **Domain Registration** → «Register domains» → buscar el nombre → pagar con tarjeta → activar
«Auto-renew».

## 5. Más adelante (no hace falta ahora)

- **Resend** (gratis en volúmenes chicos): para que la copia de seguridad llegue por email automáticamente. Lo configuro
  yo cuando el dominio esté andando, con el Gmail del negocio.
- **Mercado Pago**: solo si en una etapa futura se hace la tienda de tortas online con cobro por la web.

## Resumen de lo que necesito de ella

1. La dirección del Gmail del negocio.
2. La invitación a la organización de Supabase.
3. La invitación como miembro en Cloudflare.
4. Qué dominio eligió y, si es `.com.ar`, el aviso de que ya está registrado.

Con eso puedo conectar el sistema real sin pedirle ninguna contraseña.

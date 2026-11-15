-- Ingreso por nombre de usuario sin exponer emails.
-- Antes, email_para_ingresar() se podía llamar sin sesión y devolvía el email de cualquier usuario activo.
-- Ahora el ingreso por usuario lo hace la Edge Function "ingresar" del lado del servidor, que además limita intentos.

drop function if exists email_para_ingresar(text);

-- Intentos de ingreso por usuario, para bloquear después de varios fallidos. Solo la usa la función "ingresar"
-- (con la clave de servicio): RLS activado y sin políticas = nadie más puede leerla ni escribirla.
create table if not exists intentos_ingreso (
  id bigint generated always as identity primary key,
  usuario text not null,
  fecha timestamptz not null default now(),
  exitoso boolean not null default false
);
create index if not exists intentos_ingreso_usuario_fecha on intentos_ingreso (lower(usuario), fecha desc);
alter table intentos_ingreso enable row level security;

-- Limpieza: no hace falta guardar intentos de hace más de un mes.
delete from intentos_ingreso where fecha < now() - interval '30 days';

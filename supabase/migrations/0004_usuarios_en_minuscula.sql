-- Los nombres de usuario se guardan siempre en minúscula y con un formato fijo, para que el ingreso busque por
-- coincidencia exacta (sin comodines) y el bloqueo por intentos no se pueda esquivar escribiendo variantes.

update usuarios set usuario = lower(trim(usuario)) where usuario <> lower(trim(usuario));

alter table usuarios drop constraint if exists usuario_formato;
alter table usuarios add constraint usuario_formato check (usuario ~ '^[a-z0-9._-]{3,30}$');

-- Los intentos viejos quedaron con lo que se escribió; se normalizan igual.
update intentos_ingreso set usuario = lower(trim(usuario)) where usuario <> lower(trim(usuario));
drop index if exists intentos_ingreso_usuario_fecha;
create index if not exists intentos_ingreso_usuario_fecha on intentos_ingreso (usuario, fecha desc);

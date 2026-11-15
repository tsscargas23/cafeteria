-- Arreglos encontrados en la prueba de punta a punta (2026-11-14).

-- 1) permiso(nombre): dentro de la consulta, "nombre" se resolvía como la columna usuarios.nombre ("Sofia Zaires")
--    y no como el parámetro, así que permiso('cobrar') daba siempre falso y nadie podía cobrar.
--    Se usa $1 (el parámetro) para que no haya ambigüedad. Mismo nombre de parámetro: las políticas no se tocan.
create or replace function permiso(nombre text) returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select (u.permisos ->> $1)::boolean from usuarios u where u.id = auth.uid() and u.activo), false);
$$;

-- 2) Tiempo real: la página también escucha los cambios de stock. Si una tabla escuchada no está en la publicación,
--    falla toda la suscripción (por eso la otra pestaña no veía las mesas).
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'insumos') then
    alter publication supabase_realtime add table insumos;
  end if;
end $$;

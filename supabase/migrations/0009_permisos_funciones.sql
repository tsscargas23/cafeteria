-- 0009: cierra los avisos de seguridad del panel de Supabase (Advisors). Se corre una sola vez, después de la 0008.
--
-- Supabase le da permiso de ejecutar a "anon" (sin sesión) en cada función nueva del esquema public, aunque la
-- migración haga "revoke ... from public". Estas funciones ya revisan adentro quién las llama, pero nadie sin sesión
-- tiene por qué poder llamarlas.
--
-- No se tocan:
--   · carta_publica: la usa la carta QR, sin sesión.
--   · es_duena, es_usuaria_activa y permiso: las usan las políticas de las tablas; sin sesión devuelven false.
--   · proteger_turno, validar_variante y guardar_precio_anterior: son de triggers y no se pueden llamar sueltas.

revoke execute on function registrar_venta(jsonb) from public, anon;
revoke execute on function anular_venta(uuid, text) from public, anon;
revoke execute on function resumen_ventas(timestamptz, timestamptz) from public, anon;
revoke execute on function ventas_por_producto(timestamptz, timestamptz) from public, anon;
grant execute on function registrar_venta(jsonb) to authenticated;
grant execute on function anular_venta(uuid, text) to authenticated;
grant execute on function resumen_ventas(timestamptz, timestamptz) to authenticated;
grant execute on function ventas_por_producto(timestamptz, timestamptz) to authenticated;

-- Los dos reportes no tenían search_path fijo.
alter function resumen_ventas(timestamptz, timestamptz) set search_path = public;
alter function ventas_por_producto(timestamptz, timestamptz) set search_path = public;

notify pgrst, 'reload schema';

-- Segunda etapa: ventas y anulaciones por funciones de la base (con el stock en la misma transacción),
-- ingreso por nombre de usuario, permisos más estrictos y datos iniciales del local.
-- Se puede correr más de una vez sin romper nada.

-- ---------- Ingresar con nombre de usuario ----------
-- Supabase Auth entra con email; esto traduce "sofia" al email de su cuenta. Solo devuelve algo para cuentas activas.
create or replace function email_para_ingresar(p_usuario text) returns text
language sql stable security definer set search_path = public as $$
  select email from usuarios where lower(usuario) = lower(trim(p_usuario)) and activo limit 1;
$$;
revoke all on function email_para_ingresar(text) from public;
grant execute on function email_para_ingresar(text) to anon, authenticated;

-- ---------- Registrar una venta ----------
-- Recibe la venta armada en la pantalla y, en una sola transacción: valida permisos, caja abierta, productos y que
-- los pagos sumen el total; guarda la venta (el número lo pone la base), descuenta el stock según la receta de cada
-- tamaño y, si viene de una mesa, la libera.
create or replace function registrar_venta(p jsonb) returns table (venta_id uuid, venta_numero int)
language plpgsql security definer set search_path = public as $$
declare
  v_turno uuid;
  v_total int := 0;
  v_pagado int := 0;
  v_id uuid;
  v_num int;
  l jsonb;
  r jsonb;
  v_receta jsonb;
begin
  if not (es_usuaria_activa() and permiso('cobrar')) then
    raise exception 'No tenés permiso para cobrar' using errcode = '42501';
  end if;

  select t.id into v_turno from turnos t where t.cerrado_en is null limit 1;
  if v_turno is null then
    raise exception 'La caja está cerrada. Abrila para vender.';
  end if;

  if jsonb_typeof(p -> 'lineas') is distinct from 'array' or jsonb_array_length(p -> 'lineas') = 0 then
    raise exception 'La venta no tiene productos.';
  end if;

  for l in select * from jsonb_array_elements(p -> 'lineas') loop
    if (l ->> 'cantidad')::int <= 0 or (l ->> 'precio')::int < 0 then
      raise exception 'Hay una cantidad o un precio inválido.';
    end if;
    if not exists (select 1 from variantes va where va.id = (l ->> 'varianteId')::uuid and va.producto_id = (l ->> 'productoId')::uuid) then
      raise exception 'Uno de los productos ya no existe.';
    end if;
    v_total := v_total + (l ->> 'cantidad')::int * (l ->> 'precio')::int;
  end loop;

  select coalesce(sum((x ->> 'monto')::int), 0) into v_pagado from jsonb_array_elements(coalesce(p -> 'pagos', '[]')) x;
  if v_pagado <> v_total then
    raise exception 'Los pagos (%) no suman el total (%).', v_pagado, v_total;
  end if;

  insert into ventas (id, origen, mesa, usuario_id, turno_id, lineas, pagos, total, personas)
  values (
    coalesce((p ->> 'id')::uuid, gen_random_uuid()), p ->> 'origen', p ->> 'mesa', auth.uid(), v_turno,
    p -> 'lineas', p -> 'pagos', v_total, greatest(coalesce((p ->> 'personas')::int, 1), 1)
  )
  returning ventas.id, ventas.numero into v_id, v_num;

  for l in select * from jsonb_array_elements(p -> 'lineas') loop
    select va.receta into v_receta from variantes va where va.id = (l ->> 'varianteId')::uuid;
    for r in select * from jsonb_array_elements(coalesce(v_receta, '[]')) loop
      if exists (select 1 from insumos i where i.id = (r ->> 'insumoId')::uuid) then
        update insumos set stock = stock - (r ->> 'cantidad')::numeric * (l ->> 'cantidad')::int where id = (r ->> 'insumoId')::uuid;
        insert into movimientos_stock (insumo_id, tipo, cantidad, detalle, usuario_id)
        values ((r ->> 'insumoId')::uuid, 'venta', -((r ->> 'cantidad')::numeric * (l ->> 'cantidad')::int), 'Venta #' || v_num, auth.uid());
      end if;
    end loop;
  end loop;

  if p ->> 'cuentaId' is not null then
    delete from cuentas where id = (p ->> 'cuentaId')::uuid;
  end if;

  return query select v_id, v_num;
end;
$$;
revoke all on function registrar_venta(jsonb) from public;
grant execute on function registrar_venta(jsonb) to authenticated;

-- ---------- Anular una venta ----------
-- No se borra: queda marcada con motivo, quién y cuándo, y el stock vuelve.
create or replace function anular_venta(p_id uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v ventas;
  l jsonb;
  r jsonb;
  v_receta jsonb;
begin
  if not (es_duena() or permiso('anular')) then
    raise exception 'No tenés permiso para anular ventas' using errcode = '42501';
  end if;
  if coalesce(trim(p_motivo), '') = '' then
    raise exception 'Hace falta un motivo para anular.';
  end if;

  select * into v from ventas where id = p_id for update;
  if not found then raise exception 'No existe esa venta.'; end if;
  if v.anulada is not null then return; end if;

  update ventas set anulada = jsonb_build_object('motivo', trim(p_motivo), 'porId', auth.uid(), 'fecha', (extract(epoch from now()) * 1000)::bigint)
  where id = p_id;

  for l in select * from jsonb_array_elements(v.lineas) loop
    select va.receta into v_receta from variantes va where va.id = (l ->> 'varianteId')::uuid;
    for r in select * from jsonb_array_elements(coalesce(v_receta, '[]')) loop
      if exists (select 1 from insumos i where i.id = (r ->> 'insumoId')::uuid) then
        update insumos set stock = stock + (r ->> 'cantidad')::numeric * (l ->> 'cantidad')::int where id = (r ->> 'insumoId')::uuid;
        insert into movimientos_stock (insumo_id, tipo, cantidad, detalle, usuario_id)
        values ((r ->> 'insumoId')::uuid, 'venta', (r ->> 'cantidad')::numeric * (l ->> 'cantidad')::int, 'Anulación venta #' || v.numero, auth.uid());
      end if;
    end loop;
  end loop;
end;
$$;
revoke all on function anular_venta(uuid, text) from public;
grant execute on function anular_venta(uuid, text) to authenticated;

-- ---------- Permisos más estrictos ----------
-- Las ventas solo entran y se anulan por las funciones de arriba (no directo desde la página).
drop policy if exists registrar_venta on ventas;
drop policy if exists anular_venta on ventas;
-- El stock lo mueven las funciones de venta o la dueña (compras y conteos). Las empleadas no editan insumos.
drop policy if exists descontar_stock on insumos;
drop policy if exists mover_stock on movimientos_stock;
drop policy if exists duena_movimientos on movimientos_stock;
create policy duena_movimientos on movimientos_stock for insert with check (es_duena());
-- "for all" incluía borrar turnos: se separa para que nadie pueda borrar un turno.
drop policy if exists caja on turnos;
drop policy if exists abrir_caja on turnos;
drop policy if exists actualizar_caja on turnos;
create policy abrir_caja on turnos for insert with check (es_usuaria_activa());
create policy actualizar_caja on turnos for update using (es_usuaria_activa()) with check (es_usuaria_activa());
-- La dueña no se puede borrar a sí misma ni quitarse el rol por error desde la página.
drop policy if exists duena_usuarios on usuarios;
drop policy if exists duena_crea_usuarios on usuarios;
drop policy if exists duena_edita_usuarios on usuarios;
create policy duena_edita_usuarios on usuarios for update using (es_duena()) with check (es_duena() and (id <> auth.uid() or (rol = 'duena' and activo)));

-- La tabla de ajustes tiene una sola fila: nadie inserta ni borra.
-- (No hay políticas de insert/delete en ajustes, así que la base lo rechaza.)

-- ---------- Datos iniciales del local ----------
insert into categorias (nombre, orden)
select * from (values ('Cafetería', 1), ('Panadería', 2), ('Pastelería', 3), ('Salados', 4), ('Bebidas', 5), ('Bar', 6)) v(nombre, orden)
where not exists (select 1 from categorias);

insert into turno_defs (nombre, desde, hasta, orden)
select * from (values ('Mañana', '07:00', '14:00', 1), ('Tarde', '14:30', '21:30', 2)) v(nombre, desde, hasta, orden)
where not exists (select 1 from turno_defs);

do $$
declare
  s_adentro uuid;
  s_vereda uuid;
begin
  if exists (select 1 from salones) then return; end if;
  insert into salones (nombre, orden) values ('Adentro', 1) returning id into s_adentro;
  insert into salones (nombre, orden) values ('Vereda', 2) returning id into s_vereda;
  insert into salones (nombre, orden) values ('Barra', 3);
  insert into mesas (salon_id, nombre, forma, x, y, w, h) values
    (s_adentro, '1', 'cuadrada', 2, 2, 3, 3), (s_adentro, '2', 'doble', 7, 2, 6, 3), (s_adentro, '3', 'cuadrada', 15, 2, 3, 3),
    (s_adentro, '4', 'redonda', 2, 8, 3, 3), (s_adentro, '5', 'cuadrada', 7, 8, 3, 3), (s_adentro, '6', 'doble', 12, 8, 6, 3),
    (s_vereda, '7', 'redonda', 2, 3, 3, 3), (s_vereda, '8', 'redonda', 7, 3, 3, 3), (s_vereda, '9', 'redonda', 12, 3, 3, 3),
    (s_vereda, '10', 'cuadrada', 2, 9, 3, 3), (s_vereda, '11', 'cuadrada', 7, 9, 3, 3), (s_vereda, '12', 'cuadrada', 12, 9, 3, 3);
end $$;

update ajustes set nombre_local = 'Panacota' where id = 1 and nombre_local = '';
update ajustes set carta = jsonb_build_object('frase', '', 'aviso', '', 'ordenCategorias', '[]'::jsonb, 'ocultos', '[]'::jsonb) where id = 1 and carta is null;

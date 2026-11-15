-- Arreglos de la auditoría de seguridad (2026-11-15). Ver ~/security-audit-skill/cafeteria/run-1/REPORT.md.
-- Idea general: la base no confía en lo que manda el navegador de una empleada. Precios, nombres, pagos, recetas y
-- turnos cerrados se validan acá, aunque alguien llame a la API "por atrás" con su propia sesión.
-- Se puede correr más de una vez sin romper nada.

-- =====================================================================================================
-- 1) Turnos: una empleada solo modifica el turno ABIERTO; los cerrados quedan como se cerraron.
--    Antes cualquiera podía reabrir un turno viejo (y así ver sus ventas sin permiso) o reescribir su arqueo.
-- =====================================================================================================
drop policy if exists abrir_caja on turnos;
drop policy if exists actualizar_caja on turnos;
create policy abrir_caja on turnos for insert with check (
  es_duena() or (es_usuaria_activa() and cerrado_en is null and arqueo is null and abierto_por_id = auth.uid())
);
create policy actualizar_caja on turnos for update
  using (es_duena() or (es_usuaria_activa() and cerrado_en is null))
  with check (es_usuaria_activa());

-- Controles que una política no puede hacer: cómo se abrió la caja no cambia, los movimientos ya anotados no se
-- borran, y al cerrar, el "debería haber" lo calcula la base (no el navegador).
create or replace function proteger_turno() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  m jsonb;
  v_efectivo bigint;
  v_movs bigint;
  v_esperado bigint;
begin
  if jsonb_typeof(new.movimientos) is distinct from 'array' then
    raise exception 'Los movimientos de caja no son válidos.';
  end if;
  for m in select * from jsonb_array_elements(new.movimientos) loop
    if jsonb_typeof(m) is distinct from 'object' or coalesce(m ->> 'tipo', '') not in ('ingreso', 'egreso')
       or jsonb_typeof(m -> 'monto') is distinct from 'number'
       or (m ->> 'monto')::numeric <= 0 or (m ->> 'monto')::numeric <> trunc((m ->> 'monto')::numeric) then
      raise exception 'Hay un movimiento de caja con un monto inválido.';
    end if;
  end loop;
  if new.efectivo_inicial < 0 then
    raise exception 'El cambio inicial no puede ser negativo.';
  end if;

  -- La dueña (o el panel de Supabase, sin sesión) puede corregir cualquier turno. El resto, solo el abierto.
  if tg_op = 'UPDATE' and auth.uid() is not null and not es_duena() then
    new.abierto_en := old.abierto_en;
    new.abierto_por_id := old.abierto_por_id;
    new.efectivo_inicial := old.efectivo_inicial;
    new.billetes_inicial := old.billetes_inicial;
    if exists (select 1 from jsonb_array_elements(old.movimientos) o where not new.movimientos @> jsonb_build_array(o)) then
      raise exception 'Los movimientos de caja ya anotados no se pueden borrar ni cambiar. Pedile a la dueña.';
    end if;
    if new.cerrado_en is null then
      new.arqueo := null;
      new.cerrado_por_id := null;
    else
      new.cerrado_en := now();
      new.cerrado_por_id := auth.uid();
    end if;
  end if;

  -- Al cerrar: efectivo esperado = cambio inicial + cobros en efectivo del turno (sin anuladas) + ingresos − egresos.
  if tg_op = 'UPDATE' and old.cerrado_en is null and new.cerrado_en is not null then
    select coalesce(sum((x ->> 'monto')::int), 0) into v_efectivo
    from ventas v, jsonb_array_elements(v.pagos) x
    where v.turno_id = new.id and v.anulada is null and x ->> 'medio' = 'efectivo';
    select coalesce(sum(case when m2 ->> 'tipo' = 'ingreso' then (m2 ->> 'monto')::int else -(m2 ->> 'monto')::int end), 0) into v_movs
    from jsonb_array_elements(new.movimientos) m2;
    v_esperado := new.efectivo_inicial + v_efectivo + v_movs;
    new.arqueo := coalesce(new.arqueo, '{}'::jsonb) || jsonb_build_object(
      'esperado', v_esperado,
      'diferencia', coalesce((new.arqueo ->> 'contado')::numeric, 0) - v_esperado
    );
  end if;
  return new;
end;
$$;
drop trigger if exists proteger_turno on turnos;
create trigger proteger_turno before insert or update on turnos for each row execute function proteger_turno();

-- =====================================================================================================
-- 2) Recetas: tienen que ser una lista de {insumoId, cantidad >= 0}, y solo la dueña las cambia.
--    La receta descuenta stock al vender: con una cantidad negativa se podía "sumar" stock sin ser la dueña.
-- =====================================================================================================
create or replace function validar_variante() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r jsonb;
begin
  if jsonb_typeof(new.receta) is distinct from 'array' or jsonb_array_length(new.receta) > 50 then
    raise exception 'La receta de % no es válida.', new.nombre;
  end if;
  for r in select * from jsonb_array_elements(new.receta) loop
    if jsonb_typeof(r) is distinct from 'object'
       or coalesce(r ->> 'insumoId', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       or jsonb_typeof(r -> 'cantidad') is distinct from 'number' or (r ->> 'cantidad')::numeric < 0 then
      raise exception 'La receta de % tiene un insumo o una cantidad inválida.', new.nombre;
    end if;
  end loop;
  -- El permiso "editar productos" es para nombres y precios; la receta mueve el stock, así que es de la dueña.
  if auth.uid() is not null and not es_duena()
     and (case when tg_op = 'INSERT' then new.receta <> '[]'::jsonb else new.receta is distinct from old.receta end) then
    raise exception 'Solo la dueña puede cambiar las recetas.';
  end if;
  return new;
end;
$$;
drop trigger if exists validar_variante on variantes;
create trigger validar_variante before insert or update on variantes for each row execute function validar_variante();

-- =====================================================================================================
-- 3) Precios: la venta usa el precio de la carta. Se guarda el precio anterior unas horas, para que una mesa
--    abierta antes de un cambio de precio se pueda cobrar como se pidió.
-- =====================================================================================================
create table if not exists precios_anteriores (
  variante_id uuid not null,
  precio integer not null,
  hasta timestamptz not null default now()
);
create index if not exists precios_anteriores_variante on precios_anteriores (variante_id, hasta desc);
alter table precios_anteriores enable row level security; -- sin políticas: solo la usan las funciones de abajo
revoke all on precios_anteriores from anon, authenticated;

create or replace function guardar_precio_anterior() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into precios_anteriores (variante_id, precio) values (old.id, old.precio);
  delete from precios_anteriores where hasta < now() - interval '2 days';
  return new;
end;
$$;
drop trigger if exists guardar_precio_anterior on variantes;
create trigger guardar_precio_anterior after update of precio on variantes
  for each row when (old.precio is distinct from new.precio) execute function guardar_precio_anterior();

-- =====================================================================================================
-- 4) Registrar una venta, versión segura:
--    * nombre, tamaño, categoría y "es café" salen del catálogo; el precio tiene que ser el de la carta
--      (o el anterior, si cambió hace menos de 24 horas);
--    * cada pago tiene un medio conocido y un monto entero positivo (los de $0 se ignoran);
--    * si viene de una mesa, se bloquea la cuenta: si otro aparato ya la cobró, no se cobra dos veces.
-- =====================================================================================================
create or replace function registrar_venta(p jsonb) returns table (venta_id uuid, venta_numero int)
language plpgsql security definer set search_path = public as $$
declare
  v_turno uuid;
  v_total int := 0;
  v_pagado int := 0;
  v_id uuid;
  v_num int;
  v_lineas jsonb := '[]';
  v_pagos jsonb := '[]';
  v_cant int;
  v_precio int;
  l jsonb;
  x jsonb;
  r jsonb;
  v_receta jsonb;
  c record;
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
  if jsonb_array_length(p -> 'lineas') > 200 then
    raise exception 'La venta tiene demasiadas líneas.';
  end if;

  if p ->> 'cuentaId' is not null then
    perform 1 from cuentas where id = (p ->> 'cuentaId')::uuid for update;
    if not found then
      raise exception 'Esta mesa ya se cobró o se cerró desde otro aparato. Revisá las ventas antes de cobrar de nuevo.';
    end if;
  end if;

  for l in select * from jsonb_array_elements(p -> 'lineas') loop
    if jsonb_typeof(l) is distinct from 'object' then
      raise exception 'Hay una línea inválida.';
    end if;
    v_cant := (l ->> 'cantidad')::int;
    v_precio := (l ->> 'precio')::int;
    if v_cant is null or v_cant <= 0 or v_cant > 1000 or v_precio is null then
      raise exception 'Hay una cantidad o un precio inválido.';
    end if;
    select va.precio, va.nombre as tamano, pr.nombre, pr.categoria, pr.es_cafe,
           (select count(*) from variantes o where o.producto_id = pr.id) as tamanos
      into c
      from variantes va join productos pr on pr.id = va.producto_id
      where va.id = (l ->> 'varianteId')::uuid and va.producto_id = (l ->> 'productoId')::uuid;
    if not found then
      raise exception 'Uno de los productos ya no existe.';
    end if;
    if v_precio <> c.precio and not exists (
      select 1 from precios_anteriores pa
      where pa.variante_id = (l ->> 'varianteId')::uuid and pa.precio = v_precio and pa.hasta > now() - interval '24 hours'
    ) then
      raise exception 'El precio de % no coincide con la carta. Recargá la página y volvé a cargarlo.', c.nombre;
    end if;
    v_lineas := v_lineas || jsonb_build_array(jsonb_build_object(
      'productoId', (l ->> 'productoId')::uuid, 'varianteId', (l ->> 'varianteId')::uuid,
      'nombre', c.nombre, 'variante', case when c.tamanos > 1 then c.tamano else '' end,
      'categoria', c.categoria, 'esCafe', c.es_cafe, 'precio', v_precio, 'cantidad', v_cant
    ));
    v_total := v_total + v_cant * v_precio;
  end loop;

  if p -> 'pagos' is not null and jsonb_typeof(p -> 'pagos') is distinct from 'array' then
    raise exception 'Los pagos no son válidos.';
  end if;
  if jsonb_array_length(coalesce(p -> 'pagos', '[]')) > 50 then
    raise exception 'La venta tiene demasiados pagos.';
  end if;
  for x in select * from jsonb_array_elements(coalesce(p -> 'pagos', '[]')) loop
    if jsonb_typeof(x) is distinct from 'object'
       or coalesce(x ->> 'medio', '') not in ('efectivo', 'transferencia', 'mercadopago', 'debito', 'credito')
       or jsonb_typeof(x -> 'monto') is distinct from 'number'
       or (x ->> 'monto')::numeric < 0 or (x ->> 'monto')::numeric <> trunc((x ->> 'monto')::numeric) then
      raise exception 'Hay un pago inválido.';
    end if;
    continue when (x ->> 'monto')::int = 0;
    v_pagos := v_pagos || jsonb_build_array(jsonb_build_object(
      'medio', x ->> 'medio', 'monto', (x ->> 'monto')::int, 'quien', left(coalesce(x ->> 'quien', ''), 60)
    ));
    v_pagado := v_pagado + (x ->> 'monto')::int;
  end loop;
  if v_pagado <> v_total then
    raise exception 'Los pagos (%) no suman el total (%).', v_pagado, v_total;
  end if;

  insert into ventas (id, origen, mesa, usuario_id, turno_id, lineas, pagos, total, personas)
  values (
    coalesce((p ->> 'id')::uuid, gen_random_uuid()), p ->> 'origen', left(p ->> 'mesa', 40), auth.uid(), v_turno,
    v_lineas, v_pagos, v_total, least(greatest(coalesce((p ->> 'personas')::int, 1), 1), 100)
  )
  returning ventas.id, ventas.numero into v_id, v_num;

  for l in select * from jsonb_array_elements(v_lineas) loop
    select va.receta into v_receta from variantes va where va.id = (l ->> 'varianteId')::uuid;
    for r in select * from jsonb_array_elements(coalesce(v_receta, '[]')) loop
      if (r ->> 'cantidad')::numeric > 0 and exists (select 1 from insumos i where i.id = (r ->> 'insumoId')::uuid) then
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

-- =====================================================================================================
-- 5) Anular una venta: devuelve al stock exactamente lo que esa venta descontó (no lo que diga la receta hoy),
--    y una empleada solo anula ventas del turno abierto (las de turnos cerrados, la dueña).
-- =====================================================================================================
create or replace function anular_venta(p_id uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v ventas;
  s record;
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
  if not es_duena() and v.turno_id is distinct from (select t.id from turnos t where t.cerrado_en is null limit 1) then
    raise exception 'Solo la dueña puede anular ventas de un turno que ya se cerró.';
  end if;

  update ventas set anulada = jsonb_build_object('motivo', left(trim(p_motivo), 200), 'porId', auth.uid(), 'fecha', (extract(epoch from now()) * 1000)::bigint)
  where id = p_id;

  for s in
    select m.insumo_id, -sum(m.cantidad) as cantidad
    from movimientos_stock m
    where m.tipo = 'venta' and m.detalle = 'Venta #' || v.numero
    group by m.insumo_id
  loop
    if s.cantidad > 0 and exists (select 1 from insumos i where i.id = s.insumo_id) then
      update insumos set stock = stock + s.cantidad where id = s.insumo_id;
      insert into movimientos_stock (insumo_id, tipo, cantidad, detalle, usuario_id)
      values (s.insumo_id, 'venta', s.cantidad, 'Anulación venta #' || v.numero, auth.uid());
    end if;
  end loop;
end;
$$;
revoke all on function anular_venta(uuid, text) from public;
grant execute on function anular_venta(uuid, text) to authenticated;

-- =====================================================================================================
-- 6) Ingreso por usuario: el intento se reserva ANTES de probar la contraseña, de a uno por usuario.
--    Antes se contaba y se anotaba por separado, y muchos pedidos al mismo tiempo pasaban todos el límite de 5.
--    Solo la llama la Edge Function "ingresar" (con la clave de servicio).
-- =====================================================================================================
create or replace function reservar_intento(p_usuario text, p_maximo int, p_minutos int) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_id bigint;
begin
  perform pg_advisory_xact_lock(hashtext('ingresar:' || p_usuario));
  if (select count(*) from intentos_ingreso
      where usuario = p_usuario and not exitoso and fecha >= now() - make_interval(mins => p_minutos)) >= p_maximo then
    return null;
  end if;
  insert into intentos_ingreso (usuario, exitoso) values (p_usuario, false) returning id into v_id;
  delete from intentos_ingreso where fecha < now() - interval '30 days';
  return v_id;
end;
$$;
revoke all on function reservar_intento(text, int, int) from public, anon, authenticated;
grant execute on function reservar_intento(text, int, int) to service_role;

-- Por si quedó de antes: la función que devolvía emails sin sesión no tiene que existir.
drop function if exists email_para_ingresar(text);

-- Que la API vea las funciones nuevas sin esperar.
notify pgrst, 'reload schema';

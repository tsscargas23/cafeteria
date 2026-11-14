-- Base de datos de Panacota. Un solo local: todas las personas con cuenta son de la misma cafetería.
-- Se aplica desde el panel de Supabase (SQL Editor) o con `supabase db push`.
--
-- Reglas de seguridad (RLS):
--   * Solo entra gente con sesión (auth.users) que además figure en `usuarios` y esté activa.
--   * La dueña puede todo. Las empleadas solo lo que necesitan para atender: mesas, ventas, caja y stock por venta.
--   * Las ventas nunca se borran: se anulan con motivo.
--   * Los totales de reportes se calculan en la base (funciones al final), nunca en el navegador.

create extension if not exists pgcrypto;

-- ---------- Personas ----------

create table usuarios (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre text not null,
  usuario text not null unique,
  email text not null,
  rol text not null check (rol in ('duena', 'empleada')),
  telefono text not null default '',
  activo boolean not null default true,
  permisos jsonb not null default '{"cobrar": true, "anular": false, "verReportes": false, "editarProductos": false}',
  creado_en timestamptz not null default now()
);

-- ¿La persona con sesión es la dueña? / ¿está activa? (security definer para poder leer `usuarios` desde las políticas)
create or replace function es_duena() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from usuarios where id = auth.uid() and rol = 'duena' and activo);
$$;

create or replace function es_usuaria_activa() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from usuarios where id = auth.uid() and activo);
$$;

create or replace function permiso(nombre text) returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select (permisos ->> nombre)::boolean from usuarios where id = auth.uid() and activo), false);
$$;

-- ---------- Catálogo ----------

create table ajustes (
  id int primary key default 1 check (id = 1), -- una sola fila
  nombre_local text not null default 'Panacota',
  direccion text not null default '',
  telefono text not null default '',
  alias text not null default '',
  medios_activos text[] not null default '{efectivo,transferencia,mercadopago,debito,credito}',
  arqueo_ciego boolean not null default false,
  copia jsonb not null default '{"cadaDias": 7, "email": "", "ultima": null}',
  carta jsonb not null default '{"frase": "", "aviso": "", "ordenCategorias": [], "ocultos": []}'
);
insert into ajustes (id) values (1);

create table categorias (
  nombre text primary key,
  orden int not null default 0
);

create table productos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  categoria text not null references categorias (nombre) on update cascade,
  descripcion text not null default '',
  donde_se_vende text not null default 'ambos' check (donde_se_vende in ('local', 'online', 'ambos')),
  activo boolean not null default true,
  es_cafe boolean not null default false,
  creado_en timestamptz not null default now()
);

create table variantes (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references productos (id) on delete cascade,
  nombre text not null,
  precio integer not null check (precio >= 0),
  receta jsonb not null default '[]', -- [{insumoId, cantidad}]
  orden int not null default 0
);
create index on variantes (producto_id);

create table insumos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  categoria text not null default 'Almacén',
  unidad text not null check (unidad in ('kg', 'L', 'u')),
  stock numeric(12, 3) not null default 0,
  minimo numeric(12, 3) not null default 0,
  costo integer not null default 0
);

create table movimientos_stock (
  id uuid primary key default gen_random_uuid(),
  insumo_id uuid not null references insumos (id) on delete cascade,
  fecha timestamptz not null default now(),
  tipo text not null check (tipo in ('compra', 'venta', 'ajuste')),
  cantidad numeric(12, 3) not null,
  detalle text not null default '',
  usuario_id uuid references usuarios (id)
);
create index on movimientos_stock (insumo_id, fecha desc);

create table proveedores (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  contacto text not null default '',
  telefono text not null default '',
  dias_entrega text not null default '',
  notas text not null default '',
  trae jsonb not null default '[]' -- [{insumoId, ultimoPrecio}]
);

create table compras (
  id uuid primary key default gen_random_uuid(),
  proveedor_id uuid not null references proveedores (id),
  fecha timestamptz not null default now(),
  items jsonb not null default '[]',  -- [{insumoId, cantidad, precio}]
  total integer not null default 0,
  pagos jsonb not null default '[]',  -- [{fecha, monto, medio, deCaja}]
  comprobante text not null default '',
  usuario_id uuid references usuarios (id)
);

-- ---------- Salón ----------

create table salones (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  orden int not null default 0
);

create table mesas (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salones (id) on delete cascade,
  nombre text not null,
  forma text not null check (forma in ('cuadrada', 'doble', 'redonda', 'banqueta')),
  x int not null default 0, y int not null default 0, w int not null default 3, h int not null default 3
);

-- Mesa abierta. Se borra al cobrarse (queda la venta).
create table cuentas (
  id uuid primary key default gen_random_uuid(),
  mesa_id uuid not null unique references mesas (id),
  abierta_en timestamptz not null default now(),
  atiende_id uuid references usuarios (id),
  personas jsonb not null default '[]',
  items jsonb not null default '[]',
  pagos jsonb not null default '[]',
  pidio_cuenta boolean not null default false,
  actualizada_en timestamptz not null default now()
);

-- ---------- Caja y ventas ----------

create table turno_defs (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  desde text not null, -- "07:00"
  hasta text not null,
  orden int not null default 0
);

create table turnos (
  id uuid primary key default gen_random_uuid(),
  def_id uuid references turno_defs (id),
  abierto_en timestamptz not null default now(),
  cerrado_en timestamptz,
  abierto_por_id uuid references usuarios (id),
  cerrado_por_id uuid references usuarios (id),
  empleada_ids uuid[] not null default '{}',
  efectivo_inicial integer not null default 0,
  billetes_inicial jsonb,
  movimientos jsonb not null default '[]', -- [{id, fecha, tipo, monto, motivo}]
  arqueo jsonb                              -- {contado, esperado, diferencia, nota, billetes}
);
-- Solo puede haber un turno abierto a la vez.
create unique index un_turno_abierto on turnos ((cerrado_en is null)) where cerrado_en is null;

create sequence numero_venta;

create table ventas (
  id uuid primary key default gen_random_uuid(),
  numero integer not null default nextval('numero_venta') unique,
  fecha timestamptz not null default now(),
  origen text not null check (origen in ('mesa', 'mostrador')),
  mesa text,
  usuario_id uuid references usuarios (id),
  turno_id uuid references turnos (id),
  lineas jsonb not null,  -- [{productoId, varianteId, nombre, variante, categoria, esCafe, precio, cantidad}]
  pagos jsonb not null,   -- [{medio, monto, quien}]
  total integer not null check (total >= 0),
  personas int not null default 1,
  anulada jsonb           -- {motivo, porId, fecha}
);
create index on ventas (fecha desc);
create index on ventas (turno_id);

-- ---------- Permisos (RLS) ----------

alter table usuarios enable row level security;
alter table ajustes enable row level security;
alter table categorias enable row level security;
alter table productos enable row level security;
alter table variantes enable row level security;
alter table insumos enable row level security;
alter table movimientos_stock enable row level security;
alter table proveedores enable row level security;
alter table compras enable row level security;
alter table salones enable row level security;
alter table mesas enable row level security;
alter table cuentas enable row level security;
alter table turno_defs enable row level security;
alter table turnos enable row level security;
alter table ventas enable row level security;

-- Todas las personas activas leen todo lo que necesitan para trabajar.
create policy leer_usuarios on usuarios for select using (es_usuaria_activa());
create policy leer_ajustes on ajustes for select using (es_usuaria_activa());
create policy leer_categorias on categorias for select using (es_usuaria_activa());
create policy leer_productos on productos for select using (es_usuaria_activa());
create policy leer_variantes on variantes for select using (es_usuaria_activa());
create policy leer_insumos on insumos for select using (es_usuaria_activa());
create policy leer_movimientos on movimientos_stock for select using (es_usuaria_activa());
create policy leer_salones on salones for select using (es_usuaria_activa());
create policy leer_mesas on mesas for select using (es_usuaria_activa());
create policy leer_cuentas on cuentas for select using (es_usuaria_activa());
create policy leer_turno_defs on turno_defs for select using (es_usuaria_activa());
create policy leer_turnos on turnos for select using (es_usuaria_activa());
create policy leer_ventas on ventas for select using (es_usuaria_activa() and (es_duena() or permiso('verReportes') or turno_id in (select id from turnos where cerrado_en is null)));

-- Solo la dueña administra: personas, ajustes, catálogo, proveedores, compras, salón y turnos de referencia.
create policy duena_usuarios on usuarios for all using (es_duena()) with check (es_duena());
create policy duena_ajustes on ajustes for update using (es_duena()) with check (es_duena());
create policy duena_categorias on categorias for all using (es_duena()) with check (es_duena());
create policy duena_productos on productos for all using (es_duena() or permiso('editarProductos')) with check (es_duena() or permiso('editarProductos'));
create policy duena_variantes on variantes for all using (es_duena() or permiso('editarProductos')) with check (es_duena() or permiso('editarProductos'));
create policy duena_insumos on insumos for all using (es_duena()) with check (es_duena());
create policy duena_proveedores on proveedores for all using (es_duena()) with check (es_duena());
create policy duena_compras on compras for all using (es_duena()) with check (es_duena());
create policy duena_salones on salones for all using (es_duena()) with check (es_duena());
create policy duena_mesas on mesas for all using (es_duena()) with check (es_duena());
create policy duena_turno_defs on turno_defs for all using (es_duena()) with check (es_duena());

-- Las empleadas atienden: abren y modifican mesas, registran ventas, abren y cierran la caja, y el stock se mueve por ventas.
create policy atender_cuentas on cuentas for all using (es_usuaria_activa()) with check (es_usuaria_activa());
create policy registrar_venta on ventas for insert with check (es_usuaria_activa() and permiso('cobrar'));
create policy anular_venta on ventas for update using (es_duena() or permiso('anular')) with check (es_duena() or permiso('anular'));
create policy caja on turnos for all using (es_usuaria_activa()) with check (es_usuaria_activa());
create policy mover_stock on movimientos_stock for insert with check (es_usuaria_activa());
create policy descontar_stock on insumos for update using (es_usuaria_activa()) with check (es_usuaria_activa());

-- Nadie borra ventas ni turnos: no hay política de delete, así que la base lo rechaza.

-- ---------- Tiempo real ----------
-- Para que la tablet de la caja y los celulares de las mozas vean las mismas mesas al instante.
alter publication supabase_realtime add table cuentas, mesas, turnos, ventas;

-- ---------- Reportes calculados en la base ----------
-- Total y cantidad de ventas entre dos fechas (sin las anuladas). El navegador muestra lo que devuelve esto.
create or replace function resumen_ventas(desde timestamptz, hasta timestamptz)
returns table (ventas bigint, total bigint) language sql stable security invoker as $$
  select count(*), coalesce(sum(total), 0) from ventas where anulada is null and fecha between desde and hasta;
$$;

-- Vendido por producto y tamaño entre dos fechas.
create or replace function ventas_por_producto(desde timestamptz, hasta timestamptz)
returns table (producto_id text, variante_id text, nombre text, variante text, categoria text, cantidad bigint, total bigint)
language sql stable security invoker as $$
  select l ->> 'productoId', l ->> 'varianteId', l ->> 'nombre', l ->> 'variante', l ->> 'categoria',
         sum((l ->> 'cantidad')::int), sum((l ->> 'cantidad')::int * (l ->> 'precio')::int)
  from ventas v, jsonb_array_elements(v.lineas) l
  where v.anulada is null and v.fecha between desde and hasta
  group by 1, 2, 3, 4, 5
  order by 7 desc;
$$;

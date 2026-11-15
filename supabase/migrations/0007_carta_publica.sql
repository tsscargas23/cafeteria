-- Carta pública (la del QR): la ven clientes sin cuenta. Las tablas no se abren a "anon"; en cambio, esta función
-- devuelve SOLO lo que va en la carta: datos del local, categorías y productos visibles con tamaños, precios y
-- descripción. Nada de costos, stock, recetas, ventas ni personas.
create or replace function carta_publica() returns jsonb
language sql stable security definer set search_path = public as $$
  with a as (select * from ajustes where id = 1),
  ocultos as (select jsonb_array_elements_text(coalesce((select carta -> 'ocultos' from a), '[]')) as id),
  visibles as (
    select p.id, p.nombre, p.categoria, p.descripcion, p.creado_en
    from productos p
    where p.activo and p.donde_se_vende <> 'online' and p.id::text not in (select id from ocultos)
  )
  select jsonb_build_object(
    'nombreLocal', (select nombre_local from a),
    'direccion', (select direccion from a),
    'telefono', (select telefono from a),
    'frase', coalesce((select carta ->> 'frase' from a), ''),
    'aviso', coalesce((select carta ->> 'aviso' from a), ''),
    'ordenCategorias', coalesce((select carta -> 'ordenCategorias' from a), '[]'),
    'categorias', coalesce((select jsonb_agg(c.nombre order by c.orden) from categorias c), '[]'),
    'productos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', v.id, 'nombre', v.nombre, 'categoria', v.categoria, 'descripcion', v.descripcion,
        'variantes', coalesce((
          select jsonb_agg(jsonb_build_object('id', va.id, 'nombre', va.nombre, 'precio', va.precio) order by va.orden)
          from variantes va where va.producto_id = v.id
        ), '[]')
      ) order by v.creado_en)
      from visibles v
    ), '[]')
  );
$$;
revoke all on function carta_publica() from public;
grant execute on function carta_publica() to anon, authenticated;

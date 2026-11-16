-- Limpieza de los datos de prueba ANTES de entregarle el sistema a la dueña.
-- NO es una migración: se corre una sola vez, a mano, en el SQL Editor (como postgres, que puede borrar ventas).
-- Deja intactos: la dueña, categorías, turnos de referencia, salones, mesas y ajustes.

begin;

-- Todo lo que se vendió y movió en las pruebas (antes de entregar no hay ventas reales).
delete from ventas;
delete from cuentas;
delete from turnos;
delete from movimientos_stock;
delete from compras;
delete from intentos_ingreso;
delete from precios_anteriores;
alter sequence numero_venta restart with 1;

-- Productos, insumos y proveedores de prueba.
delete from productos where nombre ilike 'PRUEBA%';
delete from insumos where nombre ilike 'PRUEBA%';
delete from proveedores where nombre ilike 'PRUEBA%';

-- Empleadas de prueba: borrar la cuenta de Auth borra también su fila en usuarios (on delete cascade).
-- (Se reconocen por tener PRUEBA en el nombre o un usuario que empieza con "prueba".)
delete from auth.users where id in (
  select id from usuarios where rol = 'empleada' and (nombre ilike '%PRUEBA%' or usuario like 'prueba%')
);

-- Lo que quedó (debería ser solo la dueña y los datos iniciales).
select (select count(*) from usuarios) as usuarios, (select count(*) from productos) as productos,
       (select count(*) from insumos) as insumos, (select count(*) from ventas) as ventas,
       (select count(*) from mesas) as mesas;

commit;

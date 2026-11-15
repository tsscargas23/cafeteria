-- El stock tenía 3 decimales y cada café gasta 0,0125 kg: cada venta redondeaba y el error se acumulaba.
-- Se pasa a 4 decimales (alcanza para recetas en gramos y mililitros).
alter table insumos alter column stock type numeric(14, 4);
alter table insumos alter column minimo type numeric(14, 4);
alter table movimientos_stock alter column cantidad type numeric(14, 4);

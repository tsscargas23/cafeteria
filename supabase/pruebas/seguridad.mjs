// Prueba de seguridad de la base: aplica todas las migraciones en un Postgres en memoria (PGlite, sin Docker ni
// internet una vez instalado) con personas inventadas, e intenta lo que una empleada no debería poder hacer.
// Uso: cd supabase/pruebas && npm install && npm test

import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
const MIG = new URL('../migrations/', import.meta.url).pathname;
const db = new PGlite();
let ok = 0, mal = 0;
const check = (cond, msg) => { if (cond) { ok++; console.log('  OK  ', msg); } else { mal++; console.log('  FALLA', msg); } };
const q = async (sql, p) => (await db.query(sql, p)).rows;
const intenta = async (sql, p) => { try { await db.query(sql, p); return null; } catch (e) { return e.message; } };

await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  create publication supabase_realtime;
`);
for (const f of readdirSync(MIG).filter((x) => x.endsWith('.sql')).sort()) {
  let sql = readFileSync(MIG + f, 'utf8');
  sql = sql.replace('create extension if not exists pgcrypto;', '');
  if (f.startsWith('0008')) sql = sql.replace("notify pgrst, 'reload schema';", '');
  try { await db.exec(sql); } catch (e) { console.log('ERROR en', f, e.message, e.where ?? ''); process.exit(2); }
  console.log('aplicada', f);
  if (f.startsWith('0001')) await db.exec(`grant usage on schema public to anon, authenticated, service_role;`);
  await db.exec(`grant all on all tables in schema public to anon, authenticated, service_role; grant all on all sequences in schema public to anon, authenticated, service_role;`);
}
// Supabase da permisos por defecto en tablas nuevas; la 0008 revoca precios_anteriores después de crearla.
await db.exec(`revoke all on precios_anteriores from anon, authenticated;`);
// La 0002 dos veces (ya no revive email_para_ingresar)
const D = '00000000-0000-4000-8000-00000000000d', E = '00000000-0000-4000-8000-00000000000e', F = '00000000-0000-4000-8000-00000000000f';
await db.exec(`
  insert into auth.users values ('${D}','d@x.invalid'),('${E}','e@x.invalid'),('${F}','f@x.invalid');
  insert into usuarios (id,nombre,usuario,email,rol) values ('${D}','Dueña','duena','d@x.invalid','duena');
  insert into usuarios (id,nombre,usuario,email,rol,permisos) values ('${E}','Emp','emp','e@x.invalid','empleada','{"cobrar":true,"anular":true,"verReportes":false,"editarProductos":true}');
  insert into usuarios (id,nombre,usuario,email,rol) values ('${F}','Emp2','emp2','f@x.invalid','empleada');
  insert into insumos (id,nombre,unidad,stock) values ('11111111-1111-4111-8111-111111111111','Café','kg',10);
  insert into productos (id,nombre,categoria,es_cafe) values ('22222222-2222-4222-8222-222222222222','Café','Cafetería',true);
  insert into variantes (id,producto_id,nombre,precio,receta) values
    ('33333333-3333-4333-8333-333333333333','22222222-2222-4222-8222-222222222222','Chico',3000,'[{"insumoId":"11111111-1111-4111-8111-111111111111","cantidad":0.0125}]'),
    ('44444444-4444-4444-8444-444444444444','22222222-2222-4222-8222-222222222222','Grande',4000,'[]');
`);
const como = async (id) => { await db.exec(`reset role`); await db.query(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: id })]); await db.exec(`set role authenticated`); };
const admin = async () => { await db.exec(`reset role`); await db.query(`select set_config('request.jwt.claims', '', false)`); };

const P = '22222222-2222-4222-8222-222222222222', V = '33333333-3333-4333-8333-333333333333', I = '11111111-1111-4111-8111-111111111111';
const venta = (lineas, pagos, extra = {}) => JSON.stringify({ origen: 'mostrador', lineas, pagos, ...extra });
const linea = (precio, cantidad = 1, extra = {}) => ({ productoId: P, varianteId: V, nombre: 'Agua', variante: 'x', categoria: 'Otros', esCafe: false, precio, cantidad, ...extra });

console.log('\n== 0002 re-ejecutada no revive email_para_ingresar');
check((await q(`select count(*)::int n from pg_proc where proname='email_para_ingresar'`))[0].n === 0, 'email_para_ingresar no existe');

console.log('\n== Turnos');
await admin();
const T1 = '55555555-5555-4555-8555-555555555555';
await db.exec(`insert into turnos (id, cerrado_en, cerrado_por_id, arqueo) values ('${T1}', now(), '${D}', '{"contado":1000,"esperado":1000,"diferencia":0}');
  insert into ventas (origen, lineas, pagos, total, turno_id) values ('mostrador','[]','[]',0,'${T1}');`);
await como(E);
let r = await db.query(`update turnos set cerrado_en = null where id = '${T1}'`);
check(r.affectedRows === 0, 'empleada NO puede reabrir un turno cerrado');
check((await q(`select count(*)::int n from ventas where turno_id='${T1}'`))[0].n === 0, 'empleada NO ve ventas del turno cerrado');
r = await db.query(`update turnos set arqueo = '{"contado":0}' where id = '${T1}'`);
check(r.affectedRows === 0, 'empleada NO puede cambiar el arqueo de un turno cerrado');
let err = await intenta(`insert into turnos (id, abierto_por_id) values ('${T1}', '${E}') on conflict (id) do update set cerrado_en = null`);
check(err !== null, 'empleada NO puede reabrir por upsert: ' + err);
err = await intenta(`insert into turnos (abierto_por_id, cerrado_en) values ('${E}', now())`);
check(err !== null, 'empleada NO puede insertar un turno ya cerrado');
err = await intenta(`insert into turnos (abierto_por_id) values ('${D}')`);
check(err !== null, 'empleada NO puede abrir a nombre de otra persona');
const T2 = '66666666-6666-4666-8666-666666666666';
err = await intenta(`insert into turnos (id, abierto_por_id, efectivo_inicial) values ('${T2}', '${E}', 5000)`);
check(err === null, 'empleada abre su turno ' + (err ?? ''));
err = await intenta(`update turnos set movimientos = '[{"id":"m1","fecha":1,"tipo":"ingreso","monto":-5000,"motivo":"x"}]' where id='${T2}'`);
check(err !== null, 'movimiento con monto negativo rechazado');
err = await intenta(`update turnos set movimientos = '[{"id":"m1","fecha":1,"tipo":"egreso","monto":700,"motivo":"hielo"}]' where id='${T2}'`);
check(err === null, 'egreso válido aceptado ' + (err ?? ''));
err = await intenta(`update turnos set movimientos = '[]' where id='${T2}'`);
check(err !== null, 'empleada NO puede borrar un movimiento ya anotado');
await db.exec(`update turnos set efectivo_inicial = 999999 where id='${T2}'`);
check((await q(`select efectivo_inicial from turnos where id='${T2}'`))[0].efectivo_inicial === 5000, 'empleada NO puede cambiar el cambio inicial');

console.log('\n== Precios y pagos (registrar_venta)');
err = await intenta(`select * from registrar_venta($1)`, [venta([linea(1)], [{ medio: 'efectivo', monto: 1, quien: '' }])]);
check(err && /no coincide con la carta/.test(err), 'precio $1 en vez de $3000 rechazado: ' + err);
err = await intenta(`select * from registrar_venta($1)`, [venta([linea(3000)], [{ medio: 'efectivo', monto: -5000 }, { medio: 'efectivo', monto: 8000 }])]);
check(err && /pago inválido/.test(err), 'pago negativo rechazado: ' + err);
err = await intenta(`select * from registrar_venta($1)`, [venta([linea(3000)], [{ medio: 'x', monto: 3000 }])]);
check(err && /pago inválido/.test(err), 'medio desconocido rechazado: ' + err);
err = await intenta(`select * from registrar_venta($1)`, [venta([linea(3000)], [{ medio: 'efectivo', monto: 2999.5 }, { medio: 'efectivo', monto: 0.5 }])]);
check(err && /pago inválido/.test(err), 'monto con decimales rechazado');
err = await intenta(`select * from registrar_venta($1)`, [venta([linea(3000, 2)], [{ medio: 'efectivo', monto: 4000 }, { medio: 'debito', monto: 2000, quien: 'Ana' }, { medio: 'transferencia', monto: 0 }])]);
check(err === null, 'venta correcta aceptada ' + (err ?? ''));
const v1 = (await q(`select * from ventas where turno_id='${T2}' order by numero desc limit 1`))[0];
check(v1 && v1.lineas[0].nombre === 'Café' && v1.lineas[0].categoria === 'Cafetería' && v1.lineas[0].variante === 'Chico' && v1.lineas[0].esCafe === true, 'nombre/categoría/tamaño salen del catálogo, no del navegador');
check(v1 && v1.pagos.length === 2 && v1.total === 6000, 'pagos rearmados (sin el de $0), total 6000');
check(Number((await q(`select stock from insumos where id='${I}'`))[0].stock) === 9.975, 'stock descontado 2 x 0,0125');

console.log('\n== Cambio de precio con mesa abierta');
await como(D);
await db.exec(`update variantes set precio = 3500 where id='${V}'`);
await como(E);
err = await intenta(`select * from registrar_venta($1)`, [venta([linea(3000)], [{ medio: 'efectivo', monto: 3000 }])]);
check(err === null, 'precio anterior (cambió hace instantes) aceptado ' + (err ?? ''));
err = await intenta(`select * from registrar_venta($1)`, [venta([linea(3500)], [{ medio: 'efectivo', monto: 3500 }])]);
check(err === null, 'precio nuevo aceptado ' + (err ?? ''));
err = await intenta(`select * from registrar_venta($1)`, [venta([linea(2000)], [{ medio: 'efectivo', monto: 2000 }])]);
check(err !== null, 'precio inventado sigue rechazado');
check((await q(`select count(*)::int n from precios_anteriores`).catch(() => [{ n: -1 }]))[0].n === -1, 'empleada NO puede leer precios_anteriores');

console.log('\n== Recetas');
err = await intenta(`update variantes set receta = '[{"insumoId":"${I}","cantidad":-500}]' where id='${V}'`);
check(err !== null, 'empleada con editarProductos NO pone receta negativa: ' + err);
err = await intenta(`update variantes set receta = '[{"insumoId":"${I}","cantidad":0.5}]' where id='${V}'`);
check(err && /Solo la dueña/.test(err), 'empleada con editarProductos NO cambia recetas (ni válidas): ' + err);
err = await intenta(`update variantes set precio = 3600 where id='${V}'`);
check(err === null, 'empleada con editarProductos SÍ cambia precios ' + (err ?? ''));
await como(D);
err = await intenta(`update variantes set receta = '[{"insumoId":"${I}","cantidad":-500}]' where id='${V}'`);
check(err && /inválida/.test(err), 'receta con cantidad negativa rechazada (incluso a la dueña)');
err = await intenta(`update variantes set receta = '[{"insumoId":"${I}","cantidad":0.02}]' where id='${V}'`);
check(err === null, 'dueña cambia la receta válida ' + (err ?? ''));

console.log('\n== Anular devuelve lo que se descontó');
await como(E);
const antes = Number((await q(`select stock from insumos where id='${I}'`))[0].stock);
await como(D); await db.exec(`update variantes set receta = '[{"insumoId":"${I}","cantidad":5}]' where id='${V}'`); await como(E);
await db.query(`select * from anular_venta($1, 'prueba')`, [v1.id]);
check(Number((await q(`select stock from insumos where id='${I}'`))[0].stock) === antes + 0.025, 'anulación devolvió 0,025 (lo descontado), no 10 (receta de hoy)');

console.log('\n== Mesa cobrada dos veces');
const C = '77777777-7777-4777-8777-777777777777';
await admin(); await db.exec(`insert into salones (id,nombre) values ('88888888-8888-4888-8888-888888888888','A'); insert into mesas (id,salon_id,nombre,forma) values ('99999999-9999-4999-8999-999999999999','88888888-8888-4888-8888-888888888888','1','cuadrada'); insert into cuentas (id,mesa_id) values ('${C}','99999999-9999-4999-8999-999999999999');`);
await como(E);
err = await intenta(`select * from registrar_venta($1)`, [venta([linea(3600)], [{ medio: 'efectivo', monto: 3600 }], { origen: 'mesa', mesa: '1', cuentaId: C })]);
check(err === null, 'primer cobro de la mesa ' + (err ?? ''));
err = await intenta(`select * from registrar_venta($1)`, [venta([linea(3600)], [{ medio: 'efectivo', monto: 3600 }], { origen: 'mesa', mesa: '1', cuentaId: C })]);
check(err && /ya se cobró/.test(err), 'segundo cobro de la misma mesa rechazado');

console.log('\n== Cierre de caja: el esperado lo calcula la base');
// Como lo manda la app (remoto.ts): la fila completa por update. Antes iba por upsert y la base lo rechazaba.
await como(F);
const fila = (await q(`select * from turnos where id='${T2}'`))[0];
const movs = [...fila.movimientos, { id: 'm2', fecha: 2, tipo: 'ingreso', monto: 300, motivo: 'otra empleada' }];
err = await intenta(`update turnos set movimientos = $1 where id = '${T2}'`, [JSON.stringify(movs)]);
check(err === null, 'otra empleada anota un ingreso en la caja abierta ' + (err ?? ''));
err = await intenta(`insert into turnos (id, abierto_en, abierto_por_id, cerrado_en, arqueo) values ('${T2}', now(), '${E}', now(), '{}') on conflict (id) do update set cerrado_en = excluded.cerrado_en`);
check(err !== null, '(el upsert de antes sí falla: por eso la app ahora usa update)');
await como(E);
r = await db.query(`update turnos set def_id = null, abierto_en = $1, cerrado_en = now(), abierto_por_id = '${E}', cerrado_por_id = '${D}', empleada_ids = '{}', efectivo_inicial = 5000, billetes_inicial = null, movimientos = $2, arqueo = '{"contado":100,"esperado":100,"diferencia":0,"nota":""}' where id = '${T2}' returning id`, [fila.abierto_en, JSON.stringify(movs)]);
check(r.rows.length === 1, 'la empleada cierra la caja con la fila completa (como la app)');
const t2 = (await q(`select * from turnos where id='${T2}'`))[0];
// 5000 inicial + efectivo (4000 anulada no cuenta, 3000, 3500, 3600) - 700 egreso + 300 ingreso = 14700
check(t2.cerrado_en !== null && t2.arqueo.esperado === 14700 && t2.arqueo.diferencia === 100 - 14700, `esperado=${t2.arqueo.esperado} diferencia=${t2.arqueo.diferencia} (lo calcula la base)`);
check(t2.cerrado_por_id === E, 'quién cerró = la empleada que cerró, no lo que mandó');
err = await intenta(`select * from anular_venta($1, 'x')`, [v1.id]);
const vT2 = (await q(`select id from ventas where turno_id='${T2}' and anulada is null limit 1`));
await como(E);
err = vT2.length ? await intenta(`select * from anular_venta($1, 'x')`, [vT2[0].id]) : 'sin datos';
await como(E);
check((await q(`select count(*)::int n from ventas`))[0].n === 0, 'con la caja cerrada, la empleada ya no ve las ventas');
await como(D);
const vT2b = (await q(`select id from ventas where turno_id='${T2}' and anulada is null limit 1`));
await como(E);
err = await intenta(`select * from anular_venta($1, 'x')`, [vT2b[0].id]);
check(err && /Solo la dueña/.test(err), 'empleada NO anula ventas de un turno cerrado');
await como(D);
r = await db.query(`update turnos set arqueo = arqueo || '{"nota":"revisado"}' where id='${T2}'`);
check(r.affectedRows === 1, 'la dueña sí puede corregir un turno cerrado');

console.log('\n== Bloqueo de intentos');
await db.exec(`reset role`); await db.exec(`set role service_role`);
const ids = [];
for (let i = 0; i < 7; i++) ids.push((await q(`select reservar_intento('emp', 5, 15) id`))[0].id);
check(ids.slice(0, 5).every((x) => x !== null) && ids[5] === null && ids[6] === null, 'reserva 5 intentos y corta en el 6º: ' + JSON.stringify(ids));
await db.exec(`reset role`); await db.exec(`set role authenticated`);
err = await intenta(`select reservar_intento('emp', 999, 15)`);
check(err && /permission denied/.test(err), 'una sesión normal NO puede llamar reservar_intento');
await db.exec(`reset role`); await db.exec(`set role anon`);
err = await intenta(`select reservar_intento('emp', 999, 15)`);
check(err && /permission denied/.test(err), 'sin sesión tampoco');

console.log(`\nResultado: ${ok} OK, ${mal} fallas`);
process.exit(mal ? 1 : 0);

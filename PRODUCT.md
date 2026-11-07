# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Angular (mismo framework que Tss Cargas). La demo usa datos simulados (`mock-api`) detrás de una interfaz de API; el sistema
real se conecta después a Supabase (PostgreSQL, login, fotos, tiempo real) y se publica en Cloudflare Pages. Ver
`~/biblioteca/cafeteria-plan.md`.

## Users

- **La dueña** de una cafetería de barrio en Argentina que también vende tortas y facturas y en verano quiere funcionar como
  bar. Administra todo: productos, inventario, proveedores, empleadas, turnos, caja y números del mes. Hoy usa un software que
  no le sirve; probó Fudo un mes y le gustó.
- **Las empleadas** (mozas y caja): atienden unas 12 mesas (6 adentro, 4 o más afuera), cargan consumos, cobran y cierran caja,
  muchas veces con el local lleno y apuradas.

## Product Purpose

Un sistema de gestión gastronómica parecido a Fudo, hecho a medida y con pago único (sin abono mensual), que sea simple,
intuitivo y que le sirva. Éxito: que cada venta se cargue sin esfuerzo, que cobrar una mesa dividida no sea engorroso y que
los números del mes cierren y se puedan filtrar por producto.

## Positioning

Lo que ni su sistema actual ni Fudo resuelven bien para ella: reportes que siempre cierran con filtro por producto y tamaño
(Fudo obliga a exportar a Excel), cuentas por persona en la mesa desde el principio (Fudo divide por producto y "separar venta"
no anda en el celular), turnos que no cortan a una hora fija, productos que se editan sin borrarlos, y compras de proveedores
que suman solas al inventario. Todo sin abono.

## Operating Context

- **Dispositivo principal: una notebook de unos 8 GB de RAM en la caja** (mouse o touchpad, pantalla chica de notebook). Las
  mozas pueden usar su celular para cargar en la mesa. Tiene que andar liviano.
- Por ahora no tiene impresora; se le sugirió una térmica USB conectada a la notebook.
- No factura electrónicamente (a confirmar). Ticket "no válido como factura".
- Café por tamaño: jarrita, chico, mediano, grande. Cálculo de 80 cafés por kilo.
- Turnos: los crea ella, con horario de referencia; el turno dura hasta que se cierra la caja.
- Carta con QR en las mesas.

## Capabilities and Constraints

Confirmado para la demo: mesas con plano de arrastrar y soltar (mesas simples, dobles, salones adentro/afuera/barra), personas
por mesa y cobro (uno paga todo, cada uno lo suyo, elegir productos, partes iguales); mostrador; productos e insumos editables
con filtros e importación desde Excel; proveedores con compras que suman al stock; turnos y caja con arqueo; reportes con
filtros combinables (producto, tamaño, empleada, turno, medio de pago, período); cuentas de dueña y empleadas con contraseña y
perfil; tickets; carta QR; copia de seguridad.

Restricciones: pago único y sin mantenimiento del desarrollador; servicios gratis o muy baratos a nombre de la clienta; pocas
integraciones externas. Fuera de alcance: facturación ARCA, apps de delivery, terminal de cobro integrada.

Indefinido: nombre de la cafetería, identidad visual, si sigue la tienda online de tortas.

## Brand Commitments

- **Estilo visual: el estándar de la categoría, hecho con todo cuidado** (elegido el 2026-11-06 frente a direcciones más
  propias). Referencia y nivel de terminación: Fudo, que la clienta usó y le gustó. Blanco, barra lateral, un color de acento,
  tablas y tarjetas claras. Sin guiños ni ornamentos de "mundo".
- El nombre de la cafetería está pendiente; la demo usa "Café La Esquina" como nombre de ejemplo, editable en Ajustes.
- Textos en español rioplatense con voseo, simples y directos.

## Evidence on Hand

Ninguna. No hay fotos, logo, productos reales ni datos de ventas. Los datos de la demo son de ejemplo y deben verse como tales;
no inventar testimonios ni cifras presentadas como reales.

## Product Principles

1. **Cargar una venta tiene que ser más rápido que no cargarla.** Pocos toques, cero pasos obligatorios innecesarios.
2. **Los números cierran siempre.** Todo total es la suma visible de lo que se lista; nada se borra, se anula con motivo.
3. **Nada fijo que ella no pueda cambiar:** productos, turnos, mesas y precios se editan en el lugar.
4. **Simple antes que completo.** Si una función agrega pasos a la moza, es opcional.

## Accessibility & Inclusion

Textos simples, contraste AA o mejor, estados con ícono y palabra (nunca solo color), objetivos táctiles amplios para el uso en
celular, y que funcione bien en una notebook de pantalla chica.

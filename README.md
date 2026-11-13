# Sistema para la cafetería (demo)

Panel de gestión tipo Fudo: mesas con plano para arrastrar, cuentas por persona, mostrador, turnos y caja, productos,
inventario, proveedores, reportes con filtros, empleadas y carta QR. Plan completo en `~/biblioteca/cafeteria-plan.md`.

**Estado (2026-11-06): demo navegable.** Funciona entera en el navegador con datos de ejemplo (70 días de ventas
inventadas). Lo que se carga se guarda solo en ese navegador. Todavía no hay base de datos real (Supabase va después).

## Abrirla

Hay tres formas, de la más fácil a la de programar:

1. **Link de internet (GitHub Pages):** https://tsscargas23.github.io/cafeteria/ — se actualiza solo cada vez que se sube
   un cambio a `main`. Sirve para mandársela a la clienta y abrirla en la notebook o el celular. Desde Chrome se puede
   "Instalar" o crear un acceso directo para que quede como una app más.
2. **Archivo único con doble clic:** https://tsscargas23.github.io/cafeteria/cafeteria-demo.html (o `npm run demo:html`,
   que lo genera en `frontend/dist/cafeteria-demo.html`). Es un solo archivo de ~1 MB: se puede pasar por WhatsApp o
   pendrive y se abre con Chrome sin servidor ni internet.
3. **Para programar:** `cd frontend && npm install --legacy-peer-deps && npm start` (http://localhost:4200).
   El `--legacy-peer-deps` evita un error de npm 10 con jsdom.

Cuentas de ejemplo: dueña `claudia` / `cafe1234`, empleada `lucia` / `lucia123`.
En la pantalla de entrada hay botones para entrar directo. En **Ajustes → Reiniciar la demo** vuelve todo al principio.
Lo que se carga queda guardado solo en ese navegador.

## Cómo está armado

```
frontend/src/app/
  core/modelos.ts     tipos (Producto, Mesa, Cuenta, Venta, Turno...)
  core/reglas.ts      reglas de negocio puras y con tests: cobro por persona, partes iguales, caja, reportes, importación
  core/tienda.ts      estado de la demo (en el sistema real se reemplaza por Supabase; las pantallas no cambian)
  core/datos-demo.ts  datos de ejemplo
  layout/shell.ts     barra lateral y barra superior
  pages/              una pantalla por archivo; pages/mesas/ es el plano y el panel de cuenta
  shared/             ticket imprimible, gráfico por día, filtro de selección múltiple
```

Cuentas que abre la clienta para el sistema real: `docs/CUENTAS.md`.

Tests: `npx ng test --watch=false`. Diseño: `PRODUCT.md` y `DESIGN.md` (estilo estándar tipo Fudo, elegido con la clienta en mente).

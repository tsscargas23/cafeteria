# Design

Estilo: **el estándar de la categoría (tipo Fudo), ejecutado con cuidado.** Modo Operate: la usuaria tiene que saber dónde está
todo antes de notar el diseño.

## Escena
Notebook de unos 8 GB en la caja de una cafetería de barrio, de día, con luz natural y el local lleno. Por eso: **tema claro**,
contraste alto, nada pesado de cargar (fuente del sistema, sin imágenes grandes).

## Color (estrategia: restringida)
- Fondo blanco `--bg #FFFFFF` (pedido de la clienta, 2026-11-12); los paneles se separan por borde `--border #E3E6EB`
  y la barra lateral lleva un blanco apenas cálido `#FCFAF9`.
- Texto `--text #111827`, secundario `--text-2 #4B5563`, terciario `--text-3 #6B7280` (≥ 4.5:1 sobre blanco).
- **Acento de marca Panacota `--accent #EAA994`** (hover `#E39A82`, suave `#FBEEE9`). Es un color claro (2:1 sobre
  blanco), así que: los botones primarios llevan **texto oscuro** `--accent-ink #2B1A14` (8:1), y para enlaces, estados
  activos, bordes y foco se usa su versión oscura `--accent-text #A8492F` (5.7:1 sobre blanco). Nunca texto blanco ni
  texto del acento claro sobre blanco.
- Estados (siempre con ícono y palabra): ok `#15803D`, atención `#B45309`, error `#B91C1C`, cada uno con su fondo suave.
- Mesas: Libre (blanco), Ocupada (azul suave + borde azul), Pidió la cuenta (ámbar suave + borde ámbar).
- Gráficos: una serie = terracota `--series-1 #C4674F`.

## Tipografía
Fuente del sistema (Segoe UI en Windows, San Francisco en Mac). Base 15 px. Escala 13 / 14 / 15 / 17 / 20 / 26.
Números de dinero y cantidades con cifras tabulares.

## Forma
Radios 8 px (controles) y 12 px (paneles). Sombras suaves con desplazamiento solo en paneles flotantes. Íconos Lucide,
trazo 2, 18 px. Botones de al menos 40 px de alto (44 en la pantalla de mesas).

## Estructura
Barra lateral blanca con las secciones (se achica a íconos en pantallas chicas), barra superior con el turno abierto y la
usuaria, contenido a la derecha. Detalles y ediciones en un panel lateral, no en ventanas modales, salvo confirmaciones.

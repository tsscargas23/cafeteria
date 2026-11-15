import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { Avisos } from '../../core/avisos';
import { duracion, hora, plata } from '../../core/formato';
import {
  ArrowRightLeft, Check, ChevronLeft, CircleCheck, Hand, Minus, Pencil, Plus, Printer, Receipt, Search, UserPlus, X,
} from '../../core/iconos';
import { ItemCuenta, MEDIOS_PAGO, MedioPago, Mesa, ModoCobro, Producto, Venta } from '../../core/modelos';
import {
  aPagarPersona, compartidoRestante, itemsDePersona, pagadoCuenta, partesIguales, pendienteCuenta, personasSinPagar, totalCuenta, totalItems, vuelto,
} from '../../core/reglas';
import { Tienda } from '../../core/tienda';
import { Impresion } from '../../shared/ticket';

type Vista = 'cuenta' | 'agregar' | 'cobrar' | 'mover' | 'cobrada';

@Component({
  selector: 'app-cuenta-panel',
  imports: [FormsModule, LucideAngularModule],
  styleUrl: './cuenta-panel.scss',
  template: `
    <header class="cab">
      @if (vista() !== 'cuenta' && vista() !== 'cobrada' && cuenta()) {
        <button class="btn icono fantasma" (click)="vista.set('cuenta')" aria-label="Volver a la cuenta"><lucide-icon [img]="iAtras" [size]="20" /></button>
      }
      <div class="titulo">
        <h2>Mesa {{ mesa().nombre }}</h2>
        @if (cuenta(); as c) {
          <small>{{ c.personas.length }} {{ c.personas.length === 1 ? 'persona' : 'personas' }} · desde {{ hora(c.abiertaEn) }} ({{ duracion(c.abiertaEn) }}) · {{ tienda.nombreUsuario(c.atiendeId) }}</small>
        } @else if (vista() !== 'cobrada') {
          <small>Libre</small>
        }
      </div>
      <button class="btn icono fantasma" (click)="cerrar.emit()" aria-label="Cerrar panel"><lucide-icon [img]="iX" [size]="20" /></button>
    </header>

    @if (vista() === 'cobrada') {
      <div class="cuerpo centrado">
        <lucide-icon [img]="iOk" [size]="44" class="ok-grande" />
        <h2>Mesa {{ mesa().nombre }} cobrada</h2>
        <p class="sec">Venta #{{ ultimaVenta()?.numero }} · {{ plata(ultimaVenta()?.total ?? 0) }}</p>
        <div class="fila" style="justify-content:center">
          <button class="btn" (click)="imprimirVenta()"><lucide-icon [img]="iImprimir" [size]="18" />Imprimir ticket</button>
          <button class="btn primario" (click)="cerrar.emit()">Listo</button>
        </div>
      </div>
    } @else if (!cuenta()) {
      <!-- Mesa libre: abrir -->
      <div class="cuerpo">
        @if (!tienda.turnoAbierto()) {
          <p class="aviso-linea atencion"><lucide-icon [img]="iMano" [size]="16" />La caja está cerrada. Abrila en «Caja» para cargar consumos.</p>
        }
        <h3>¿Cuántos se sientan?</h3>
        <div class="cantidades">
          @for (n of [1, 2, 3, 4, 5, 6, 7, 8]; track n) {
            <button class="btn grande" [disabled]="!tienda.turnoAbierto()" (click)="abrir(n)">{{ n }}</button>
          }
        </div>
        <p class="ter">Se crean «Persona 1, Persona 2...». Les podés poner nombre después, y si se suma alguien lo agregás con un toque.</p>
      </div>
    } @else {
      @let c = cuenta()!;
      @switch (vista()) {
        @case ('cuenta') {
          <div class="personas">
            <button class="chip" [class.activo]="destino() === null" (click)="destino.set(null)">Toda la mesa</button>
            @for (p of c.personas; track p.id) {
              <button class="chip" [class.activo]="destino() === p.id" (click)="destino.set(p.id)" (dblclick)="renombrar(p.id, p.nombre)">
                {{ p.nombre }}
                @if (subtotal(p.id); as s) { <span class="sub">{{ plata(s) }}</span> }
                @if (pagoPersona(p.id)) { <lucide-icon [img]="iCheck" [size]="13" /> }
              </button>
            }
            <button class="chip" (click)="sumarPersona()"><lucide-icon [img]="iSumar" [size]="15" />Se sumó alguien</button>
          </div>
          <div class="sub-barra">
            <div class="segmentos">
              <button class="btn chico" [class.activo]="agrupar() === 'todo'" (click)="agrupar.set('todo')">Todo junto</button>
              <button class="btn chico" [class.activo]="agrupar() === 'persona'" (click)="agrupar.set('persona')">Por persona</button>
            </div>
            @if (destino(); as d) {
              <button class="btn chico fantasma" (click)="renombrar(d, nombrePersona(d))"><lucide-icon [img]="iEditar" [size]="14" />Ponerle nombre</button>
            }
          </div>

          <div class="cuerpo lista">
            @if (c.items.length === 0) {
              <div class="vacio"><h3>Todavía no pidieron nada</h3><p>Tocá «Agregar» y elegí los productos.</p></div>
            } @else if (agrupar() === 'todo') {
              @for (i of itemsOrdenados(); track i.id) {
                <div class="item" [class.pagado]="i.pagado">
                  @if (!i.pagado) {
                    <span class="cantidad">
                      <button class="btn icono chico" (click)="tienda.cambiarCantidad(c.id, i.id, -1)" [attr.aria-label]="'Uno menos de ' + i.nombre"><lucide-icon [img]="iMenos" [size]="14" /></button>
                      <b class="num">{{ i.cantidad }}</b>
                      <button class="btn icono chico" (click)="tienda.cambiarCantidad(c.id, i.id, 1)" [attr.aria-label]="'Uno más de ' + i.nombre"><lucide-icon [img]="iMas" [size]="14" /></button>
                    </span>
                  } @else {
                    <span class="cantidad"><b class="num">{{ i.cantidad }}</b></span>
                  }
                  <span class="nombre">{{ i.nombre }}
                    @if (i.pagado) { <span class="etiqueta ok">Pagado</span> }
                  </span>
                  @if (!i.pagado) {
                    <select class="input chico de-quien" [ngModel]="i.personaId ?? ''" (ngModelChange)="tienda.asignarItem(c.id, i.id, $event || null)" [attr.aria-label]="'De quién es ' + i.nombre">
                      <option value="">Toda la mesa</option>
                      @for (p of c.personas; track p.id) { <option [value]="p.id">{{ p.nombre }}</option> }
                    </select>
                  } @else {
                    <span class="de-quien ter">{{ i.personaId ? nombrePersona(i.personaId) : 'Toda la mesa' }}</span>
                  }
                  <span class="num importe">{{ plata(i.precio * i.cantidad) }}</span>
                </div>
              }
            } @else {
              @for (g of grupos(); track g.id) {
                @if (g.items.length) {
                  <div class="grupo">
                    <div class="grupo-cab"><b>{{ g.nombre }}</b><span class="num">{{ plata(g.total) }}</span></div>
                    @for (i of g.items; track i.id) {
                      <div class="item compacto" [class.pagado]="i.pagado">
                        <span class="num cant">{{ i.cantidad }} ×</span>
                        <span class="nombre">{{ i.nombre }} @if (i.pagado) { <span class="etiqueta ok">Pagado</span> }</span>
                        <span class="num importe">{{ plata(i.precio * i.cantidad) }}</span>
                      </div>
                    }
                  </div>
                }
              }
            }
          </div>

          <footer class="pie">
            <div class="totales">
              @if (pagado()) {
                <span class="sec">Total {{ plata(total()) }} · Pagado {{ plata(pagado()) }}</span>
                <span class="grande-total"><small>Falta</small>{{ plata(pendiente()) }}</span>
              } @else {
                <span class="grande-total"><small>Total</small>{{ plata(total()) }}</span>
              }
            </div>
            <div class="acciones-pie">
              <button class="btn grande" (click)="vista.set('agregar')" [disabled]="!tienda.turnoAbierto()"><lucide-icon [img]="iMas" [size]="20" />Agregar</button>
              <button class="btn primario grande" (click)="irACobrar()" [disabled]="!pendiente() || !puedeCobrar()"><lucide-icon [img]="iRecibo" [size]="20" />Cobrar</button>
            </div>
            <div class="acciones-sec">
              <button class="btn chico fantasma" (click)="tienda.marcarPidioCuenta(c.id, !c.pidioCuenta)"><lucide-icon [img]="iMano" [size]="15" />{{ c.pidioCuenta ? 'Ya no pidió la cuenta' : 'Pidió la cuenta' }}</button>
              <button class="btn chico fantasma" (click)="precuenta()" [disabled]="!c.items.length"><lucide-icon [img]="iImprimir" [size]="15" />Precuenta</button>
              <button class="btn chico fantasma" (click)="vista.set('mover')"><lucide-icon [img]="iMover" [size]="15" />Mover</button>
              @if (!c.items.length && !c.pagos.length) {
                <button class="btn chico fantasma" (click)="liberar()"><lucide-icon [img]="iX" [size]="15" />Liberar mesa</button>
              }
            </div>
          </footer>
        }

        @case ('agregar') {
          <div class="agregar-cab">
            <div class="destino">
              <span class="ter">Se carga a:</span>
              <select class="input chico" [ngModel]="destino() ?? ''" (ngModelChange)="destino.set($event || null)">
                <option value="">Toda la mesa</option>
                @for (p of c.personas; track p.id) { <option [value]="p.id">{{ p.nombre }}</option> }
              </select>
            </div>
            <label class="buscador">
              <lucide-icon [img]="iBuscar" [size]="17" />
              <input class="input" placeholder="Buscar producto" [ngModel]="busqueda()" (ngModelChange)="busqueda.set($event)" />
            </label>
            <div class="categorias">
              <button class="chip" [class.activo]="categoria() === null" (click)="categoria.set(null)">Todo</button>
              @for (cat of categorias(); track cat) {
                <button class="chip" [class.activo]="categoria() === cat" (click)="categoria.set(cat)">{{ cat }}</button>
              }
            </div>
          </div>
          <div class="cuerpo productos">
            @for (p of productosFiltrados(); track p.id) {
              @if (p.variantes.length === 1) {
                <button class="producto" (click)="agregarProducto(p, p.variantes[0].id)">
                  <span>{{ p.nombre }}</span><small class="num">{{ plata(p.variantes[0].precio) }}</small>
                  @if (agregados()[p.id + ':' + p.variantes[0].id]; as n) { <span class="contador num">+{{ n }}</span> }
                </button>
              } @else {
                <div class="producto con-tamanos">
                  <span>{{ p.nombre }}</span>
                  <div class="tamanos">
                    @for (v of p.variantes; track v.id) {
                      <button class="btn chico" (click)="agregarProducto(p, v.id)">
                        {{ v.nombre }} <small class="num">{{ plata(v.precio) }}</small>
                        @if (agregados()[p.id + ':' + v.id]; as n) { <span class="contador num">+{{ n }}</span> }
                      </button>
                    }
                  </div>
                </div>
              }
            } @empty {
              <p class="sec">No hay productos con ese nombre.</p>
            }
          </div>
          <footer class="pie">
            <div class="totales"><span class="grande-total"><small>Total de la mesa</small>{{ plata(total()) }}</span></div>
            <button class="btn primario grande bloque" (click)="volverACuenta()"><lucide-icon [img]="iCheck" [size]="20" />Listo</button>
          </footer>
        }

        @case ('cobrar') {
          <div class="modos" role="tablist">
            @for (m of modos; track m.id) {
              <button role="tab" [class.activo]="modo() === m.id" (click)="elegirModo(m.id)" [disabled]="m.id === 'productos' && !itemsSinPagar().length">
                <b>{{ m.nombre }}</b><small>{{ m.ayuda }}</small>
              </button>
            }
          </div>

          <div class="cuerpo cobro">
            @switch (modo()) {
              @case ('todo') {
                <p class="sec">Se cobra todo lo que falta de la mesa.</p>
                <label class="campo"><span>¿Quién paga? (opcional)</span>
                  <select class="input" [(ngModel)]="quienPaga">
                    <option value="">Sin anotar</option>
                    @for (p of c.personas; track p.id) { <option [value]="p.id">{{ p.nombre }}</option> }
                  </select>
                </label>
              }
              @case ('persona') {
                <label class="interruptor"><input type="checkbox" [ngModel]="repartir()" (ngModelChange)="repartir.set($event)" />Repartir lo de «Toda la mesa» entre los que faltan ({{ plata(compartido()) }})</label>
                <div class="lista-personas">
                  @for (p of c.personas; track p.id) {
                    @let monto = aPagar(p.id);
                    <button class="persona-cobro" [class.activo]="personaCobro() === p.id" [disabled]="!!pagoPersona(p.id) || !monto.total" (click)="personaCobro.set(p.id)">
                      <span class="nombre"><b>{{ p.nombre }}</b>
                        <small>{{ pagoPersona(p.id) ? 'Ya pagó' : 'Lo suyo ' + plata(monto.propio) + (monto.compartido ? ' + compartido ' + plata(monto.compartido) : '') }}</small>
                      </span>
                      <span class="num">{{ pagoPersona(p.id) ? plata(pagoPersona(p.id)!) : plata(monto.total) }}</span>
                    </button>
                  }
                </div>
                @if (!repartir() && compartido() > 0) {
                  <p class="aviso-linea"><lucide-icon [img]="iMano" [size]="16" />Quedan {{ plata(compartido()) }} de «Toda la mesa». Cobralos al final con «Uno paga todo».</p>
                }
              }
              @case ('productos') {
                <p class="sec">Tildá lo que paga esta persona.</p>
                <div class="lista-elegir">
                  @for (i of itemsSinPagar(); track i.id) {
                    <div class="elegir" [class.activo]="(seleccion()[i.id] || 0) > 0">
                      <label class="check"><input type="checkbox" [checked]="(seleccion()[i.id] || 0) > 0" (change)="tildar(i, $any($event.target).checked)" />
                        <span>{{ i.nombre }} <small class="ter">{{ i.personaId ? nombrePersona(i.personaId) : 'Toda la mesa' }}</small></span>
                      </label>
                      @if (i.cantidad > 1 && (seleccion()[i.id] || 0) > 0) {
                        <span class="cantidad">
                          <button class="btn icono chico" (click)="cambiarSeleccion(i, -1)" aria-label="Uno menos"><lucide-icon [img]="iMenos" [size]="14" /></button>
                          <b class="num">{{ seleccion()[i.id] }}/{{ i.cantidad }}</b>
                          <button class="btn icono chico" (click)="cambiarSeleccion(i, 1)" aria-label="Uno más"><lucide-icon [img]="iMas" [size]="14" /></button>
                        </span>
                      } @else {
                        <span class="ter num">{{ i.cantidad }} ×</span>
                      }
                      <span class="num">{{ plata(i.precio * (seleccion()[i.id] || i.cantidad)) }}</span>
                    </div>
                  }
                </div>
                <label class="campo"><span>¿Quién paga? (opcional)</span>
                  <select class="input" [(ngModel)]="quienPaga">
                    <option value="">Sin anotar</option>
                    @for (p of c.personas; track p.id) { <option [value]="p.id">{{ p.nombre }}</option> }
                  </select>
                </label>
              }
              @case ('partes') {
                <div class="fila">
                  <span class="campo"><span>¿En cuántas partes?</span></span>
                  <span class="cantidad">
                    <button class="btn icono" (click)="partes.set(max(2, partes() - 1))" aria-label="Una parte menos"><lucide-icon [img]="iMenos" [size]="16" /></button>
                    <b class="num" style="min-width:28px;text-align:center;font-size:20px">{{ partes() }}</b>
                    <button class="btn icono" (click)="partes.set(partes() + 1)" aria-label="Una parte más"><lucide-icon [img]="iMas" [size]="16" /></button>
                  </span>
                </div>
                <p class="sec">Falta {{ plata(pendiente()) }} → cada parte paga <b>{{ plata(montoParte()) }}</b>. Cobrás una parte por vez.</p>
              }
            }

            <div class="separador"></div>
            <span class="campo"><span>¿Cómo paga?</span></span>
            <div class="segmentos medios">
              @for (m of medios(); track m.id) {
                <button [class.activo]="medio() === m.id" (click)="medio.set(m.id)">{{ m.nombre }}</button>
              }
            </div>
            @if (medio() === 'efectivo') {
              <div class="grilla-2">
                <label class="campo"><span>Con cuánto paga</span>
                  <span class="input-plata"><input class="input" type="number" min="0" step="100" [(ngModel)]="recibido" placeholder="{{ montoACobrar() }}" /></span>
                </label>
                <div class="campo"><span>Vuelto</span><b class="vuelto num">{{ plata(vuelto(recibido || 0, montoACobrar())) }}</b></div>
              </div>
            }
            @if (medio() === 'transferencia' || medio() === 'mercadopago') {
              <p class="aviso-linea info"><lucide-icon [img]="iRecibo" [size]="16" />Alias: <b>{{ tienda.estado().ajustes.alias }}</b>. Confirmá que llegó antes de cobrar.</p>
            }
          </div>

          <footer class="pie">
            <div class="totales">
              <span class="sec">Falta en la mesa {{ plata(pendiente()) }}</span>
              <span class="grande-total"><small>A cobrar</small>{{ plata(montoACobrar()) }}</span>
            </div>
            <button class="btn primario grande bloque" [disabled]="cobrando() || !montoACobrar() || (medio() === 'efectivo' && !!recibido && recibido < montoACobrar())" (click)="confirmarCobro()">
              <lucide-icon [img]="iCheck" [size]="20" />{{ cobrando() ? 'Cobrando…' : 'Cobrar ' + plata(montoACobrar()) }}
            </button>
          </footer>
        }

        @case ('mover') {
          <div class="cuerpo">
            <h3>¿A qué mesa la pasás?</h3>
            <p class="sec">Se mueve todo: personas, consumo y pagos.</p>
            @for (s of tienda.estado().salones; track s.id) {
              <span class="ter">{{ s.nombre }}</span>
              <div class="cantidades">
                @for (m of libresDe(s.id); track m.id) {
                  <button class="btn" (click)="mover(m)">{{ m.nombre }}</button>
                } @empty { <span class="ter">Sin mesas libres</span> }
              </div>
            }
          </div>
        }
      }
    }

    @if (renombrando(); as r) {
      <div class="dialogo-fondo" (click)="renombrando.set(null)">
        <form class="dialogo" (click)="$event.stopPropagation()" (ngSubmit)="guardarNombre()">
          <h3>¿Cómo se llama?</h3>
          <input class="input" name="nombre" [(ngModel)]="r.nombre" placeholder="Ej.: Ana, el de campera roja" autofocus />
          <div class="pie">
            <button type="button" class="btn" (click)="renombrando.set(null)">Cancelar</button>
            <button type="submit" class="btn primario">Guardar</button>
          </div>
        </form>
      </div>
    }
  `,
})
export class CuentaPanel {
  protected readonly tienda = inject(Tienda);
  private readonly avisos = inject(Avisos);
  private readonly impresion = inject(Impresion);

  readonly mesa = input.required<Mesa>();
  readonly cerrar = output<void>();

  protected readonly vista = signal<Vista>('cuenta');
  protected readonly destino = signal<string | null>(null);
  protected readonly agrupar = signal<'todo' | 'persona'>('todo');
  protected readonly busqueda = signal('');
  protected readonly categoria = signal<string | null>(null);
  protected readonly agregados = signal<Record<string, number>>({});
  protected readonly modo = signal<ModoCobro>('todo');
  protected readonly medio = signal<MedioPago>('efectivo');
  protected readonly repartir = signal(true);
  protected readonly personaCobro = signal<string | null>(null);
  protected readonly seleccion = signal<Record<string, number>>({});
  protected readonly partes = signal(2);
  protected readonly ultimaVenta = signal<Venta | null>(null);
  protected readonly renombrando = signal<{ id: string; nombre: string } | null>(null);
  protected readonly cobrando = signal(false);
  protected recibido: number | null = null;
  protected quienPaga = '';

  // La cuenta se modifica en el lugar, así que siempre se considera "cambiada" para que los totales se recalculen.
  protected readonly cuenta = computed(
    () => {
      this.tienda.estado();
      return this.tienda.cuentaDeMesa(this.mesa().id);
    },
    { equal: () => false },
  );
  protected readonly total = computed(() => (this.cuenta() ? totalCuenta(this.cuenta()!) : 0));
  protected readonly pagado = computed(() => (this.cuenta() ? pagadoCuenta(this.cuenta()!) : 0));
  protected readonly pendiente = computed(() => (this.cuenta() ? pendienteCuenta(this.cuenta()!) : 0));
  protected readonly compartido = computed(() => (this.cuenta() ? compartidoRestante(this.cuenta()!) : 0));
  protected readonly puedeCobrar = computed(() => this.tienda.usuario()?.permisos.cobrar ?? false);
  protected readonly itemsSinPagar = computed(() => this.cuenta()?.items.filter((i) => !i.pagado) ?? []);
  protected readonly itemsOrdenados = computed(() => [...(this.cuenta()?.items ?? [])].sort((a, b) => Number(a.pagado) - Number(b.pagado)));
  protected readonly grupos = computed(() => {
    const c = this.cuenta();
    if (!c) return [];
    const g = c.personas.map((p) => {
      const items = c.items.filter((i) => i.personaId === p.id);
      return { id: p.id, nombre: p.nombre, items, total: totalItems(items) };
    });
    const comunes = c.items.filter((i) => i.personaId === null);
    return [{ id: 'mesa', nombre: 'Toda la mesa (compartido)', items: comunes, total: totalItems(comunes) }, ...g];
  });
  protected readonly categorias = computed(() => this.tienda.estado().categorias.filter((cat) => this.tienda.productosActivos().some((p) => p.categoria === cat)));
  protected readonly productosFiltrados = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    return this.tienda.productosActivos().filter((p) => (!this.categoria() || p.categoria === this.categoria()) && (!q || p.nombre.toLowerCase().includes(q)));
  });
  protected readonly medios = computed(() => MEDIOS_PAGO.filter((m) => this.tienda.estado().ajustes.mediosActivos.includes(m.id)));
  protected readonly montoParte = computed(() => {
    const restantes = Math.max(1, this.partes() - this.partesCobradas());
    return partesIguales(this.pendiente(), restantes)[0] ?? 0;
  });
  private readonly partesCobradas = computed(() => this.cuenta()?.pagos.filter((p) => p.modo === 'partes').length ?? 0);
  protected readonly montoACobrar = computed(() => {
    const c = this.cuenta();
    if (!c) return 0;
    switch (this.modo()) {
      case 'todo': return this.pendiente();
      case 'persona': return this.personaCobro() ? Math.min(this.pendiente(), aPagarPersona(c, this.personaCobro()!, this.repartir()).total) : 0;
      case 'productos': return c.items.reduce((s, i) => s + i.precio * (this.seleccion()[i.id] ?? 0), 0);
      case 'partes': {
        const restantes = this.partes() - this.partesCobradas();
        return restantes <= 1 ? this.pendiente() : this.montoParte();
      }
    }
  });

  protected readonly modos: { id: ModoCobro; nombre: string; ayuda: string }[] = [
    { id: 'todo', nombre: 'Uno paga todo', ayuda: 'Toda la mesa' },
    { id: 'persona', nombre: 'Cada uno lo suyo', ayuda: 'Por persona' },
    { id: 'productos', nombre: 'Elegir productos', ayuda: 'Tildás qué paga' },
    { id: 'partes', nombre: 'Partes iguales', ayuda: 'Dividir el total' },
  ];

  protected readonly plata = plata;
  protected readonly hora = hora;
  protected readonly duracion = duracion;
  protected readonly vuelto = vuelto;
  protected readonly max = Math.max;
  protected readonly iX = X;
  protected readonly iAtras = ChevronLeft;
  protected readonly iMas = Plus;
  protected readonly iMenos = Minus;
  protected readonly iSumar = UserPlus;
  protected readonly iCheck = Check;
  protected readonly iOk = CircleCheck;
  protected readonly iRecibo = Receipt;
  protected readonly iMano = Hand;
  protected readonly iImprimir = Printer;
  protected readonly iMover = ArrowRightLeft;
  protected readonly iEditar = Pencil;
  protected readonly iBuscar = Search;

  constructor() {
    // Al cambiar de mesa, el panel vuelve a la cuenta.
    effect(() => {
      this.mesa();
      untracked(() => {
        this.vista.set('cuenta');
        this.destino.set(null);
        this.ultimaVenta.set(null);
      });
    });
  }

  abrir(n: number) {
    this.tienda.abrirMesa(this.mesa().id, n);
    this.vista.set('agregar');
    this.agregados.set({});
  }

  agregarProducto(p: Producto, varianteId: string) {
    const c = this.cuenta();
    if (!c) return;
    this.tienda.agregarItem(c.id, p, varianteId, this.destino());
    const k = `${p.id}:${varianteId}`;
    this.agregados.update((a) => ({ ...a, [k]: (a[k] ?? 0) + 1 }));
  }

  volverACuenta() {
    this.vista.set('cuenta');
    this.agregados.set({});
    this.busqueda.set('');
  }

  sumarPersona() {
    const id = this.tienda.agregarPersona(this.cuenta()!.id);
    this.destino.set(id);
    this.avisos.mostrar('Se sumó una persona. Lo que agregues ahora va a su nombre.', 'info');
  }

  renombrar(personaId: string, actual: string) {
    this.renombrando.set({ id: personaId, nombre: actual.startsWith('Persona') ? '' : actual });
  }

  guardarNombre() {
    const r = this.renombrando();
    if (r?.nombre.trim()) this.tienda.renombrarPersona(this.cuenta()!.id, r.id, r.nombre);
    this.renombrando.set(null);
  }

  nombrePersona(id: string): string {
    return this.cuenta()?.personas.find((p) => p.id === id)?.nombre ?? '';
  }

  subtotal(personaId: string): number {
    const c = this.cuenta();
    return c ? totalItems(itemsDePersona(c, personaId)) : 0;
  }

  pagoPersona(personaId: string): number | null {
    const p = this.cuenta()?.pagos.filter((x) => x.modo === 'persona' && x.personaId === personaId);
    return p?.length ? p.reduce((s, x) => s + x.monto, 0) : null;
  }

  aPagar(personaId: string) {
    return aPagarPersona(this.cuenta()!, personaId, this.repartir());
  }

  irACobrar() {
    this.vista.set('cobrar');
    this.modo.set('todo');
    this.recibido = null;
    this.quienPaga = '';
    this.seleccion.set({});
    this.partes.set(Math.max(2, this.cuenta()?.personas.length ?? 2));
    const sinPagar = personasSinPagar(this.cuenta()!);
    this.personaCobro.set(sinPagar.find((id) => this.aPagar(id).total > 0) ?? null);
  }

  elegirModo(m: ModoCobro) {
    this.modo.set(m);
    this.recibido = null;
  }

  tildar(i: ItemCuenta, si: boolean) {
    this.seleccion.update((s) => ({ ...s, [i.id]: si ? i.cantidad : 0 }));
  }

  cambiarSeleccion(i: ItemCuenta, delta: number) {
    this.seleccion.update((s) => ({ ...s, [i.id]: Math.max(1, Math.min(i.cantidad, (s[i.id] ?? 0) + delta)) }));
  }

  async confirmarCobro() {
    if (this.cobrando()) return;
    const c = this.cuenta()!;
    const monto = this.montoACobrar();
    const modo = this.modo();
    let personaId: string | null = modo === 'persona' ? this.personaCobro() : this.quienPaga || null;
    let cubreCompartido = 0;
    let items: { itemId: string; cantidad: number }[] = [];
    if (modo === 'persona' && personaId) {
      cubreCompartido = aPagarPersona(c, personaId, this.repartir()).compartido;
      items = itemsDePersona(c, personaId).map((i) => ({ itemId: i.id, cantidad: i.cantidad }));
    }
    if (modo === 'productos') items = Object.entries(this.seleccion()).filter(([, n]) => n > 0).map(([itemId, cantidad]) => ({ itemId, cantidad }));
    if (modo === 'partes') personaId = null;
    const quien = personaId ? this.nombrePersona(personaId) : modo === 'partes' ? `Parte ${this.partesCobradas() + 1} de ${this.partes()}` : '';

    this.cobrando.set(true);
    const { venta, error } = await this.tienda.cobrar(c.id, { monto, medio: this.medio(), modo, personaId, quien, cubreCompartido, items });
    this.cobrando.set(false);
    if (error) {
      this.avisos.mostrar(`No se cobró: ${error} La mesa quedó como estaba.`, 'error');
      return;
    }
    const vuelto = this.medio() === 'efectivo' && this.recibido ? this.recibido - monto : 0;
    if (venta) {
      this.ultimaVenta.set(venta);
      this.vista.set('cobrada');
      if (vuelto > 0) this.avisos.mostrar(`Vuelto: ${plata(vuelto)}`, 'info');
      return;
    }
    this.avisos.mostrar(`Cobrado ${plata(monto)}${quien ? ' a ' + quien : ''}. Falta ${plata(this.pendiente())}.${vuelto > 0 ? ' Vuelto ' + plata(vuelto) + '.' : ''}`);
    this.recibido = null;
    this.seleccion.set({});
    if (modo === 'persona') this.personaCobro.set(personasSinPagar(this.cuenta()!).find((id) => this.aPagar(id).total > 0) ?? null);
    if (modo === 'productos' && !this.itemsSinPagar().length) this.modo.set('todo');
  }

  precuenta() {
    const c = this.cuenta()!;
    const a = this.tienda.estado().ajustes;
    this.impresion.imprimir({
      titulo: 'PRECUENTA', local: a.nombreLocal, direccion: a.direccion, fecha: Date.now(), detalle: `Mesa ${this.mesa().nombre} · ${c.personas.length} personas`,
      lineas: c.items.map((i) => ({ cantidad: i.cantidad, nombre: i.nombre, importe: i.precio * i.cantidad })),
      total: this.total(), pagos: c.pagos.map((p) => ({ medio: p.medio, monto: p.monto, quien: p.quien })), falta: this.pendiente(),
    });
  }

  imprimirVenta() {
    const v = this.ultimaVenta();
    if (!v) return;
    const a = this.tienda.estado().ajustes;
    this.impresion.imprimir({
      titulo: `TICKET #${v.numero}`, local: a.nombreLocal, direccion: a.direccion, fecha: v.fecha, detalle: `Mesa ${v.mesa} · atendió ${this.tienda.nombreUsuario(v.usuarioId)}`,
      lineas: v.lineas.map((l) => ({ cantidad: l.cantidad, nombre: `${l.nombre}${l.variante && !['Unidad', 'Único'].includes(l.variante) ? ' ' + l.variante.toLowerCase() : ''}`, importe: l.precio * l.cantidad })),
      total: v.total, pagos: v.pagos,
    });
  }

  libresDe(salonId: string): Mesa[] {
    return this.tienda.estado().mesas.filter((m) => m.salonId === salonId && !this.tienda.cuentaDeMesa(m.id));
  }

  mover(destino: Mesa) {
    const c = this.cuenta()!;
    if (this.tienda.moverCuenta(c.id, destino.id)) {
      this.avisos.mostrar(`Mesa ${this.mesa().nombre} pasó a la mesa ${destino.nombre}`);
      this.cerrar.emit();
    }
  }

  liberar() {
    this.tienda.cancelarMesa(this.cuenta()!.id);
    this.avisos.mostrar(`Mesa ${this.mesa().nombre} liberada`);
  }
}

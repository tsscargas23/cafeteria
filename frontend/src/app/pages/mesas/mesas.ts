import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { Avisos } from '../../core/avisos';
import { duracion, plata } from '../../core/formato';
import {
  Armchair, Check, Circle, CircleAlert, Hand, Move, Pencil, Plus, RectangleHorizontal, Square, Trash2,
} from '../../core/iconos';
import { FormaMesa, Mesa } from '../../core/modelos';
import { pendienteCuenta, totalCuenta } from '../../core/reglas';
import { Tienda } from '../../core/tienda';
import { CuentaPanel } from './cuenta-panel';

export const COLS = 22;
export const FILAS = 14;

interface Arrastre {
  mesaId: string;
  dx: number;
  dy: number;
  origen: { x: number; y: number };
  x: number;
  y: number;
  choca: boolean;
}

@Component({
  selector: 'app-mesas',
  imports: [FormsModule, LucideAngularModule, CuentaPanel],
  styleUrl: './mesas.scss',
  template: `
    <div class="mesas" [class.editando]="editando()">
      <section class="zona-plano">
        <div class="cab">
          <h1>Salón</h1>
          <div class="salones" role="tablist" aria-label="Salones">
            @for (s of tienda.estado().salones; track s.id) {
              <button role="tab" class="chip" [class.activo]="s.id === salonId()" (click)="elegirSalon(s.id)">
                {{ s.nombre }} <span class="cuenta-chip">{{ ocupadasPorSalon()[s.id] || 0 }}/{{ mesasPorSalon()[s.id] || 0 }}</span>
              </button>
            }
            @if (editando()) {
              <button class="chip" (click)="nuevoSalon()"><lucide-icon [img]="iMas" [size]="15" />Salón</button>
            }
          </div>
          <div class="acciones">
            @if (tienda.esDuena()) {
              @if (editando()) {
                <button class="btn primario" (click)="terminarEdicion()"><lucide-icon [img]="iListo" [size]="18" />Listo</button>
              } @else {
                <button class="btn" (click)="empezarEdicion()"><lucide-icon [img]="iEditar" [size]="18" />Editar salón</button>
              }
            }
          </div>
        </div>

        @if (editando()) {
          <div class="barra-edicion">
            <span class="sec"><lucide-icon [img]="iMover" [size]="16" /> Arrastrá las mesas para acomodarlas. Agregar:</span>
            <button class="btn chico" (click)="agregar('cuadrada')"><lucide-icon [img]="iCuadrada" [size]="16" />Mesa</button>
            <button class="btn chico" (click)="agregar('doble')"><lucide-icon [img]="iDoble" [size]="16" />Mesa doble</button>
            <button class="btn chico" (click)="agregar('redonda')"><lucide-icon [img]="iRedonda" [size]="16" />Redonda</button>
            <button class="btn chico" (click)="agregar('banqueta')"><lucide-icon [img]="iBanqueta" [size]="16" />Banqueta de barra</button>
            <span class="derecha">
              <label class="campo fila" style="gap:6px">
                <span>Nombre del salón</span>
                <input class="input chico" style="width:150px" [ngModel]="salon()?.nombre" (change)="renombrarSalon($any($event.target).value)" />
              </label>
            </span>
          </div>
        } @else {
          <div class="leyenda" aria-label="Referencias">
            <span><i class="libre"></i>Libre</span>
            <span><i class="ocupada"></i>Ocupada</span>
            <span><i class="cuenta"></i><lucide-icon [img]="iMano" [size]="14" />Pidió la cuenta</span>
          </div>
        }

        <div class="plano" #plano [style.aspect-ratio]="COLS + ' / ' + FILAS">
          @for (m of mesasDelSalon(); track m.id) {
            @let c = tienda.cuentaDeMesa(m.id);
            @let a = arrastre();
            <button
              class="mesa"
              [class]="'mesa ' + m.forma + ' ' + (c ? (c.pidioCuenta ? 'cuenta' : 'ocupada') : 'libre')"
              [class.elegida]="m.id === mesaId()"
              [class.arrastrando]="a?.mesaId === m.id"
              [class.choca]="a?.mesaId === m.id && !!a?.choca"
              [style.left.%]="((a && a.mesaId === m.id ? a.x : m.x) / COLS) * 100"
              [style.top.%]="((a && a.mesaId === m.id ? a.y : m.y) / FILAS) * 100"
              [style.width.%]="(m.w / COLS) * 100"
              [style.height.%]="(m.h / FILAS) * 100"
              (pointerdown)="empezarArrastre($event, m)"
              (click)="elegir(m)"
              [attr.aria-label]="'Mesa ' + m.nombre + ', ' + (c ? (c.pidioCuenta ? 'pidió la cuenta' : 'ocupada') : 'libre')"
            >
              <span class="nombre">{{ m.nombre }}</span>
              @if (c) {
                <span class="estado">
                  @if (c.pidioCuenta) { <lucide-icon [img]="iMano" [size]="13" />Cuenta }
                  @else { {{ c.personas.length }} · {{ duracion(c.abiertaEn) }} }
                </span>
                @if (m.forma !== 'banqueta') { <span class="monto">{{ plata(pendienteCuenta(c)) }}</span> }
              } @else if (m.forma !== 'banqueta') {
                <span class="estado">Libre</span>
              }
            </button>
          }
          @if (mesasDelSalon().length === 0) {
            <div class="vacio plano-vacio">
              <h3>Este salón no tiene mesas</h3>
              <p>{{ tienda.esDuena() ? 'Tocá «Editar salón» y agregá las mesas que tenga.' : 'La dueña todavía no armó este salón.' }}</p>
            </div>
          }
        </div>
      </section>

      <aside class="zona-panel" [class.visible-movil]="!!mesaId()">
        @if (editando()) {
          @if (mesaElegida(); as m) {
            <div class="panel-edicion">
              <h2>Mesa {{ m.nombre }}</h2>
              <label class="campo"><span>Nombre o número</span>
                <input class="input" [ngModel]="m.nombre" (change)="tienda.editarMesa(m.id, { nombre: $any($event.target).value })" />
              </label>
              <span class="campo"><span>Forma</span></span>
              <div class="segmentos">
                @for (f of formas; track f.id) {
                  <button [class.activo]="m.forma === f.id" (click)="tienda.editarMesa(m.id, { forma: f.id })">{{ f.nombre }}</button>
                }
              </div>
              <button class="btn peligro" (click)="quitar(m)"><lucide-icon [img]="iBorrar" [size]="17" />Quitar mesa</button>
            </div>
          } @else {
            <div class="vacio"><lucide-icon [img]="iMover" [size]="28" /><h3>Armá el salón</h3><p>Agregá mesas desde la barra de arriba y arrastralas a su lugar. Tocá una mesa para cambiarle el nombre o la forma.</p></div>
          }
        } @else if (mesaElegida(); as m) {
          <app-cuenta-panel [mesa]="m" (cerrar)="mesaId.set(null)" />
        } @else {
          <div class="abiertas">
            <h2>Mesas abiertas</h2>
            @for (x of abiertas(); track x.cuenta.id) {
              <button class="fila-abierta" (click)="irA(x.mesa)">
                <span class="n" [class.cuenta]="x.cuenta.pidioCuenta">{{ x.mesa.nombre }}</span>
                <span class="info"><b>{{ x.salon }}</b><small>{{ x.cuenta.personas.length }} {{ x.cuenta.personas.length === 1 ? 'persona' : 'personas' }} · {{ duracion(x.cuenta.abiertaEn) }}</small></span>
                @if (x.cuenta.pidioCuenta) { <span class="etiqueta atencion"><lucide-icon [img]="iMano" [size]="12" />Cuenta</span> }
                <span class="num">{{ plata(totalCuenta(x.cuenta)) }}</span>
              </button>
            } @empty {
              <p class="sec">No hay mesas ocupadas.</p>
            }
            <p class="aviso-linea"><lucide-icon [img]="iInfo" [size]="16" />Tocá una mesa del plano para abrirla o ver su cuenta.</p>
          </div>
        }
      </aside>
    </div>
  `,
})
export class Mesas {
  protected readonly tienda = inject(Tienda);
  private readonly avisos = inject(Avisos);
  private readonly plano = viewChild<ElementRef<HTMLElement>>('plano');

  protected readonly COLS = COLS;
  protected readonly FILAS = FILAS;
  protected readonly salonId = signal(this.tienda.estado().salones[0]?.id ?? '');
  protected readonly mesaId = signal<string | null>(null);
  protected readonly editando = signal(false);
  protected readonly arrastre = signal<Arrastre | null>(null);
  private movio = false;

  protected readonly salon = computed(() => this.tienda.estado().salones.find((s) => s.id === this.salonId()));
  protected readonly mesasDelSalon = computed(() => this.tienda.estado().mesas.filter((m) => m.salonId === this.salonId()));
  protected readonly mesaElegida = computed(() => this.tienda.estado().mesas.find((m) => m.id === this.mesaId()) ?? null);
  protected readonly mesasPorSalon = computed(() => contar(this.tienda.estado().mesas.map((m) => m.salonId)));
  protected readonly ocupadasPorSalon = computed(() => {
    const e = this.tienda.estado();
    return contar(e.cuentas.map((c) => e.mesas.find((m) => m.id === c.mesaId)?.salonId ?? ''));
  });
  protected readonly abiertas = computed(() => {
    const e = this.tienda.estado();
    return e.cuentas
      .map((cuenta) => {
        const mesa = e.mesas.find((m) => m.id === cuenta.mesaId)!;
        return { cuenta, mesa, salon: e.salones.find((s) => s.id === mesa?.salonId)?.nombre ?? '' };
      })
      .filter((x) => x.mesa)
      .sort((a, b) => Number(b.cuenta.pidioCuenta) - Number(a.cuenta.pidioCuenta) || a.cuenta.abiertaEn - b.cuenta.abiertaEn);
  });

  protected readonly formas: { id: FormaMesa; nombre: string }[] = [
    { id: 'cuadrada', nombre: 'Mesa' }, { id: 'doble', nombre: 'Doble' }, { id: 'redonda', nombre: 'Redonda' }, { id: 'banqueta', nombre: 'Banqueta' },
  ];

  protected readonly plata = plata;
  protected readonly duracion = duracion;
  protected readonly totalCuenta = totalCuenta;
  protected readonly pendienteCuenta = pendienteCuenta;
  protected readonly iEditar = Pencil;
  protected readonly iListo = Check;
  protected readonly iMas = Plus;
  protected readonly iMover = Move;
  protected readonly iMano = Hand;
  protected readonly iBorrar = Trash2;
  protected readonly iInfo = CircleAlert;
  protected readonly iCuadrada = Square;
  protected readonly iDoble = RectangleHorizontal;
  protected readonly iRedonda = Circle;
  protected readonly iBanqueta = Armchair;

  elegirSalon(id: string) {
    this.salonId.set(id);
    this.mesaId.set(null);
  }

  elegir(m: Mesa) {
    if (this.movio) return;
    this.mesaId.set(this.mesaId() === m.id && this.editando() ? null : m.id);
  }

  irA(m: Mesa) {
    this.salonId.set(m.salonId);
    this.mesaId.set(m.id);
  }

  empezarEdicion() {
    if (window.innerWidth <= 700) {
      this.avisos.mostrar('Para acomodar el salón usá la computadora: en el celular las mesas se ven en lista.', 'info');
      return;
    }
    this.editando.set(true);
    this.mesaId.set(null);
  }

  terminarEdicion() {
    this.editando.set(false);
    this.mesaId.set(null);
    this.avisos.mostrar('Salón guardado');
  }

  agregar(forma: FormaMesa) {
    const id = this.tienda.agregarMesa(this.salonId(), forma);
    const m = this.tienda.estado().mesas.find((x) => x.id === id)!;
    const lugar = this.lugarLibre(m);
    this.tienda.moverMesa(id, lugar.x, lugar.y);
    this.mesaId.set(id);
  }

  quitar(m: Mesa) {
    if (!this.tienda.quitarMesa(m.id)) {
      this.avisos.mostrar('No se puede quitar una mesa ocupada. Cobrala o movela primero.', 'error');
      return;
    }
    this.mesaId.set(null);
    this.avisos.mostrar(`Mesa ${m.nombre} quitada`);
  }

  nuevoSalon() {
    const id = this.tienda.agregarSalon('Nuevo salón');
    this.salonId.set(id);
  }

  renombrarSalon(nombre: string) {
    this.tienda.renombrarSalon(this.salonId(), nombre);
  }

  // ----- Arrastrar mesas sobre la grilla (mouse y dedo) -----

  empezarArrastre(ev: PointerEvent, m: Mesa) {
    this.movio = false;
    if (!this.editando()) return;
    const celda = this.celdaDe(ev);
    if (!celda) return;
    (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
    this.arrastre.set({ mesaId: m.id, dx: celda.x - m.x, dy: celda.y - m.y, origen: { x: m.x, y: m.y }, x: m.x, y: m.y, choca: false });
    const mover = (e: PointerEvent) => this.moverArrastre(e, m);
    const soltar = () => {
      window.removeEventListener('pointermove', mover);
      window.removeEventListener('pointerup', soltar);
      this.soltar();
    };
    window.addEventListener('pointermove', mover);
    window.addEventListener('pointerup', soltar);
  }

  private moverArrastre(ev: PointerEvent, m: Mesa) {
    const a = this.arrastre();
    const celda = this.celdaDe(ev);
    if (!a || !celda) return;
    const x = clamp(Math.round(celda.x - a.dx), 0, COLS - m.w);
    const y = clamp(Math.round(celda.y - a.dy), 0, FILAS - m.h);
    if (x === a.x && y === a.y) return;
    this.movio = true;
    this.arrastre.set({ ...a, x, y, choca: this.choca(m, x, y) });
  }

  private soltar() {
    const a = this.arrastre();
    this.arrastre.set(null);
    if (!a || !this.movio) return;
    if (a.choca) {
      this.avisos.mostrar('Ahí ya hay otra mesa. La dejé donde estaba.', 'info');
    } else {
      this.tienda.moverMesa(a.mesaId, a.x, a.y);
      this.mesaId.set(a.mesaId);
    }
    setTimeout(() => (this.movio = false), 0);
  }

  private celdaDe(ev: PointerEvent): { x: number; y: number } | null {
    const r = this.plano()?.nativeElement.getBoundingClientRect();
    if (!r) return null;
    return { x: ((ev.clientX - r.left) / r.width) * COLS, y: ((ev.clientY - r.top) / r.height) * FILAS };
  }

  private choca(m: Mesa, x: number, y: number): boolean {
    return this.mesasDelSalon().some((o) => o.id !== m.id && x < o.x + o.w && x + m.w > o.x && y < o.y + o.h && y + m.h > o.y);
  }

  private lugarLibre(m: Mesa): { x: number; y: number } {
    for (let y = 1; y <= FILAS - m.h; y++) for (let x = 1; x <= COLS - m.w; x++) if (!this.choca(m, x, y)) return { x, y };
    return { x: 0, y: 0 };
  }
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function contar(ids: string[]): Record<string, number> {
  const r: Record<string, number> = {};
  for (const id of ids) r[id] = (r[id] ?? 0) + 1;
  return r;
}

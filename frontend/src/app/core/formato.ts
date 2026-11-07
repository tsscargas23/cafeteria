import { MEDIOS_PAGO, MedioPago, Unidad } from './modelos';

const pesos = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });
const numero = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 });

/** $ 22.000 */
export function plata(n: number): string {
  return `${n < 0 ? '−' : ''}$ ${pesos.format(Math.abs(Math.round(n)))}`;
}

/** $ 22 mil, para ejes de gráficos. */
export function plataCorta(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$ ${numero.format(Math.round(n / 100_000) / 10)} M`;
  if (Math.abs(n) >= 1000) return `$ ${pesos.format(Math.round(n / 1000))} mil`;
  return plata(n);
}

export function num(n: number): string {
  return numero.format(n);
}

export function cantidadConUnidad(n: number, u: Unidad): string {
  if (u === 'u') return `${numero.format(n)} ${Math.abs(n) === 1 ? 'unidad' : 'unidades'}`;
  return `${numero.format(n)} ${u}`;
}

export function hora(t: number): string {
  return new Date(t).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
}

export function fecha(t: number): string {
  return new Date(t).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}

export function fechaLarga(t: number): string {
  const s = new Date(t).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function fechaHora(t: number): string {
  return `${fecha(t)} · ${hora(t)}`;
}

/** "38 min" o "1 h 12 min". */
export function duracion(desde: number, hasta = Date.now()): string {
  const min = Math.max(0, Math.round((hasta - desde) / 60_000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function nombreMedio(m: MedioPago): string {
  return MEDIOS_PAGO.find((x) => x.id === m)?.nombre ?? m;
}

/** Para inputs type=date. */
export function aInputFecha(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function deInputFecha(s: string, finDelDia = false): number {
  const [y, m, d] = s.split('-').map(Number);
  return finDelDia ? new Date(y, m - 1, d, 23, 59, 59, 999).getTime() : new Date(y, m - 1, d).getTime();
}

export function iniciales(nombre: string): string {
  return nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
}

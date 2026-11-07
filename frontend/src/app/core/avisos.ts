import { Injectable, signal } from '@angular/core';

export interface Aviso {
  id: number;
  texto: string;
  tipo: 'ok' | 'error' | 'info';
  accion?: { texto: string; fn: () => void };
}

/** Mensajes cortos abajo a la derecha ("Mesa 2 cobrada"). */
@Injectable({ providedIn: 'root' })
export class Avisos {
  readonly lista = signal<Aviso[]>([]);
  private siguiente = 1;

  mostrar(texto: string, tipo: Aviso['tipo'] = 'ok', accion?: Aviso['accion']) {
    const id = this.siguiente++;
    this.lista.update((l) => [...l, { id, texto, tipo, accion }]);
    setTimeout(() => this.cerrar(id), accion ? 7000 : 4000);
  }

  cerrar(id: number) {
    this.lista.update((l) => l.filter((a) => a.id !== id));
  }
}

/**
 * Estilo de baraja elegido por el jugador (se guarda en este navegador).
 * - 'facciones': baraja original de las cuatro facciones (fantasía oscura).
 * - 'clasica': dibujo tradicional sencillo.
 */
import { useSyncExternalStore } from 'react';

export type DeckStyle = 'facciones' | 'clasica';
export const DECK_STYLES: { id: DeckStyle; label: string }[] = [
  { id: 'facciones', label: 'Cuatro Facciones' },
  { id: 'clasica', label: 'Clásica' },
];

const KEY = 'pablo.deck';
const read = (): DeckStyle => (localStorage.getItem(KEY) === 'clasica' ? 'clasica' : 'facciones');

let current: DeckStyle = typeof localStorage !== 'undefined' ? read() : 'facciones';
const subs = new Set<() => void>();

export function setDeckStyle(s: DeckStyle) {
  current = s;
  localStorage.setItem(KEY, s);
  subs.forEach((f) => f());
}

export function useDeckStyle(): DeckStyle {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => current,
  );
}

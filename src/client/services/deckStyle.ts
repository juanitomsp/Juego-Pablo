/**
 * Estilo de baraja elegido por el jugador (se guarda en este navegador).
 * - 'tradicional': baraja española ilustrada «Naipes Libres» (CC BY-SA 3.0, ver docs/CARTAS.md).
 * - 'facciones': baraja original de las cuatro facciones (fantasía oscura).
 * - 'clasica': dibujo tradicional sencillo.
 */
import { useSyncExternalStore } from 'react';

export type DeckStyle = 'tradicional' | 'facciones' | 'clasica';
export const DECK_STYLES: { id: DeckStyle; label: string }[] = [
  { id: 'tradicional', label: 'Tradicional' },
  { id: 'facciones', label: 'Cuatro Facciones' },
  { id: 'clasica', label: 'Clásica' },
];

const KEY = 'pablo.deck';
const read = (): DeckStyle => {
  const v = localStorage.getItem(KEY);
  return v === 'clasica' || v === 'facciones' ? v : 'tradicional';
};

let current: DeckStyle = typeof localStorage !== 'undefined' ? read() : 'tradicional';
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

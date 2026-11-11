/**
 * Identidad local del jugador (sin cuenta): un identificador aleatorio y un apodo,
 * guardados solo en este navegador (localStorage). Ver docs/PRIVACIDAD.md.
 */
const ID_KEY = 'pablo.playerId';
const NAME_KEY = 'pablo.name';

function randomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

export function getPlayerId(): string {
  let id = localStorage.getItem(ID_KEY);
  if (!id) {
    id = randomId();
    localStorage.setItem(ID_KEY, id);
  }
  return id;
}

export const getName = (): string => localStorage.getItem(NAME_KEY) ?? '';
export const setName = (name: string) => localStorage.setItem(NAME_KEY, name.trim().slice(0, 20));

/** Borra todo lo que el juego guarda en este navegador. */
export function clearLocalData() {
  for (const k of Object.keys(localStorage)) if (k.startsWith('pablo.')) localStorage.removeItem(k);
}

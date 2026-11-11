/**
 * Cartas, baraja y valores del Pablo.
 * Ver docs/REGLAS.md §2 y §3 para la justificación de cada valor.
 */

export type Suit = 'oros' | 'copas' | 'espadas' | 'bastos';
export const SUITS: Suit[] = ['oros', 'copas', 'espadas', 'bastos'];

/** rank: 1..7 números, 10 = sota, 11 = caballo, 12 = rey (baraja española). */
export interface Card {
  suit: Suit;
  rank: number;
}

export type Rng = () => number;

export const cardId = (c: Card): string => `${c.rank}-${c.suit}`;
export const sameCard = (a: Card, b: Card): boolean => a.suit === b.suit && a.rank === b.rank;

/**
 * Baraja según número de jugadores (sobre la baraja española de 48 cartas):
 * - 6 jugadores: se quitan 8 y 9  -> 40 cartas.
 * - 4 jugadores: se quitan 5, 6, 7, 8 y 9 -> 28 cartas.
 */
export function excludedRanks(players: number): number[] {
  return players === 4 ? [5, 6, 7, 8, 9] : [8, 9];
}

export function buildDeck(players: number): Card[] {
  const excluded = excludedRanks(players);
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 12; rank++) {
      if (!excluded.includes(rank)) deck.push({ suit, rank });
    }
  }
  return deck;
}

/** Fisher-Yates con RNG inyectable (para tests deterministas). */
export function shuffle<T>(items: T[], rng: Rng = Math.random): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** RNG determinista (mulberry32) para tests y repeticiones. */
export function seededRng(seed: number): Rng {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export const isPablo = (c: Card) => c.suit === 'bastos' && c.rank === 4;
export const isTuerto = (c: Card) => c.suit === 'oros' && c.rank === 11;

/** Triunfo = carta del palo de la muestra, o el Pablo, o el Tuerto. */
export const isTrump = (c: Card, trump: Suit) => isPablo(c) || isTuerto(c) || c.suit === trump;

/** El Pablo y el Tuerto se consideran siempre del palo del triunfo. */
export const effectiveSuit = (c: Card, trump: Suit): Suit => (isTrump(c, trump) ? trump : c.suit);

const TRUMP_LOW: Record<number, number> = { 12: 96, 11: 95, 10: 94, 1: 93, 7: 92, 6: 91, 5: 90, 4: 89 };
const PLAIN: Record<number, number> = { 12: 10, 11: 9, 10: 8, 1: 7, 7: 6, 6: 5, 5: 4, 4: 3, 3: 2, 2: 1 };

/**
 * Fuerza de un triunfo (mayor = mejor):
 * Pablo > Andorra (3) > Tuerto > Malilla (2) > Rey > Caballo > Sota > As > 7 > 6 > 5 > 4
 */
export function trumpPower(c: Card, trump: Suit): number {
  if (isPablo(c)) return 100;
  if (c.suit === trump && c.rank === 3) return 99;
  if (isTuerto(c)) return 98;
  if (c.suit === trump && c.rank === 2) return 97;
  return TRUMP_LOW[c.rank] ?? 0;
}

/** Fuerza de una carta que no es triunfo: Rey > Caballo > Sota > As > 7 > 6 > 5 > 4 > 3 > 2 */
export const plainPower = (c: Card): number => PLAIN[c.rank] ?? 0;

/** Valor absoluto útil para ordenar manos y para la IA (triunfos siempre por encima). */
export function sortValue(c: Card, trump: Suit): number {
  return isTrump(c, trump) ? 100 + trumpPower(c, trump) : plainPower(c);
}

export interface PlayedCard {
  seat: number;
  card: Card;
}

/** Índice de la jugada ganadora de una baza. */
export function trickWinnerIndex(plays: PlayedCard[], trump: Suit): number {
  const lead = effectiveSuit(plays[0].card, trump);
  const score = (c: Card) =>
    isTrump(c, trump) ? 1000 + trumpPower(c, trump) : effectiveSuit(c, trump) === lead ? plainPower(c) : -1;
  let best = 0;
  for (let i = 1; i < plays.length; i++) {
    if (score(plays[i].card) > score(plays[best].card)) best = i;
  }
  return best;
}

/**
 * Cartas que se pueden jugar (obligación de asistir):
 * - Si se sale de un palo que no es triunfo: hay que echar de ese palo o triunfo (a elección).
 *   Si no se tiene ninguno, cualquier carta.
 * - Si se sale de triunfo: hay que echar triunfo. El Pablo no está obligado a asistir:
 *   si el único triunfo que se tiene es el Pablo, se puede echar cualquier carta.
 */
export function legalCards(hand: Card[], trickSoFar: PlayedCard[], trump: Suit): Card[] {
  if (trickSoFar.length === 0) return hand.slice();
  const lead = effectiveSuit(trickSoFar[0].card, trump);
  if (lead === trump) {
    const obliged = hand.filter((c) => isTrump(c, trump) && !isPablo(c));
    return obliged.length > 0 ? hand.filter((c) => isTrump(c, trump)) : hand.slice();
  }
  const follow = hand.filter((c) => c.suit === lead && !isTrump(c, trump)).concat(hand.filter((c) => isTrump(c, trump)));
  return follow.length > 0 ? follow : hand.slice();
}

const RANK_NAMES: Record<number, string> = {
  1: 'As', 2: 'Dos', 3: 'Tres', 4: 'Cuatro', 5: 'Cinco', 6: 'Seis', 7: 'Siete', 10: 'Sota', 11: 'Caballo', 12: 'Rey',
};

export const rankShort = (rank: number): string => (rank === 10 ? 'S' : rank === 11 ? 'C' : rank === 12 ? 'R' : String(rank));

export function cardName(c: Card): string {
  return `${RANK_NAMES[c.rank] ?? c.rank} de ${c.suit}`;
}

/** Nombre propio de la carta dentro del juego, si lo tiene (Pablo, Tuerto, Andorra, Malilla...). */
export function trumpRole(c: Card, trump: Suit): string | null {
  if (isPablo(c)) return 'Pablo';
  if (isTuerto(c)) return 'Tuerto';
  if (c.suit !== trump) return null;
  if (c.rank === 3) return 'Andorra';
  if (c.rank === 2) return 'Malilla';
  return 'Vira';
}

/** Lista ordenada de triunfos para un palo de muestra (para la ayuda en pantalla). */
export function trumpRanking(trump: Suit, players: number): Card[] {
  const deck = buildDeck(players);
  return deck.filter((c) => isTrump(c, trump)).sort((a, b) => trumpPower(b, trump) - trumpPower(a, trump));
}

/**
 * Sorteo de equipos "por reyes" (docs/REGLAS.md §5.1):
 * se reparten cartas boca arriba una a una; quien recibe un rey deja de recibir.
 * Los primeros n/2 en sacar rey forman el primer equipo y el primero de todos es el mano.
 */
import { Card, Rng, buildDeck, shuffle } from './cards';

export interface KingDraw {
  /** Índices de jugador (en el orden de entrada) en el orden en que sacaron rey. */
  kingOrder: number[];
  /** Cartas que recibió cada jugador. */
  dealt: Card[][];
  /** Nuevo asiento para cada jugador (índice = jugador original). Equipo 0 = asientos pares. */
  seatFor: number[];
}

export function drawTeamsByKings(n: number, rng: Rng = Math.random): KingDraw {
  const deck = shuffle(buildDeck(n), rng);
  const dealt: Card[][] = Array.from({ length: n }, () => []);
  const kingOrder: number[] = [];
  let k = 0;
  let p = 0;
  while (kingOrder.length < n && k < deck.length) {
    if (!kingOrder.includes(p)) {
      const c = deck[k++];
      dealt[p].push(c);
      if (c.rank === 12) kingOrder.push(p);
    }
    p = (p + 1) % n;
  }
  // Hay 4 reyes: con 6 jugadores, los que no sacan rey completan el segundo equipo en su orden.
  for (let i = 0; i < n; i++) if (!kingOrder.includes(i)) kingOrder.push(i);

  const half = n / 2;
  const seatFor = new Array<number>(n);
  kingOrder.forEach((player, i) => {
    seatFor[player] = i < half ? i * 2 : (i - half) * 2 + 1;
  });
  return { kingOrder, dealt, seatFor };
}

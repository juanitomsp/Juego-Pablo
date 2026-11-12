/**
 * Bot «listo»: decide simulando muchas veces cómo puede acabar la mano (método de Montecarlo).
 *
 * Para cada carta que puede echar, reparte al azar las cartas que todavía no ha visto entre los demás
 * (respetando lo que sabe: lo jugado, la muestra, los triunfos que le enseñó su compañero al quiero y
 * quién se quedó sin triunfo en un arrastre), juega la mano hasta el final con una estrategia sencilla
 * y cuenta cuántas veces gana su equipo. Se queda con la carta que más gana; a igualdad, la más baja,
 * para no gastar cartas buenas. Con la misma estimación decide si apuesta, si acepta y si juega al quiero.
 *
 * Solo usa la información de su vista (PlayerView): no ve las cartas de nadie.
 */
import { Card, PlayedCard, Rng, Suit, buildDeck, isPablo, isTrump, renuncioCards, sameCard, sortValue, trickWinnerIndex } from './cards';
import { Team, teamOf } from './types';
import type { HandView } from './view';

const TRICKS_TO_WIN = 3;

interface Sim {
  trump: Suit;
  order: number[];
  hands: Card[][];
  trick: PlayedCard[];
  wins: [number, number];
  turn: number;
}

const lowest = (cards: Card[], trump: Suit) => cards.reduce((a, b) => (sortValue(b, trump) < sortValue(a, trump) ? b : a));

/** Estrategia rápida para el resto de jugadores (y para él mismo) dentro de cada simulación. */
function rolloutChoice(s: Sim, seat: number): Card {
  const hand = s.hands[seat];
  const forbidden = renuncioCards(hand, s.trick, s.trump);
  const legal = forbidden.length ? hand.filter((c) => !forbidden.some((f) => sameCard(f, c))) : hand;
  const plain = legal.filter((c) => !isTrump(c, s.trump));
  if (s.trick.length === 0) return lowest(plain.length ? plain : legal, s.trump);
  const winner = s.trick[trickWinnerIndex(s.trick, s.trump)];
  if (teamOf(winner.seat) === teamOf(seat)) return lowest(plain.length ? plain : legal, s.trump);
  const beats = legal.filter((c) => trickWinnerIndex([...s.trick, { seat, card: c }], s.trump) === s.trick.length);
  if (beats.length) return lowest(beats, s.trump);
  return lowest(plain.length ? plain : legal, s.trump);
}

/** Juega una carta en la simulación. Devuelve el equipo ganador de la mano si ya se ha decidido. */
function simPlay(s: Sim, seat: number, card: Card): Team | null {
  const hand = s.hands[seat];
  const i = hand.findIndex((c) => sameCard(c, card));
  hand.splice(i, 1);
  s.trick.push({ seat, card });
  if (s.trick.length < s.order.length) {
    s.turn = s.order[(s.order.indexOf(seat) + 1) % s.order.length];
    return null;
  }
  const w = s.trick[trickWinnerIndex(s.trick, s.trump)].seat;
  const t = teamOf(w);
  s.wins[t]++;
  s.trick = [];
  s.turn = w;
  if (s.wins[t] >= TRICKS_TO_WIN) return t;
  // Si nadie tiene cartas (no debería pasar), gana quien lleve más bazas.
  if (s.order.every((x) => s.hands[x].length === 0)) return s.wins[0] >= s.wins[1] ? 0 : 1;
  return null;
}

function playOut(s: Sim): Team {
  for (let guard = 0; guard < 64; guard++) {
    const seat = s.turn;
    if (s.hands[seat].length === 0) return s.wins[0] >= s.wins[1] ? 0 : 1;
    const r = simPlay(s, seat, rolloutChoice(s, seat));
    if (r !== null) return r;
  }
  return s.wins[0] >= s.wins[1] ? 0 : 1;
}

function shuffleInPlace<T>(a: T[], rng: Rng) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
}

/** Lo que el bot sabe y no sabe de la mano, para poder repartir las cartas ocultas en cada simulación. */
export class Knowledge {
  readonly me: number;
  readonly trump: Suit;
  readonly order: number[];
  private known: Map<number, Card[]> = new Map();
  private needs: Map<number, number> = new Map();
  private unknown: Card[];
  private noTrump = new Set<number>();

  constructor(h: HandView, me: number) {
    this.me = me;
    this.trump = h.trump;
    this.order = h.seats;
    const players = h.counts.length;
    const seen: Card[] = [...h.myCards];
    for (const t of h.tricks) for (const p of t.plays) seen.push(p.card);
    for (const p of h.trick) seen.push(p.card);
    // A 4 la muestra no es de nadie; a 6 es del mano: si aún no la ha jugado, sabemos que la tiene él.
    const muestraFree = players === 4;
    if (muestraFree) seen.push(h.muestra);
    const muestraPlayed = !muestraFree && seen.some((c) => sameCard(c, h.muestra));

    // Cartas que sabemos que tiene cada uno.
    for (const pt of h.partnerTrumps) this.known.set(pt.seat, pt.cards.filter((c) => !seen.some((s) => sameCard(s, c))));
    if (!muestraFree && !muestraPlayed && h.dealer !== me) {
      const list = this.known.get(h.dealer) ?? [];
      if (!list.some((c) => sameCard(c, h.muestra))) list.push(h.muestra);
      this.known.set(h.dealer, list);
    }
    const knownAll = [...this.known.values()].flat();

    // Cuántas cartas le faltan por conocer a cada uno.
    for (const s of this.order) {
      if (s === me) continue;
      let count = h.counts[s];
      if (!h.received[s]) count = s === h.dealer && !muestraFree ? 6 : 5; // a 6, aún no le han repartido
      const knownHere = this.known.get(s)?.length ?? 0;
      this.needs.set(s, Math.max(0, count - knownHere));
    }

    this.unknown = buildDeck(players).filter((c) => !seen.some((s) => sameCard(s, c)) && !knownAll.some((k) => sameCard(k, c)));

    // Quien no echó triunfo en un arrastre no tiene triunfos (salvo, quizá, el Pablo).
    const plays = [...h.tricks.map((t) => t.plays), h.trick];
    for (const tr of plays) {
      if (tr.length === 0 || !isTrump(tr[0].card, this.trump)) continue;
      for (const p of tr.slice(1)) if (!isTrump(p.card, this.trump)) this.noTrump.add(p.seat);
    }
  }

  /** Reparte al azar las cartas ocultas respetando lo que se sabe. */
  sample(myCards: Card[], rng: Rng): Card[][] {
    const hands: Card[][] = Array.from({ length: Math.max(...this.order) + 1 }, () => []);
    hands[this.me] = myCards.slice();
    for (const [s, cards] of this.known) hands[s] = cards.slice();
    const pool = this.unknown.slice();
    shuffleInPlace(pool, rng);
    // Primero los que no pueden tener triunfos.
    const seats = [...this.needs.keys()].sort((a, b) => Number(this.noTrump.has(b)) - Number(this.noTrump.has(a)));
    for (const s of seats) {
      let need = this.needs.get(s)!;
      for (let i = 0; i < pool.length && need > 0; ) {
        const c = pool[i];
        if (this.noTrump.has(s) && isTrump(c, this.trump) && !isPablo(c)) {
          i++;
          continue;
        }
        hands[s].push(c);
        pool.splice(i, 1);
        need--;
      }
      // Si no hay cartas «compatibles» suficientes, se completa con lo que quede.
      while (need > 0 && pool.length) {
        hands[s].push(pool.pop()!);
        need--;
      }
    }
    return hands;
  }
}

export interface SmartOptions {
  /** Simulaciones por decisión (más = más fuerte y más lento). */
  rollouts?: number;
}

/** Probabilidad de que gane la mano el equipo de `me`, jugando `card` ahora (o sin jugar, si card es null). */
function estimate(h: HandView, me: number, know: Knowledge, card: Card | null, n: number, rng: Rng): number {
  let wins = 0;
  const team = teamOf(me);
  for (let i = 0; i < n; i++) {
    const s: Sim = {
      trump: h.trump,
      order: h.seats,
      hands: know.sample(h.myCards, rng),
      trick: h.trick.map((p) => ({ ...p })),
      wins: [h.wins[0], h.wins[1]],
      turn: h.turn,
    };
    let result: Team | null = null;
    if (card) result = simPlay(s, me, card);
    if (result === null) result = playOut(s);
    if (result === team) wins++;
  }
  return wins / n;
}

/** Elige la carta que más probabilidad da de ganar la mano. Devuelve también esa probabilidad. */
export function chooseCard(h: HandView, me: number, legal: Card[], rng: Rng, opts: SmartOptions = {}): { card: Card; p: number } {
  if (legal.length === 1) return { card: legal[0], p: -1 };
  const know = new Knowledge(h, me);
  const total = opts.rollouts ?? 240;
  const per = Math.max(24, Math.floor(total / legal.length));
  const scored = legal.map((card) => ({ card, p: estimate(h, me, know, card, per, rng) }));
  const best = Math.max(...scored.map((x) => x.p));
  // Entre las que están prácticamente igual de bien, la más baja (guardar las buenas).
  const near = scored.filter((x) => x.p >= best - 0.04);
  const pick = near.reduce((a, b) => (sortValue(b.card, h.trump) < sortValue(a.card, h.trump) ? b : a));
  return pick;
}

/** Probabilidad de ganar la mano desde la situación actual (sin elegir carta propia). */
export function winProbability(h: HandView, me: number, rng: Rng, n = 160): number {
  const know = new Knowledge(h, me);
  return estimate(h, me, know, null, n, rng);
}

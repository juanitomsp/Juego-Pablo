/**
 * Una "mano": desde que se reparte hasta que un equipo gana 3 bazas o se va.
 * Funciones puras que mutan el estado recibido (match.ts clona antes de llamarlas).
 */
import {
  Card,
  PlayedCard,
  Rng,
  Suit,
  buildDeck,
  isTrump,
  legalCards,
  renuncioCards,
  sameCard,
  shuffle,
  trickWinnerIndex,
} from './cards';
import { GameConfig, RuleError, Team, otherTeam, teamOf } from './types';

export type HandPhase = 'quiero' | 'playing' | 'bet' | 'done';
export type HandEndReason = 'bazas' | 'rechazo' | 'quiero' | 'renuncio';

export interface CompletedTrick {
  index: number;
  leader: number;
  plays: PlayedCard[];
  winner: number;
  /** La baza se cerró antes de que echaran todos: decidía la mano y la carta ganadora ya no se podía superar. */
  early?: boolean;
}

export interface HandResult {
  winner: Team;
  points: number;
  reason: HandEndReason;
  /** Asiento que provocó el final (quien se fue, quien apostó, etc.). */
  bySeat?: number;
}

export interface PendingBet {
  seat: number;
  team: Team;
  value: number;
}

export interface BetRecord {
  seat: number;
  value: number;
  accepted: boolean | null;
  /** Turno en que se hizo (baza y posición dentro de la baza): solo se puede apostar una vez por turno. */
  trickIndex: number;
  position: number;
}

export interface HandState {
  /** Asientos que juegan esta mano, en orden de juego (el primero sale, el último es el postre). */
  seats: number[];
  dealer: number;
  muestra: Card;
  trump: Suit;
  /** Partida a 6: la muestra pertenece al mano (repartidor). */
  muestraOwner: number | null;
  /** Cartas de cada asiento (índice = asiento). */
  hands: Card[][];
  /** Partida a 6: el mano retiene cartas; false = aún no se le han dado. */
  received: boolean[];
  /** Cartas que quedan en el mazo y no participan ("dormidas"). */
  dormant: Card[];
  trick: PlayedCard[];
  trickIndex: number;
  tricks: CompletedTrick[];
  wins: [number, number];
  turn: number;
  stake: number;
  bets: BetRecord[];
  pendingBet: PendingBet | null;
  quieroTeams: Team[];
  /** Quiero forzoso: ambos equipos al quiero. Sin apuestas ni retirada. */
  forced: boolean;
  /** Triunfos de cada jugador al empezar, visibles para su compañero si su equipo está al quiero. */
  quieroReveal: Record<number, Card[]>;
  phase: HandPhase;
  result: HandResult | null;
}

export interface NewHandOptions {
  dealer: number;
  seats: number[];
  quieroTeams: Team[];
}

export const CARDS_PER_PLAYER = 5;
export const TRICKS_TO_WIN = 3;

export function createHand(cfg: GameConfig, opts: NewHandOptions, rng: Rng): HandState {
  const n = cfg.players;
  const deck = shuffle(buildDeck(n), rng);
  const hands: Card[][] = Array.from({ length: n }, () => []);
  const sixRetention = n === 6;

  let k = 0;
  let muestra: Card;
  let dormant: Card[];
  let muestraOwner: number | null = null;

  if (sixRetention) {
    // A 6: la muestra es la última carta del mazo y es del mano.
    muestra = deck[deck.length - 1];
    for (const seat of opts.seats) for (let i = 0; i < CARDS_PER_PLAYER; i++) hands[seat].push(deck[k++]);
    hands[opts.dealer].push(muestra);
    muestraOwner = opts.dealer;
    dormant = deck.slice(k, deck.length - 1);
  } else {
    // A 4: la muestra es la carta siguiente a la última repartida.
    for (const seat of opts.seats) for (let i = 0; i < CARDS_PER_PLAYER; i++) hands[seat].push(deck[k++]);
    muestra = deck[k];
    dormant = deck.slice(k + 1);
  }

  const trump = muestra.suit;
  const received = Array.from({ length: n }, (_, s) => opts.seats.includes(s));
  // Retención de cartas a 6 (salvo si hay equipo al quiero: se reparte todo).
  if (sixRetention && opts.quieroTeams.length === 0) {
    opts.seats.forEach((s, i) => (received[s] = i < 2));
  }

  const quieroReveal: Record<number, Card[]> = {};
  if (opts.quieroTeams.length > 0) {
    for (const s of opts.seats) {
      if (opts.quieroTeams.includes(teamOf(s))) quieroReveal[s] = hands[s].filter((c) => isTrump(c, trump));
    }
  }

  return {
    seats: opts.seats.slice(),
    dealer: opts.dealer,
    muestra,
    trump,
    muestraOwner,
    hands,
    received,
    dormant,
    trick: [],
    trickIndex: 0,
    tricks: [],
    wins: [0, 0],
    turn: opts.seats[0],
    stake: cfg.handValue,
    bets: [],
    pendingBet: null,
    quieroTeams: opts.quieroTeams.slice(),
    forced: opts.quieroTeams.length === 2,
    quieroReveal,
    phase: opts.quieroTeams.length === 1 ? 'quiero' : 'playing',
    result: null,
  };
}

const nextInHand = (h: HandState, seat: number) => h.seats[(h.seats.indexOf(seat) + 1) % h.seats.length];

export function legalFor(h: HandState, seat: number): Card[] {
  if (h.phase !== 'playing' || h.turn !== seat || !h.received[seat]) return [];
  return legalCards(h.hands[seat], h.trick, h.trump);
}

export function nextBetValue(h: HandState, cfg: GameConfig): number {
  return h.bets.some((b) => b.accepted) ? h.stake + cfg.raiseStep : cfg.firstBetValue;
}

/**
 * ¿Puede este jugador apostar ahora?
 * - Solo en su turno, antes de echar carta.
 * - La primera apuesta, como pronto, la hace el postre en la primera baza
 *   (a 6: el segundo jugador en echar carta), salvo que algún equipo esté al quiero.
 * - Nunca en quiero forzoso.
 */
export function canBet(h: HandState, seat: number, cfg: GameConfig): boolean {
  if (h.phase !== 'playing' || h.turn !== seat || h.forced || !h.received[seat]) return false;
  if (nextBetValue(h, cfg) > cfg.maxStake) return false;
  // Una sola apuesta por turno: no se puede subir 2 o más de golpe. En el siguiente turno, sí.
  const last = h.bets[h.bets.length - 1];
  if (last && last.seat === seat && last.trickIndex === h.trickIndex && last.position === h.trick.length) return false;
  const anyAccepted = h.bets.length > 0;
  if (!anyAccepted && h.quieroTeams.length === 0 && h.trickIndex === 0) {
    const minPos = h.seats.length === 6 ? 1 : h.seats.length - 1;
    if (h.trick.length < minPos) return false;
  }
  return true;
}


export const canRespond = (h: HandState, seat: number) =>
  h.phase === 'bet' && !!h.pendingBet && h.seats.includes(seat) && teamOf(seat) !== h.pendingBet.team;

export const canDecideQuiero = (h: HandState, seat: number) =>
  h.phase === 'quiero' && h.seats.includes(seat) && h.quieroTeams.includes(teamOf(seat));

function finish(h: HandState, result: HandResult) {
  h.phase = 'done';
  h.pendingBet = null;
  h.result = result;
}

export function playCard(h: HandState, seat: number, card: Card): void {
  if (h.phase !== 'playing') throw new RuleError('Ahora no se puede echar carta.');
  if (h.turn !== seat) throw new RuleError('No es tu turno.');
  const legal = legalFor(h, seat);
  if (!legal.some((c) => sameCard(c, card))) throw new RuleError('Esa carta no está en tu mano.');

  const hand = h.hands[seat];
  const renuncio = renuncioCards(hand, h.trick, h.trump).some((c) => sameCard(c, card));
  hand.splice(
    hand.findIndex((c) => sameCard(c, card)),
    1,
  );
  h.trick.push({ seat, card });

  // Retención a 6: cuando juega el primer rival, se reparte a los dos siguientes; luego a los dos últimos.
  if (h.trickIndex === 0 && h.received.some((r, s) => !r && h.seats.includes(s))) {
    const pos = h.seats.indexOf(seat);
    if (pos === 0) [2, 3].forEach((i) => (h.received[h.seats[i]] = true));
    if (pos === 2) [4, 5].forEach((i) => (h.received[h.seats[i]] = true));
  }

  // Renuncio: no echar triunfo en un arrastre teniéndolo. El equipo pierde la mano.
  if (renuncio) {
    finish(h, { winner: otherTeam(teamOf(seat)), points: h.stake, reason: 'renuncio', bySeat: seat });
    return;
  }

  const early = h.trick.length < h.seats.length && decidedEarly(h);
  if (h.trick.length < h.seats.length && !early) {
    h.turn = nextInHand(h, seat);
    return;
  }

  const winnerSeat = h.trick[trickWinnerIndex(h.trick, h.trump)].seat;
  h.tricks.push({ index: h.trickIndex, leader: h.trick[0].seat, plays: h.trick, winner: winnerSeat, ...(early ? { early: true } : {}) });
  h.trick = [];
  h.trickIndex++;
  const t = teamOf(winnerSeat);
  h.wins[t]++;
  h.turn = winnerSeat;
  if (h.wins[t] >= TRICKS_TO_WIN) finish(h, { winner: t, points: h.stake, reason: 'bazas' });
}

/**
 * Cartas que ya ha visto todo el mundo en esta mano: las jugadas y, a 4 jugadores, la muestra
 * (está en el centro y no es de nadie). Las del mazo no se cuentan: nadie sabe cuáles son.
 */
function publiclySeen(h: HandState): Card[] {
  const seen = h.tricks.flatMap((t) => t.plays.map((p) => p.card)).concat(h.trick.map((p) => p.card));
  if (h.muestraOwner === null) seen.push(h.muestra);
  return seen;
}

/**
 * ¿Se puede cerrar ya la baza (y con ella la mano)? Solo si:
 *  - el equipo que va ganando la baza ya tiene 2 bazas, así que esta le da la mano, y
 *  - con lo que todos han visto, ninguna carta que quede por salir puede superar a la que va ganando
 *    (por ejemplo, el Pablo siempre; la Andorra si el Pablo ya salió).
 * Se usa solo información pública, para que cerrar antes no desvele qué cartas tiene nadie.
 */
export function decidedEarly(h: HandState): boolean {
  if (h.trick.length === 0) return false;
  const winner = h.trick[trickWinnerIndex(h.trick, h.trump)];
  if (h.wins[teamOf(winner.seat)] < TRICKS_TO_WIN - 1) return false;
  const seen = publiclySeen(h);
  const unseen = buildDeck(h.hands.length).filter((c) => !seen.some((s) => sameCard(s, c)));
  return !unseen.some((c) => trickWinnerIndex([...h.trick, { seat: -1, card: c }], h.trump) === h.trick.length);
}

export function bet(h: HandState, seat: number, cfg: GameConfig): void {
  if (!canBet(h, seat, cfg)) throw new RuleError('Ahora no puedes apostar.');
  const value = nextBetValue(h, cfg);
  h.pendingBet = { seat, team: teamOf(seat), value };
  h.bets.push({ seat, value, accepted: null, trickIndex: h.trickIndex, position: h.trick.length });
  h.phase = 'bet';
}

export function respond(h: HandState, seat: number, accept: boolean): void {
  if (!canRespond(h, seat) || !h.pendingBet) throw new RuleError('No hay apuesta que responder.');
  const last = h.bets[h.bets.length - 1];
  last.accepted = accept;
  if (accept) {
    h.stake = h.pendingBet.value;
    h.pendingBet = null;
    h.phase = 'playing';
  } else {
    // Al no aceptar, el que apostó se lleva el valor que tenía la mano antes de la apuesta.
    finish(h, { winner: h.pendingBet.team, points: h.stake, reason: 'rechazo', bySeat: seat });
  }
}

export function decideQuiero(h: HandState, seat: number, play: boolean, cfg: GameConfig): void {
  if (!canDecideQuiero(h, seat)) throw new RuleError('No te toca decidir.');
  if (play) h.phase = 'playing';
  else finish(h, { winner: otherTeam(teamOf(seat)), points: cfg.handValue, reason: 'quiero', bySeat: seat });
}

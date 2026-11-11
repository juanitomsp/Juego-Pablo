/**
 * Partida completa: puntos -> cuernos -> Pablos, rotación del mano, quiero y carteta.
 * `applyAction` es puro: devuelve un estado nuevo (clonado) o lanza RuleError.
 */
import { Card, Rng, Suit } from './cards';
import * as H from './hand';
import { Action, GameConfig, RuleError, Team, teamOf } from './types';

export type MatchPhase = 'deal' | 'hand' | 'handEnd' | 'finished';

export interface HandRecord {
  number: number;
  kind: H.HandKind;
  dealer: number;
  seats: number[];
  trump: Suit;
  muestra: Card;
  result: H.HandResult;
  stake: number;
  bets: H.BetRecord[];
  wins: [number, number];
  scoreAfter: [number, number];
  cuernoWonBy: Team | null;
  pabloWonBy: Team | null;
}

export interface SeatStats {
  tricksWon: number;
  betsMade: number;
  betsWon: number;
  handsPlayed: number;
}

export type MatchEvent =
  | { id: number; kind: 'deal'; dealer: number; carteta: boolean }
  | { id: number; kind: 'cartetaRequest'; team: Team }
  | { id: number; kind: 'trick'; winner: number; index: number }
  | { id: number; kind: 'bet'; seat: number; value: number }
  | { id: number; kind: 'accept'; seat: number; value: number }
  | { id: number; kind: 'reject'; seat: number }
  | { id: number; kind: 'fold'; seat: number }
  | { id: number; kind: 'quiero'; seat: number; play: boolean }
  | { id: number; kind: 'handEnd'; result: H.HandResult }
  | { id: number; kind: 'cuerno'; team: Team }
  | { id: number; kind: 'pablo'; team: Team }
  | { id: number; kind: 'matchEnd'; team: Team };

type EventInput = MatchEvent extends infer E ? (E extends MatchEvent ? Omit<E, 'id'> : never) : never;

export interface MatchState {
  config: GameConfig;
  /** El mano (repartidor) actual. */
  dealer: number;
  score: [number, number];
  cuernos: [number, number];
  pablos: [number, number];
  phase: MatchPhase;
  hand: H.HandState | null;
  handNumber: number;
  /** La carteta ya se ha jugado en este cuerno (medio Pablo). */
  cartetaUsed: boolean;
  cartetaRequest: Team | null;
  /** Parejas pendientes de jugar en la carteta en curso. */
  cartetaQueue: number[][];
  history: HandRecord[];
  seatStats: SeatStats[];
  events: MatchEvent[];
  eventSeq: number;
  winner: Team | null;
}

const MAX_EVENTS = 40;

export function createMatch(config: GameConfig, dealer = 0): MatchState {
  return {
    config: { ...config },
    dealer,
    score: [0, 0],
    cuernos: [0, 0],
    pablos: [0, 0],
    phase: 'deal',
    hand: null,
    handNumber: 0,
    cartetaUsed: false,
    cartetaRequest: null,
    cartetaQueue: [],
    history: [],
    seatStats: Array.from({ length: config.players }, () => ({ tricksWon: 0, betsMade: 0, betsWon: 0, handsPlayed: 0 })),
    events: [],
    eventSeq: 0,
    winner: null,
  };
}

function emit(m: MatchState, e: EventInput) {
  m.eventSeq++;
  m.events.push({ ...e, id: m.eventSeq } as MatchEvent);
  if (m.events.length > MAX_EVENTS) m.events.splice(0, m.events.length - MAX_EVENTS);
}

/** Puntos a partir de los cuales un equipo está "al quiero" (le basta ganar una mano). */
export const quieroThreshold = (cfg: GameConfig) => cfg.pointsPerCuerno - cfg.handValue;

export function quieroTeams(m: MatchState): Team[] {
  const t = quieroThreshold(m.config);
  return ([0, 1] as Team[]).filter((team) => m.score[team] >= t);
}

/** Carteta: una vez por cuerno, y solo si ningún equipo ha pasado de la mitad del cuerno ("chinos buenos"). */
export function cartetaAllowed(m: MatchState): boolean {
  const half = m.config.pointsPerCuerno / 2;
  return m.config.carteta && !m.cartetaUsed && m.score[0] < half && m.score[1] < half && quieroTeams(m).length === 0;
}

export function playOrder(n: number, dealer: number): number[] {
  return Array.from({ length: n }, (_, i) => (dealer + 1 + i) % n);
}

/** Parejas de la carteta: los dos a la derecha del mano, los dos siguientes... y por último el de su izquierda y él. */
export function cartetaPairs(n: number, dealer: number): number[][] {
  const order = playOrder(n, dealer);
  const pairs: number[][] = [];
  for (let i = 0; i < n; i += 2) pairs.push([order[i], order[i + 1]]);
  return pairs;
}

function startHand(m: MatchState, rng: Rng, kind: H.HandKind, seats: number[]) {
  m.hand = H.createHand(
    m.config,
    { kind, dealer: m.dealer, seats, quieroTeams: kind === 'normal' ? quieroTeams(m) : [] },
    rng,
  );
  m.handNumber++;
  m.phase = 'hand';
  m.cartetaRequest = null;
  for (const s of seats) m.seatStats[s].handsPlayed++;
}

function resolveHand(m: MatchState) {
  const h = m.hand!;
  const r = h.result!;
  const cfg = m.config;
  emit(m, { kind: 'handEnd', result: r });

  for (const t of h.tricks) m.seatStats[t.winner].tricksWon++;
  for (const b of h.bets) {
    m.seatStats[b.seat].betsMade++;
    if (teamOf(b.seat) === r.winner) m.seatStats[b.seat].betsWon++;
  }

  m.score[r.winner] += r.points;
  let cuernoWonBy: Team | null = null;
  let pabloWonBy: Team | null = null;
  if (m.score[r.winner] >= cfg.pointsPerCuerno) {
    cuernoWonBy = r.winner;
    m.cuernos[r.winner]++;
    m.score = [0, 0];
    m.cartetaUsed = false;
    m.cartetaQueue = [];
    emit(m, { kind: 'cuerno', team: r.winner });
    if (m.cuernos[r.winner] >= cfg.cuernosPerPablo) {
      pabloWonBy = r.winner;
      m.pablos[r.winner]++;
      m.cuernos = [0, 0];
      emit(m, { kind: 'pablo', team: r.winner });
    }
  }

  m.history.push({
    number: m.handNumber,
    kind: h.kind,
    dealer: h.dealer,
    seats: h.seats.slice(),
    trump: h.trump,
    muestra: h.muestra,
    result: r,
    stake: h.stake,
    bets: h.bets.map((b) => ({ ...b })),
    wins: [...h.wins] as [number, number],
    scoreAfter: [...m.score] as [number, number],
    cuernoWonBy,
    pabloWonBy,
  });

  if (m.pablos[r.winner] >= cfg.pablosToWin) {
    m.winner = r.winner;
    m.phase = 'finished';
    emit(m, { kind: 'matchEnd', team: r.winner });
  } else {
    m.phase = 'handEnd';
  }
}

/** Pasa de 'handEnd' a la siguiente carteta o al siguiente reparto. Lo llama el servidor tras una pausa. */
export function advance(state: MatchState, rng: Rng): MatchState {
  if (state.phase !== 'handEnd') return state;
  const m = structuredClone(state);
  if (m.cartetaQueue.length > 0) {
    const pair = m.cartetaQueue.shift()!;
    startHand(m, rng, 'carteta', pair);
    return m;
  }
  m.dealer = (m.dealer + 1) % m.config.players;
  m.hand = null;
  m.phase = 'deal';
  return m;
}

export function applyAction(state: MatchState, seat: number, action: Action, rng: Rng): MatchState {
  const m = structuredClone(state);
  const cfg = m.config;

  switch (action.type) {
    case 'deal': {
      if (m.phase !== 'deal') throw new RuleError('No es momento de repartir.');
      if (seat !== m.dealer) throw new RuleError('Reparte el mano.');
      if (action.carteta) {
        if (!cartetaAllowed(m)) throw new RuleError('Ahora no se puede jugar carteta.');
        m.cartetaUsed = true;
        m.cartetaQueue = cartetaPairs(cfg.players, m.dealer);
        emit(m, { kind: 'deal', dealer: m.dealer, carteta: true });
        startHand(m, rng, 'carteta', m.cartetaQueue.shift()!);
      } else {
        emit(m, { kind: 'deal', dealer: m.dealer, carteta: false });
        startHand(m, rng, 'normal', playOrder(cfg.players, m.dealer));
      }
      return m;
    }
    case 'requestCarteta': {
      if (m.phase !== 'deal') throw new RuleError('Solo se puede pedir carteta antes de repartir.');
      if (teamOf(seat) === teamOf(m.dealer)) throw new RuleError('Tu equipo es mano: puede repartir carteta directamente.');
      if (!cartetaAllowed(m)) throw new RuleError('Ahora no se puede jugar carteta.');
      m.cartetaRequest = teamOf(seat);
      emit(m, { kind: 'cartetaRequest', team: teamOf(seat) });
      return m;
    }
  }

  if (m.phase !== 'hand' || !m.hand) throw new RuleError('No hay ninguna mano en juego.');
  const h = m.hand;

  switch (action.type) {
    case 'play': {
      const before = h.tricks.length;
      H.playCard(h, seat, action.card);
      if (h.tricks.length > before) {
        const t = h.tricks[h.tricks.length - 1];
        emit(m, { kind: 'trick', winner: t.winner, index: t.index });
      }
      break;
    }
    case 'bet':
      H.bet(h, seat, cfg);
      emit(m, { kind: 'bet', seat, value: h.pendingBet!.value });
      break;
    case 'accept': {
      const value = h.pendingBet?.value ?? 0;
      H.respond(h, seat, true);
      emit(m, { kind: 'accept', seat, value });
      break;
    }
    case 'reject':
      H.respond(h, seat, false);
      emit(m, { kind: 'reject', seat });
      break;
    case 'fold':
      H.fold(h, seat);
      emit(m, { kind: 'fold', seat });
      break;
    case 'quiero':
      H.decideQuiero(h, seat, action.play, cfg);
      emit(m, { kind: 'quiero', seat, play: action.play });
      break;
    default:
      throw new RuleError('Acción desconocida.');
  }

  if (h.phase === 'done') resolveHand(m);
  return m;
}

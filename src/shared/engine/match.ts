/**
 * Partida completa: puntos -> cuernos -> Pablos, rotación del mano y quiero.
 * `applyAction` es puro: devuelve un estado nuevo (clonado) o lanza RuleError.
 */
import { Card, Rng, Suit } from './cards';
import * as H from './hand';
import { Action, GameConfig, RuleError, Team, teamOf } from './types';

export type MatchPhase = 'deal' | 'hand' | 'handEnd' | 'finished';

export interface HandRecord {
  number: number;
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
  | { id: number; kind: 'deal'; dealer: number }
  | { id: number; kind: 'trick'; winner: number; index: number }
  | { id: number; kind: 'bet'; seat: number; value: number }
  | { id: number; kind: 'accept'; seat: number; value: number }
  | { id: number; kind: 'reject'; seat: number }
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

export function playOrder(n: number, dealer: number): number[] {
  return Array.from({ length: n }, (_, i) => (dealer + 1 + i) % n);
}

function startHand(m: MatchState, rng: Rng) {
  const seats = playOrder(m.config.players, m.dealer);
  m.hand = H.createHand(m.config, { dealer: m.dealer, seats, quieroTeams: quieroTeams(m) }, rng);
  m.handNumber++;
  m.phase = 'hand';
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

/** Pasa de 'handEnd' al siguiente reparto (el nuevo mano es el de la derecha). Lo llama el servidor tras una pausa. */
export function advance(state: MatchState, _rng?: Rng): MatchState {
  if (state.phase !== 'handEnd') return state;
  const m = structuredClone(state);
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
      emit(m, { kind: 'deal', dealer: m.dealer });
      startHand(m, rng);
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

/**
 * Vista de la partida para un jugador concreto: oculta las cartas de los demás.
 * Es lo único que el servidor envía a cada cliente (y lo que usan los bots, para no hacer trampas).
 */
import { Card, PlayedCard, Suit, cardId, isTrump as isTrumpCard, renuncioCards, sameCard, winningCards } from './cards';
import * as H from './hand';
import { HandRecord, MatchEvent, MatchPhase, MatchState, SeatStats, quieroThreshold } from './match';
import { GameConfig, Team, teamOf } from './types';

export interface HandView {
  seats: number[];
  dealer: number;
  trump: Suit;
  muestra: Card;
  /** Partida a 6, primera baza: la muestra está a la vista en la mano del postre. */
  muestraInHand: boolean;
  myCards: Card[];
  /** Número de cartas de cada asiento (índice = asiento). */
  counts: number[];
  received: boolean[];
  trick: PlayedCard[];
  lastTrick: H.CompletedTrick | null;
  tricks: H.CompletedTrick[];
  trickIndex: number;
  wins: [number, number];
  turn: number;
  stake: number;
  nextBet: number;
  pendingBet: H.PendingBet | null;
  bets: H.BetRecord[];
  quieroTeams: Team[];
  forced: boolean;
  /** Triunfos de tus compañeros (solo si tu equipo está al quiero). */
  partnerTrumps: { seat: number; cards: Card[] }[];
  phase: H.HandPhase;
  result: H.HandResult | null;
  /** Cartas jugables (ids) para ti ahora mismo. */
  legal: string[];
  /** Tus cartas (ids) que ganarían la baza si las echas ahora (aviso). */
  winning: string[];
  /** Hay arrastre: el primero salió con triunfo. */
  arrastre: boolean;
  /** Tus cartas (ids) que serían renuncio si las echas ahora (arrastre y tienes triunfo). */
  renuncio: string[];
  canBet: boolean;
  canFold: boolean;
  canRespond: boolean;
  canDecideQuiero: boolean;
  dormantCount: number;
}

export interface PlayerView {
  you: number | null;
  config: GameConfig;
  dealer: number;
  score: [number, number];
  cuernos: [number, number];
  pablos: [number, number];
  phase: MatchPhase;
  handNumber: number;
  quieroThreshold: number;
  hand: HandView | null;
  canDeal: boolean;
  history: HandRecord[];
  seatStats: SeatStats[];
  events: MatchEvent[];
  winner: Team | null;
}

function handView(m: MatchState, h: H.HandState, you: number | null): HandView {
  const cfg = m.config;
  const isMine = you !== null && h.seats.includes(you);
  const myCards = isMine && h.received[you!] ? h.hands[you!].slice() : [];
  const muestraInHand =
    h.muestraOwner !== null &&
    h.trickIndex === 0 &&
    h.phase !== 'done' &&
    h.hands[h.muestraOwner].some((c) => sameCard(c, h.muestra));

  const partnerTrumps: { seat: number; cards: Card[] }[] = [];
  if (you !== null && h.quieroTeams.includes(teamOf(you))) {
    for (const [s, cards] of Object.entries(h.quieroReveal)) {
      const seat = Number(s);
      if (seat !== you && teamOf(seat) === teamOf(you)) partnerTrumps.push({ seat, cards });
    }
  }

  const legal = you === null ? [] : H.legalFor(h, you).map(cardId);
  return {
    seats: h.seats.slice(),
    dealer: h.dealer,
    trump: h.trump,
    muestra: h.muestra,
    muestraInHand,
    myCards,
    counts: h.hands.map((c, s) => (h.received[s] ? c.length : 0)),
    received: h.received.slice(),
    trick: h.trick.slice(),
    lastTrick: h.tricks.length ? h.tricks[h.tricks.length - 1] : null,
    tricks: h.tricks.slice(),
    trickIndex: h.trickIndex,
    wins: [...h.wins] as [number, number],
    turn: h.turn,
    stake: h.stake,
    nextBet: H.nextBetValue(h, cfg),
    pendingBet: h.pendingBet,
    bets: h.bets.slice(),
    quieroTeams: h.quieroTeams.slice(),
    forced: h.forced,
    partnerTrumps,
    phase: h.phase,
    result: h.result,
    legal,
    arrastre: h.trick.length > 0 && isTrumpCard(h.trick[0].card, h.trump),
    renuncio: you !== null && h.phase === 'playing' && h.turn === you ? renuncioCards(myCards, h.trick, h.trump).map(cardId) : [],
    winning: you !== null && h.phase === 'playing' && h.turn === you ? winningCards(myCards, h.trick, h.trump).map(cardId) : [],
    canBet: you !== null && H.canBet(h, you, cfg),
    canFold: you !== null && H.canFold(h, you),
    canRespond: you !== null && H.canRespond(h, you),
    canDecideQuiero: you !== null && H.canDecideQuiero(h, you),
    dormantCount: h.dormant.length,
  };
}

export function getView(m: MatchState, you: number | null): PlayerView {
  const dealPhase = m.phase === 'deal';
  return {
    you,
    config: m.config,
    dealer: m.dealer,
    score: [...m.score] as [number, number],
    cuernos: [...m.cuernos] as [number, number],
    pablos: [...m.pablos] as [number, number],
    phase: m.phase,
    handNumber: m.handNumber,
    quieroThreshold: quieroThreshold(m.config),
    hand: m.hand ? handView(m, m.hand, you) : null,
    canDeal: dealPhase && you === m.dealer,
    history: m.history.slice(-30),
    seatStats: m.seatStats,
    events: m.events.slice(-20),
    winner: m.winner,
  };
}

/**
 * Jugador automático sencillo. Solo ve lo mismo que vería un humano (PlayerView).
 * Heurísticas documentadas en docs/ARQUITECTURA.md §Bots.
 */
import {
  Card,
  Rng,
  Suit,
  cardId,
  isPablo,
  isTrump,
  isTuerto,
  sortValue,
  trickWinnerIndex,
  trumpPower,
} from './cards';
import { Action, SenaId, teamOf } from './types';
import { PlayerView } from './view';

/** Fuerza aproximada de una mano (0 = nada, ~1 = muy fuerte). */
export function handStrength(cards: Card[], trump: Suit): number {
  let s = 0;
  for (const c of cards) {
    if (isTrump(c, trump)) {
      const p = trumpPower(c, trump);
      s += p >= 97 ? 0.35 : p >= 94 ? 0.2 : 0.12;
    } else if (c.rank === 12) s += 0.06;
  }
  return Math.min(1, s);
}

const lowest = (cards: Card[], trump: Suit) => cards.slice().sort((a, b) => sortValue(a, trump) - sortValue(b, trump))[0];
const highest = (cards: Card[], trump: Suit) => cards.slice().sort((a, b) => sortValue(b, trump) - sortValue(a, trump))[0];

/** Seña que haría el bot a su compañero al empezar la mano: su mejor triunfo. */
export function botSena(cards: Card[], trump: Suit): SenaId {
  const trumps = cards.filter((c) => isTrump(c, trump));
  if (trumps.length === 0) return 'nada';
  const best = highest(trumps, trump);
  if (isPablo(best)) return 'pablo';
  if (isTuerto(best)) return 'tuerto';
  const map: Record<number, SenaId> = { 3: 'andorra', 2: 'malilla', 12: 'rey', 11: 'caballo', 10: 'sota', 1: 'as' };
  return map[best.rank] ?? 'bajas';
}

export function chooseBotAction(v: PlayerView, rng: Rng = Math.random): Action | null {
  const me = v.you;
  if (me === null) return null;

  if (v.phase === 'deal') {
    if (v.canDeal) {
      // El bot repartidor acepta la carteta pedida la mitad de las veces.
      if (v.cartetaRequest !== null && v.canDealCarteta && rng() < 0.5) return { type: 'deal', carteta: true };
      return { type: 'deal' };
    }
    return null;
  }

  const h = v.hand;
  if (!h || v.phase !== 'hand') return null;
  const trump = h.trump;
  const mine = h.myCards;

  if (h.canDecideQuiero) {
    const all = mine.concat(h.partnerTrumps.flatMap((p) => p.cards));
    return { type: 'quiero', play: handStrength(all, trump) >= 0.45 || rng() < 0.25 };
  }

  if (h.canRespond && h.pendingBet) {
    const myTeam = teamOf(me);
    const tricksAhead = h.wins[myTeam] - h.wins[1 - myTeam];
    const s = handStrength(mine, trump) + tricksAhead * 0.2;
    const need = 0.25 + (h.pendingBet.value - v.config.firstBetValue) * 0.08;
    // Si el rival está al quiero, cualquier mano le da el cuerno: aceptar no cuesta más.
    const rivalAlQuiero = h.quieroTeams.includes(h.pendingBet.team);
    return { type: s >= need || rivalAlQuiero || rng() < 0.15 ? 'accept' : 'reject' };
  }

  if (h.phase !== 'playing' || h.turn !== me) return null;

  // Apostar si la mano es fuerte (o algo de farol).
  if (h.canBet) {
    const myTeam = teamOf(me);
    const s = handStrength(mine, trump) + (h.wins[myTeam] - h.wins[1 - myTeam]) * 0.2;
    const rivalAlQuiero = h.quieroTeams.length > 0 && !h.quieroTeams.includes(myTeam);
    if ((s > 0.6 && h.stake < 4) || (rivalAlQuiero && s > 0.3) || rng() < 0.04) return { type: 'bet' };
  }

  const legal = mine.filter((c) => h.legal.includes(cardId(c)));
  if (legal.length === 0) return null;

  // Salir.
  if (h.trick.length === 0) {
    const trumps = mine.filter((c) => isTrump(c, trump));
    if (trumps.length >= 3 && trumps.some((c) => trumpPower(c, trump) >= 98)) return { type: 'play', card: highest(trumps, trump) };
    const kings = legal.filter((c) => !isTrump(c, trump) && c.rank === 12);
    if (kings.length) return { type: 'play', card: kings[0] };
    const plain = legal.filter((c) => !isTrump(c, trump));
    return { type: 'play', card: lowest(plain.length ? plain : legal, trump) };
  }

  // Asistir.
  const winIdx = trickWinnerIndex(h.trick, trump);
  const winning = h.trick[winIdx];
  const partnerWinning = teamOf(winning.seat) === teamOf(me);
  const isLast = h.trick.length === h.seats.length - 1;
  const beats = legal.filter((c) => trickWinnerIndex([...h.trick, { seat: me, card: c }], trump) === h.trick.length);

  if (partnerWinning) {
    const strongEnough = isTrump(winning.card, trump) ? trumpPower(winning.card, trump) >= 96 : winning.card.rank === 12;
    if (isLast || strongEnough || beats.length === 0) {
      const plain = legal.filter((c) => !isTrump(c, trump));
      return { type: 'play', card: lowest(plain.length ? plain : legal, trump) };
    }
  }
  if (beats.length) return { type: 'play', card: lowest(beats, trump) };
  const plain = legal.filter((c) => !isTrump(c, trump));
  return { type: 'play', card: lowest(plain.length ? plain : legal, trump) };
}

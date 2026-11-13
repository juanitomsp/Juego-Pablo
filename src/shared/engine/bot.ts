/**
 * Jugador automático sencillo. Solo ve lo mismo que vería un humano (PlayerView).
 * Heurísticas documentadas en docs/ARQUITECTURA.md §Bots.
 */
import {
  Card,
  Rng,
  Suit,
  cardId,
  isTrump,
  sortValue,
  trickWinnerIndex,
  trumpPower,
} from './cards';
import { Action, teamOf } from './types';
import { PlayerView } from './view';
import { chooseCard, winProbability } from './smartBot';

/** Nivel de los bots: fácil (reglas sencillas), normal y difícil (simulan la mano muchas veces). */
export type BotLevel = 'facil' | 'normal' | 'dificil';
const ROLLOUTS: Record<Exclude<BotLevel, 'facil'>, number> = { normal: 140, dificil: 360 };

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

export function chooseBotAction(v: PlayerView, rng: Rng = Math.random, level: BotLevel = 'normal'): Action | null {
  return level === 'facil' ? chooseSimpleAction(v, rng) : chooseSmartAction(v, rng, ROLLOUTS[level]);
}

/**
 * Bot listo: decide simulando la mano (ver smartBot.ts).
 * - Al quiero: juega si tiene al menos un 35 % de ganar.
 * - Ante una apuesta: compara lo que pierde si no quiere (lo que vale ahora) con lo que espera ganar o
 *   perder si quiere (valor de la apuesta × (2·p − 1)).
 * - Apuesta si tiene muchas opciones (o si el rival está al quiero y está igualado), con algún farol.
 */
function chooseSmartAction(v: PlayerView, rng: Rng, rollouts: number): Action | null {
  const me = v.you;
  if (me === null) return null;
  if (v.phase === 'deal') return v.canDeal ? { type: 'deal' } : null;
  const h = v.hand;
  if (!h || v.phase !== 'hand') return null;
  const myTeam = teamOf(me);

  if (h.canDecideQuiero) return { type: 'quiero', play: winProbability(h, me, rng, rollouts) >= 0.35 };

  if (h.canRespond && h.pendingBet) {
    if (h.quieroTeams.includes(h.pendingBet.team)) return { type: 'accept' }; // si no queremos, ganan el cuerno igual
    const p = winProbability(h, me, rng, rollouts);
    if (h.quieroTeams.includes(myTeam)) return { type: p >= 0.3 ? 'accept' : 'reject' };
    const acceptEV = h.pendingBet.value * (2 * p - 1);
    const rejectEV = -h.stake;
    return { type: acceptEV >= rejectEV ? 'accept' : 'reject' };
  }

  if (h.phase !== 'playing' || h.turn !== me) return null;
  const legal = h.myCards.filter((c) => h.legal.includes(cardId(c)) && !h.renuncio.includes(cardId(c)));
  if (legal.length === 0) return null;
  const { card, p } = chooseCard(h, me, legal, rng, { rollouts });

  if (h.canBet && !h.quieroTeams.includes(myTeam)) {
    const prob = p >= 0 ? p : winProbability(h, me, rng, rollouts);
    if (wantsToBet(v, myTeam, prob, rng)) return { type: 'bet' };
  }
  return { type: 'play', card };
}

/**
 * ¿Subir la apuesta? Sube si va ganando con claridad (o algún farol con la mano barata), pero para que no
 * se convierta en apostar en cada turno:
 * - como mucho una subida por equipo en cada baza (si el compañero ya subió en esta baza, no repite);
 * - para volver a subir, su equipo tiene que haber ganado alguna baza desde su última subida
 *   (como en la mesa: se sube otra vez cuando algo ha cambiado a tu favor).
 * Si el rival está al quiero, sube siempre que esté igualado: cualquier mano les da el cuerno.
 */
function wantsToBet(v: PlayerView, myTeam: number, prob: number, rng: Rng): boolean {
  const h = v.hand!;
  if (h.quieroTeams.length > 0) return prob > 0.45;
  if (h.bets.some((b) => b.trickIndex === h.trickIndex && teamOf(b.seat) === myTeam)) return false;
  const ours = h.bets.filter((b) => teamOf(b.seat) === myTeam);
  if (ours.length > 0) {
    const last = ours[ours.length - 1];
    if (!h.tricks.some((t) => t.index >= last.trickIndex && teamOf(t.winner) === myTeam)) return false;
  }
  return prob > 0.68 || (prob > 0.42 && rng() < 0.04);
}

/** Bot fácil: reglas sencillas, sin simular. */
function chooseSimpleAction(v: PlayerView, rng: Rng = Math.random): Action | null {
  const me = v.you;
  if (me === null) return null;

  if (v.phase === 'deal') {
    return v.canDeal ? { type: 'deal' } : null;
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

  // El bot nunca hace renuncio: en un arrastre echa triunfo si lo tiene.
  const legal = mine.filter((c) => h.legal.includes(cardId(c)) && !h.renuncio.includes(cardId(c)));
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

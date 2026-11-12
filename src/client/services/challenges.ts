/**
 * Retos diarios contra bots: cada día tocan 3 retos (los mismos para todo el mundo ese día).
 * Se comprueban solos mientras juegas contra bots. El progreso y la racha se guardan solo en este dispositivo.
 */
import { isPablo, isTuerto, teamOf, type BotLevel, type MatchState } from '../../shared/engine';
import type { Card, Suit } from '../../shared/engine';

const KEY = 'pablo.retos';
/** En la práctica, tú siempre eres el asiento 0 (equipo 0). */
const ME = 0;
const MY_TEAM = teamOf(ME);

type TrickCheck = (card: Card, trump: Suit) => boolean;

export interface Challenge {
  id: string;
  /** Texto en español (se traduce al mostrarlo). */
  title: string;
  /** Baza ganada por ti con esa carta. */
  trick?: TrickCheck;
  /** Mano terminada. */
  hand?: (r: MatchState['history'][number]) => boolean;
  /** Partida terminada (ganada por tu equipo). */
  match?: (m: MatchState, level: BotLevel) => boolean;
}

export const CHALLENGES: Challenge[] = [
  { id: 'baza-pablo', title: 'Gana una baza con el Pablo', trick: (c) => isPablo(c) },
  { id: 'baza-tuerto', title: 'Gana una baza con el Tuerto', trick: (c) => isTuerto(c) },
  { id: 'baza-malilla', title: 'Gana una baza con la Melilla (el 2 de triunfo)', trick: (c, t) => c.suit === t && c.rank === 2 && !isPablo(c) },
  { id: 'baza-andorra', title: 'Gana una baza con el Andorra (el 3 de triunfo)', trick: (c, t) => c.suit === t && c.rank === 3 },
  { id: 'baza-as', title: 'Gana una baza con un as que no sea de triunfo', trick: (c, t) => c.rank === 1 && c.suit !== t },
  { id: 'mano-limpia', title: 'Gana una mano sin perder ninguna baza', hand: (r) => r.result.winner === MY_TEAM && r.wins[MY_TEAM] >= 3 && r.wins[1 - MY_TEAM] === 0 },
  { id: 'mano-4', title: 'Gana una mano que valga 4 puntos o más', hand: (r) => r.result.winner === MY_TEAM && r.result.points >= 4 },
  {
    id: 'apuesta',
    title: 'Apuesta tú y gana esa mano',
    hand: (r) => r.result.winner === MY_TEAM && r.bets.some((b) => b.seat === ME),
  },
  { id: 'rechazo', title: 'Haz que los rivales no quieran tu apuesta', hand: (r) => r.result.reason === 'rechazo' && r.result.winner === MY_TEAM },
  { id: 'cuerno', title: 'Gana un cuerno', hand: (r) => r.cuernoWonBy === MY_TEAM },
  { id: 'partida', title: 'Gana una partida', match: () => true },
  { id: 'partida-normal', title: 'Gana una partida en nivel Normal o Difícil', match: (_m, l) => l !== 'facil' },
  { id: 'partida-dificil', title: 'Gana una partida en nivel Difícil', match: (_m, l) => l === 'dificil' },
  { id: 'paliza', title: 'Gana una partida sin que los bots ganen ningún cuerno', match: (m) => m.cuernos[1 - MY_TEAM] === 0 },
];

const todayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Los 3 retos del día: siempre uno de baza, uno de mano y uno de partida, elegidos por la fecha. */
export function todaysChallenges(date = new Date()): Challenge[] {
  const key = todayKey(date);
  let seed = 0;
  for (const ch of key) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const pick = (list: Challenge[], salt: number) => list[(seed + salt * 7919) % list.length];
  return [pick(CHALLENGES.filter((c) => c.trick), 1), pick(CHALLENGES.filter((c) => c.hand), 2), pick(CHALLENGES.filter((c) => c.match), 3)];
}

interface Saved {
  day: string;
  done: string[];
  /** Racha: días seguidos con al menos un reto conseguido. */
  streak: number;
  lastDay: string | null;
  total: number;
}

function load(): Saved {
  const fresh: Saved = { day: todayKey(), done: [], streak: 0, lastDay: null, total: 0 };
  try {
    const s = { ...fresh, ...(JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Saved> | null) };
    if (s.day !== fresh.day) {
      s.day = fresh.day;
      s.done = [];
    }
    // Si ayer no se consiguió ninguno, la racha se rompe.
    const yesterday = todayKey(new Date(Date.now() - 86_400_000));
    if (s.lastDay && s.lastDay !== fresh.day && s.lastDay !== yesterday) s.streak = 0;
    return s;
  } catch {
    return fresh;
  }
}

export function challengeProgress() {
  const s = load();
  return { list: todaysChallenges().map((c) => ({ ...c, done: s.done.includes(c.id) })), streak: s.streak, total: s.total };
}

function complete(id: string): boolean {
  const s = load();
  if (s.done.includes(id)) return false;
  s.done.push(id);
  s.total++;
  if (s.lastDay !== s.day) {
    s.streak++;
    s.lastDay = s.day;
  }
  localStorage.setItem(KEY, JSON.stringify(s));
  return true;
}

/** Vigila una partida contra bots y marca los retos del día que se consiguen. */
export class ChallengeTracker {
  private seenTricks = new Map<number, number>();
  private seenHands = 0;
  private finishedSeen = false;
  private today = todaysChallenges();

  constructor(
    private level: BotLevel,
    private onDone: (c: Challenge) => void,
  ) {}

  update(m: MatchState) {
    const h = m.hand;
    if (h) {
      const from = this.seenTricks.get(m.handNumber) ?? 0;
      for (const t of h.tricks.slice(from)) {
        if (t.winner !== ME) continue;
        const mine = t.plays.find((p) => p.seat === ME);
        if (!mine) continue;
        // La baza la ganas tú: tu carta es la ganadora.
        for (const c of this.today) if (c.trick?.(mine.card, h.trump)) this.mark(c);
      }
      this.seenTricks.set(m.handNumber, h.tricks.length);
    }
    for (const r of m.history.slice(this.seenHands)) for (const c of this.today) if (c.hand?.(r)) this.mark(c);
    this.seenHands = m.history.length;
    if (m.phase === 'finished' && !this.finishedSeen) {
      this.finishedSeen = true;
      if (m.winner === MY_TEAM) for (const c of this.today) if (c.match?.(m, this.level)) this.mark(c);
    }
  }

  private mark(c: Challenge) {
    if (complete(c.id)) this.onDone(c);
  }
}

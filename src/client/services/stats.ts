/**
 * Estadísticas del jugador. Se guardan solo en este dispositivo (localStorage): no salen de él.
 */
import { PlayerView, Team, teamOf } from '../../shared/engine';

export interface MatchSummary {
  id: string;
  /** ISO 8601 */
  date: string;
  mode: 'online' | 'practica' | 'vivo';
  players: number;
  won: boolean | null;
  pablos: [number, number];
  hands: number;
  handsWon: number;
  tricksWon: number;
  betsMade: number;
  betsWon: number;
}

const KEY = 'pablo.matches';

export function loadLocalMatches(): MatchSummary[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as MatchSummary[];
  } catch {
    return [];
  }
}

function saveLocal(list: MatchSummary[]) {
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, 500)));
}

export async function recordMatch(m: MatchSummary): Promise<void> {
  const list = loadLocalMatches();
  if (list.some((x) => x.id === m.id)) return;
  saveLocal([m, ...list]);
}

export async function loadMatches(): Promise<MatchSummary[]> {
  return loadLocalMatches();
}

export function clearLocalMatches() {
  localStorage.removeItem(KEY);
}

/** Resumen de una partida terminada desde el punto de vista de `you`. */
export function summarize(v: PlayerView, mode: MatchSummary['mode'], id: string): MatchSummary | null {
  if (v.you === null || v.winner === null) return null;
  const me = v.you;
  const myTeam: Team = teamOf(me);
  const mine = v.seatStats[me];
  const pablos: [number, number] = [v.pablos[myTeam], v.pablos[1 - myTeam]];
  return {
    id,
    date: new Date().toISOString(),
    mode,
    players: v.config.players,
    won: v.winner === myTeam,
    pablos,
    hands: v.handNumber,
    handsWon: v.history.filter((h) => h.result.winner === myTeam).length,
    tricksWon: mine?.tricksWon ?? 0,
    betsMade: mine?.betsMade ?? 0,
    betsWon: mine?.betsWon ?? 0,
  };
}

export interface Aggregate {
  played: number;
  won: number;
  lost: number;
  winRate: number;
  tricks: number;
  bets: number;
  betsWon: number;
  byMode: Record<string, number>;
}

export function aggregate(list: MatchSummary[]): Aggregate {
  const decided = list.filter((m) => m.won !== null);
  const won = decided.filter((m) => m.won).length;
  const byMode: Record<string, number> = {};
  for (const m of list) byMode[m.mode] = (byMode[m.mode] ?? 0) + 1;
  return {
    played: list.length,
    won,
    lost: decided.length - won,
    winRate: decided.length ? Math.round((won / decided.length) * 100) : 0,
    tricks: list.reduce((s, m) => s + m.tricksWon, 0),
    bets: list.reduce((s, m) => s + m.betsMade, 0),
    betsWon: list.reduce((s, m) => s + m.betsWon, 0),
    byMode,
  };
}

/**
 * Estadísticas del jugador. Siempre se guardan en el navegador; si hay sesión iniciada con Google,
 * también en Firestore (services/firebase.ts).
 */
import { PlayerView, Team, teamOf } from '../../shared/engine';
import { AccountUser, firebaseEnabled, loadRemoteMatches, saveRemoteMatch } from './firebase';

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

let currentUser: AccountUser | null = null;
export const setStatsUser = (u: AccountUser | null) => (currentUser = u);

export async function recordMatch(m: MatchSummary): Promise<void> {
  const list = loadLocalMatches();
  if (list.some((x) => x.id === m.id)) return;
  saveLocal([m, ...list]);
  if (firebaseEnabled && currentUser) {
    try {
      await saveRemoteMatch(currentUser.uid, m);
    } catch (e) {
      console.warn('No se pudo guardar la partida en la nube', e);
    }
  }
}

/** Sube a la cuenta las partidas guardadas en este navegador. */
export async function uploadLocalMatches(uid: string): Promise<number> {
  const list = loadLocalMatches();
  for (const m of list) await saveRemoteMatch(uid, m);
  return list.length;
}

export async function loadMatches(): Promise<MatchSummary[]> {
  if (firebaseEnabled && currentUser) {
    try {
      return await loadRemoteMatches(currentUser.uid);
    } catch (e) {
      console.warn('No se pudieron leer las partidas de la nube', e);
    }
  }
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

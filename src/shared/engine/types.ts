import type { Card } from './cards';

export type Team = 0 | 1;
/** Los equipos se sientan alternos: asientos pares = equipo 0, impares = equipo 1. */
export const teamOf = (seat: number): Team => (seat % 2) as Team;
export const otherTeam = (t: Team): Team => (t === 0 ? 1 : 0);

export interface GameConfig {
  /** 4 o 6 jugadores (2 equipos). */
  players: 4 | 6;
  /** Puntos para ganar un cuerno. */
  pointsPerCuerno: number;
  /** Cuernos para ganar un Pablo. */
  cuernosPerPablo: number;
  /** Pablos para ganar la partida. */
  pablosToWin: number;
  /** Valor de una mano sin apuestas (y de retirarse ante la primera apuesta). */
  handValue: number;
  /** Valor de la mano si se acepta la primera apuesta. */
  firstBetValue: number;
  /** Lo que sube cada apuesta posterior. */
  raiseStep: number;
  /** Tope de valor de una mano. */
  maxStake: number;
  /** Permitir jugar carteta. */
  carteta: boolean;
  /** Permitir señas entre compañeros. */
  senas: boolean;
  teamNames: [string, string];
}

export const DEFAULT_CONFIG: GameConfig = {
  players: 4,
  pointsPerCuerno: 8,
  cuernosPerPablo: 2,
  pablosToWin: 1,
  handValue: 1,
  firstBetValue: 2,
  raiseStep: 1,
  maxStake: 8,
  carteta: true,
  senas: true,
  teamNames: ['Nosotros', 'Ellos'],
};

export type Action =
  | { type: 'deal'; carteta?: boolean }
  | { type: 'requestCarteta' }
  | { type: 'play'; card: Card }
  | { type: 'bet' }
  | { type: 'accept' }
  | { type: 'reject' }
  | { type: 'fold' }
  | { type: 'quiero'; play: boolean };

export class RuleError extends Error {}

/** Señas permitidas entre compañeros (docs/REGLAS.md §7). */
export const SENAS = [
  { id: 'pablo', label: 'Pablo', gesture: 'Limpia la mesa con la mano' },
  { id: 'tuerto', label: 'Tuerto', gesture: 'Guiña un ojo' },
  { id: 'nada', label: 'No llevo vira', gesture: 'Deja las cartas sobre la mesa' },
] as const;
export type SenaId = (typeof SENAS)[number]['id'];

/** Mensajes rápidos predefinidos (sin chat libre: no hay contenido de usuarios que moderar). */
export const QUICK_MESSAGES = [
  '¡Hola!',
  '¡Buena suerte!',
  '¡Bien jugado!',
  '¡Ver dío!',
  'Uy...',
  '¡Vamos!',
  'Un momento, por favor',
  '¡Buena partida!',
] as const;

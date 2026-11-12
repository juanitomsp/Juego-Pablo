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
  teamNames: ['Nosotros', 'Ellos'],
};

export type Action =
  | { type: 'deal' }
  | { type: 'play'; card: Card }
  | { type: 'bet' }
  | { type: 'accept' }
  | { type: 'reject' }
  | { type: 'quiero'; play: boolean };

export class RuleError extends Error {}

/**
 * Frases rápidas para la mesa. No hay chat libre: así nadie puede insultar ni «cantar» sus cartas,
 * y el juego no tiene contenido escrito por usuarios que moderar.
 */
export const QUICK_MESSAGES = [
  // Para decidir en equipo
  '¿Queremos?',
  'Quiero',
  'No quiero',
  'Voy bien',
  'Voy flojo',
  'Tú decides',
  '¡Apuesta!',
  'Mejor no',
  // Para la mesa
  '¡Hola!',
  '¡Buena suerte!',
  '¡Bien jugado!',
  '¡Ver dío!',
  'Uy...',
  '¡Vamos!',
  'Un momento, por favor',
  '¡Buena partida!',
] as const;

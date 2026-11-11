/**
 * Contrato entre cliente y servidor (Socket.IO). Documentado en docs/PROTOCOLO.md.
 */
import type { Action, GameConfig } from './engine/types';
import type { PlayerView } from './engine/view';

export interface SeatInfo {
  seat: number;
  name: string | null;
  bot: boolean;
  connected: boolean;
  isYou: boolean;
  isHost: boolean;
}

export interface RoomInfo {
  code: string;
  config: GameConfig;
  seats: SeatInfo[];
  started: boolean;
  youAreHost: boolean;
  /** Tu asiento, o null si estás mirando. */
  yourSeat: number | null;
  /** Resultado del último sorteo por reyes (nombres en orden de salida del rey). */
  kingDraw: string[] | null;
}

export interface RoomState {
  room: RoomInfo;
  view: PlayerView | null;
}

export interface QuickMessage {
  from: number;
  text: string;
  at: number;
}

export type Ack<T = object> = (res: ({ ok: true } & T) | { ok: false; error: string }) => void;

export interface ClientToServer {
  'room:create': (p: { name: string; playerId: string; config: Partial<GameConfig> }, ack: Ack<{ code: string }>) => void;
  'room:join': (p: { code: string; name: string; playerId: string }, ack: Ack<{ code: string }>) => void;
  'room:leave': () => void;
  'room:sit': (p: { seat: number }, ack: Ack) => void;
  'room:addBot': (p: { seat: number }, ack: Ack) => void;
  'room:clearSeat': (p: { seat: number }, ack: Ack) => void;
  'room:config': (p: Partial<GameConfig>, ack: Ack) => void;
  'room:drawTeams': (ack: Ack) => void;
  'room:start': (ack: Ack) => void;
  'room:replaceWithBot': (p: { seat: number }, ack: Ack) => void;
  'game:action': (a: Action, ack: Ack) => void;
  'game:quick': (p: { index: number }) => void;
  /** Mensaje libre para toda la mesa; el servidor tacha las referencias a cartas. */
  'game:chat': (p: { text: string }) => void;
  'game:rematch': (ack: Ack) => void;
}

export interface ServerToClient {
  state: (s: RoomState) => void;
  quick: (m: QuickMessage) => void;
  kicked: (reason: string) => void;
}

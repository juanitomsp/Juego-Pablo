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
  /** Personas mirando la partida sin jugar (conectadas). */
  spectators: number;
  /** Sala pública: aparece en la lista de partidas públicas y puede entrar cualquiera. */
  isPublic: boolean;
  /** Mesa pública esperando: si no entra nadie más, empieza sola con bots en este momento (ms epoch). */
  autoStartAt: number | null;
  /** Quién está en la llamada de voz de la sala (solo jugadores sentados). */
  voice: VoicePeer[];
}

/** Participante de la llamada de voz. `id` es el de su conexión (no identifica a la persona). */
export interface VoicePeer {
  id: string;
  seat: number;
  muted: boolean;
}

/** Descripción de sesión WebRTC (oferta o respuesta), con todos sus candidatos dentro. */
export interface VoiceSdp {
  type: 'offer' | 'answer';
  sdp: string;
}

/** Entrada de la lista de partidas públicas (GET /api/salas). Sin nombres: solo lo necesario para elegir. */
export interface PublicRoom {
  code: string;
  players: 4 | 6;
  /** Asientos ocupados (personas o bots). */
  seated: number;
  started: boolean;
  spectators: number;
  /** Marcador de la partida en curso: puntos de cada equipo. */
  score: [number, number] | null;
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
  'room:create': (
    p: { name: string; playerId: string; config: Partial<GameConfig>; isPublic?: boolean },
    ack: Ack<{ code: string }>,
  ) => void;
  /** watch: entrar solo a mirar (no se sienta aunque haya sitio). */
  'room:join': (p: { code: string; name: string; playerId: string; watch?: boolean }, ack: Ack<{ code: string }>) => void;
  /** Partida rápida: te sienta en la primera mesa pública con sitio o crea una. */
  'room:quick': (p: { name: string; playerId: string }, ack: Ack<{ code: string }>) => void;
  /** ¿Sigo teniendo asiento en una partida en curso? (para «Volver a tu partida»). */
  'room:mine': (p: { code: string; playerId: string }, ack: Ack<{ active: boolean }>) => void;
  /** Reportar a un jugador de la mesa por mal comportamiento. */
  'room:report': (p: { seat: number }, ack: Ack<{ message: string }>) => void;
  /** El anfitrión hace la sala pública o privada. */
  'room:visibility': (p: { isPublic: boolean }, ack: Ack) => void;
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
  /** Mensaje libre para la mesa: se envía tal cual (solo se limpia el texto). */
  'game:chat': (p: { text: string }, ack: Ack) => void;
  'game:rematch': (ack: Ack) => void;
  /**
   * Llamada de voz de la sala. El servidor solo presenta a los participantes (les pasa sus ofertas y respuestas);
   * el audio va directo de un jugador a otro y no pasa por el servidor.
   */
  'voice:join': (ack: Ack<{ iceServers: { urls: string | string[]; username?: string; credential?: string }[] }>) => void;
  'voice:leave': () => void;
  'voice:mute': (p: { muted: boolean }) => void;
  'voice:signal': (p: { to: string; sdp: VoiceSdp }) => void;
}

export interface ServerToClient {
  state: (s: RoomState) => void;
  quick: (m: QuickMessage) => void;
  kicked: (reason: string) => void;
  'voice:signal': (p: { from: string; sdp: VoiceSdp }) => void;
}

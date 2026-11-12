/**
 * Un "controlador" de partida abstrae si se juega online (Socket.IO) o en local (práctica con bots).
 * La mesa (components/Table.tsx) solo habla con esta interfaz.
 */
import { io, Socket } from 'socket.io-client';
import {
  Action,
  DEFAULT_CONFIG,
  GameConfig,
  QUICK_MESSAGES,
  RuleError,
  getView,
} from '../../shared/engine';
import type { ClientToServer, QuickMessage, RoomState, ServerToClient } from '../../shared/protocol';
import { GameTable } from '../../shared/table';
import { censorChat, containsInsult } from '../../shared/chat';
import { getName, getPlayerId } from './identity';

export interface ControllerSnapshot {
  state: RoomState | null;
  quicks: QuickMessage[];
  connected: boolean;
}

export interface Controller {
  readonly mode: 'online' | 'practica';
  snapshot(): ControllerSnapshot;
  subscribe(cb: () => void): () => void;
  act(a: Action): Promise<string | null>;
  quick(i: number): void;
  /** Envía un mensaje al chat. Devuelve un aviso si no se ha enviado (insultos, demasiado rápido…). */
  chat(text: string): Promise<string | null>;
  rematch(): Promise<string | null>;
  dispose(): void;
}

abstract class Base {
  protected snap: ControllerSnapshot = { state: null, quicks: [], connected: true };
  private subs = new Set<() => void>();
  snapshot() {
    return this.snap;
  }
  subscribe(cb: () => void) {
    this.subs.add(cb);
    return () => {
      this.subs.delete(cb);
    };
  }
  protected update(patch: Partial<ControllerSnapshot>) {
    this.snap = { ...this.snap, ...patch };
    this.subs.forEach((s) => s());
  }
  protected pushQuick(m: QuickMessage) {
    this.update({ quicks: [...this.snap.quicks.slice(-19), m] });
  }
}

// ---------------------------------------------------------------- Online

type PabloSocket = Socket<ServerToClient, ClientToServer>;
let sharedSocket: PabloSocket | null = null;
export function getSocket(): PabloSocket {
  // VITE_SERVER_URL: si el cliente se aloja aparte (p. ej. Vercel) y el servidor en otro sitio (Render, Fly...).
  const url = import.meta.env.VITE_SERVER_URL as string | undefined;
  const opts = { autoConnect: true, transports: ['websocket', 'polling'] };
  if (!sharedSocket) sharedSocket = url ? io(url, opts) : io(opts);
  return sharedSocket;
}

type AckRes = { ok: true } | { ok: false; error: string };
const ackError = (r: AckRes) => (r.ok ? null : r.error);

export class OnlineController extends Base implements Controller {
  readonly mode = 'online' as const;
  private socket = getSocket();
  private code: string;
  private handlers: Array<[string, (...a: never[]) => void]> = [];

  constructor(code: string) {
    super();
    this.code = code.toUpperCase();
    const on = <E extends keyof ServerToClient>(ev: E, fn: ServerToClient[E]) => {
      this.socket.on(ev, fn as never);
      this.handlers.push([ev, fn as never]);
    };
    on('state', (s) => {
      if (s.room.code === this.code) this.update({ state: s });
    });
    on('quick', (m) => this.pushQuick(m));
    on('kicked', (reason) => {
      this.kickedReason = reason;
      this.update({});
    });
    const onConnect = () => {
      this.update({ connected: true });
      this.join();
    };
    const onDisconnect = () => this.update({ connected: false });
    this.socket.on('connect', onConnect);
    this.socket.on('disconnect', onDisconnect);
    this.handlers.push(['connect', onConnect], ['disconnect', onDisconnect]);
    this.snap.connected = this.socket.connected;
    if (this.socket.connected) this.join();
  }

  joinError: string | null = null;
  /** Motivo si el servidor nos ha expulsado de la sala. */
  kickedReason: string | null = null;
  private join() {
    this.socket.emit('room:join', { code: this.code, name: getName() || 'Jugador', playerId: getPlayerId() }, (r) => {
      if (!r.ok) {
        this.joinError = r.error;
        this.update({});
      }
    });
  }

  private emitAck(ev: keyof ClientToServer, payload?: unknown): Promise<string | null> {
    return new Promise((resolve) => {
      const cb = (r: AckRes) => resolve(ackError(r));
      if (payload === undefined) (this.socket.emit as (...a: unknown[]) => void)(ev, cb);
      else (this.socket.emit as (...a: unknown[]) => void)(ev, payload, cb);
    });
  }

  act(a: Action) {
    return this.emitAck('game:action', a);
  }
  quick(i: number) {
    this.socket.emit('game:quick', { index: i });
  }
  chat(text: string) {
    return this.emitAck('game:chat', { text });
  }
  rematch() {
    return this.emitAck('game:rematch');
  }
  sit(seat: number) {
    return this.emitAck('room:sit', { seat });
  }
  addBot(seat: number) {
    return this.emitAck('room:addBot', { seat });
  }
  clearSeat(seat: number) {
    return this.emitAck('room:clearSeat', { seat });
  }
  setConfig(c: Partial<GameConfig>) {
    return this.emitAck('room:config', c);
  }
  drawTeams() {
    return this.emitAck('room:drawTeams');
  }
  start() {
    return this.emitAck('room:start');
  }
  replaceWithBot(seat: number) {
    return this.emitAck('room:replaceWithBot', { seat });
  }
  leave() {
    this.socket.emit('room:leave');
  }
  dispose() {
    for (const [ev, fn] of this.handlers) this.socket.off(ev as never, fn as never);
  }
}

export function createRoom(config: Partial<GameConfig>): Promise<{ code?: string; error?: string }> {
  const socket = getSocket();
  return new Promise((resolve) => {
    const go = () =>
      socket.emit('room:create', { name: getName() || 'Jugador', playerId: getPlayerId(), config }, (r) =>
        resolve(r.ok ? { code: r.code } : { error: r.error }),
      );
    if (socket.connected) go();
    else {
      const t = setTimeout(() => resolve({ error: 'No se puede conectar con el servidor.' }), 6000);
      socket.once('connect', () => {
        clearTimeout(t);
        go();
      });
    }
  });
}

// ---------------------------------------------------------------- Práctica local

const BOT_NAMES = ['Bot Paco', 'Bot Lola', 'Bot Manolo', 'Bot Carmen', 'Bot Antonio', 'Bot Rocío'];

export class LocalController extends Base implements Controller {
  readonly mode = 'practica' as const;
  private table!: GameTable;
  private config: GameConfig;

  constructor(config: Partial<GameConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config, maxStake: config.pointsPerCuerno ?? DEFAULT_CONFIG.pointsPerCuerno };
    this.newTable(Math.floor(Math.random() * this.config.players));
  }

  private newTable(dealer: number) {
    this.table?.dispose();
    const n = this.config.players;
    const bots = Array.from({ length: n - 1 }, (_, i) => i + 1);
    this.table = new GameTable(this.config, dealer, bots, {
      onChange: () => this.emitState(),
    });
    this.emitState();
  }

  private emitState() {
    const n = this.config.players;
    const name = getName() || 'Tú';
    this.update({
      state: {
        room: {
          code: 'LOCAL',
          config: this.config,
          seats: Array.from({ length: n }, (_, i) => ({
            seat: i,
            name: i === 0 ? name : BOT_NAMES[i % BOT_NAMES.length],
            bot: i !== 0,
            connected: true,
            isYou: i === 0,
            isHost: i === 0,
          })),
          started: true,
          youAreHost: true,
          yourSeat: 0,
          kingDraw: null,
        },
        view: getView(this.table.match, 0),
      },
    });
  }

  async act(a: Action) {
    try {
      this.table.act(0, a);
      return null;
    } catch (e) {
      return e instanceof RuleError ? e.message : 'Error inesperado.';
    }
  }
  quick(i: number) {
    const text = QUICK_MESSAGES[i];
    if (text) this.pushQuick({ from: 0, text, at: Date.now() });
  }
  async chat(text: string) {
    if (containsInsult(text)) return 'No se puede insultar: tu mensaje no se ha enviado.';
    const clean = censorChat(text);
    if (clean) this.pushQuick({ from: 0, text: clean, at: Date.now() });
    return null;
  }
  async rematch() {
    this.newTable((this.table.match.dealer + 1) % this.config.players);
    return null;
  }
  resume() {
    this.table.resume();
  }
  dispose() {
    this.table.dispose();
  }
}

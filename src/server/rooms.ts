/**
 * Salas de juego en memoria. Cada sala tiene asientos (humanos o bots) y, al empezar, una GameTable.
 * No se guarda ningún dato personal: solo el apodo que elige el jugador mientras dure la sala.
 */
import { DEFAULT_CONFIG, GameConfig, QUICK_MESSAGES, RuleError, drawTeamsByKings, getView } from '../shared/engine';
import type { PublicRoom, RoomState, SeatInfo, VoicePeer } from '../shared/protocol';
import { GameTable } from '../shared/table';
import { cleanChat, containsInsult } from '../shared/chat';
import { randomInt, webcrypto } from 'node:crypto';

/** Azar criptográfico para barajar: el reparto no se puede predecir a partir de partidas anteriores. */
export const secureRng = () => webcrypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;

export interface Seat {
  playerId: string | null;
  name: string | null;
  bot: boolean;
}

export interface Member {
  playerId: string;
  name: string;
  socketIds: Set<string>;
}

export interface RoomHooks {
  /** Envía el estado a todos los miembros conectados. */
  broadcast: (room: Room) => void;
  sendQuick: (room: Room, from: number, text: string) => void;
  /** Se ha expulsado a alguien: hay que avisar a sus conexiones y sacarlas de la sala. */
  onKicked?: (room: Room, socketIds: Set<string>, reason: string) => void;
  /** Estadísticas de uso anónimas (opcional). */
  usage?: {
    player: (playerId: string) => void;
    matchStarted: () => void;
    matchFinished: () => void;
    handPlayed: () => void;
    reported?: () => void;
    kicked?: () => void;
  };
  /** Espera en una mesa pública antes de rellenar con bots y empezar (por defecto, 60 s). */
  autoFillMs?: number;
}

export const AUTO_FILL_MS = 60_000;

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
/** Máximo de personas en una sala (jugadores + mirones). */
export const MAX_MEMBERS = 12;
/** Longitud del código de sala: 32^6 ≈ mil millones de combinaciones. */
export const CODE_LENGTH = 6;
const BOT_NAMES = ['Bot Paco', 'Bot Lola', 'Bot Manolo', 'Bot Carmen', 'Bot Antonio', 'Bot Rocío'];

export const sanitizeName = (raw: unknown): string => {
  const s = String(raw ?? '')
    .replace(/[\u0000-\u001f<>]/g, '')
    .trim()
    .slice(0, 20);
  // Un apodo con insultos se cambia por uno neutro.
  return s && !containsInsult(s) ? s : 'Jugador';
};

export function sanitizeConfig(base: GameConfig, patch: Partial<GameConfig>): GameConfig {
  const int = (v: unknown, min: number, max: number, def: number) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
  };
  const c = { ...base };
  if (patch.players !== undefined) c.players = patch.players === 6 ? 6 : 4;
  if (patch.pointsPerCuerno !== undefined) c.pointsPerCuerno = int(patch.pointsPerCuerno, 3, 60, 8);
  if (patch.cuernosPerPablo !== undefined) c.cuernosPerPablo = int(patch.cuernosPerPablo, 1, 5, 2);
  if (patch.pablosToWin !== undefined) c.pablosToWin = int(patch.pablosToWin, 1, 5, 1);
  if (patch.teamNames) c.teamNames = [sanitizeName(patch.teamNames[0]), sanitizeName(patch.teamNames[1])];
  c.maxStake = c.pointsPerCuerno;
  return c;
}

export class Room {
  config: GameConfig;
  seats: Seat[];
  members = new Map<string, Member>();
  /** Expulsados de esta sala (por reportes): no pueden volver a entrar. */
  private banned = new Set<string>();
  private lastChat = new Map<string, number>();
  /** Llamada de voz: conexión → quién es y si tiene el micro silenciado. El audio no pasa por el servidor. */
  private voice = new Map<string, { playerId: string; muted: boolean }>();
  table: GameTable | null = null;
  kingDraw: string[] | null = null;
  lastActivity = Date.now();
  /** Sala pública: sale en la lista y puede entrar cualquiera. Por defecto, privada (solo con el código). */
  isPublic = false;
  /** Reportes recibidos: jugador reportado → quién lo ha reportado. */
  private reports = new Map<string, Set<string>>();
  /** Mesa pública: cuándo empezará sola con bots si no entra nadie más. */
  autoStartAt: number | null = null;
  private autoTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    public code: string,
    public hostId: string,
    config: Partial<GameConfig>,
    private hooks: RoomHooks,
  ) {
    this.config = sanitizeConfig(DEFAULT_CONFIG, config);
    this.seats = this.emptySeats(this.config.players);
  }

  private emptySeats(n: number): Seat[] {
    return Array.from({ length: n }, () => ({ playerId: null, name: null, bot: false }));
  }

  touch() {
    this.lastActivity = Date.now();
  }

  seatOf(playerId: string): number | null {
    const i = this.seats.findIndex((s) => s.playerId === playerId);
    return i >= 0 ? i : null;
  }

  isConnected(playerId: string | null) {
    return !!playerId && (this.members.get(playerId)?.socketIds.size ?? 0) > 0;
  }

  join(playerId: string, name: string, socketId: string, watch = false) {
    if (this.banned.has(playerId)) throw new RuleError('Has sido expulsado de esta sala.');
    this.hooks.usage?.player(playerId);
    if (!this.members.has(playerId) && this.members.size >= MAX_MEMBERS) {
      // Hace sitio quitando a alguien desconectado que no tenga asiento; si no hay, la sala está llena.
      const gone = [...this.members.values()].find((x) => x.socketIds.size === 0 && this.seatOf(x.playerId) === null);
      if (!gone) throw new RuleError('La sala está llena.');
      this.members.delete(gone.playerId);
    }
    const m = this.members.get(playerId) ?? { playerId, name, socketIds: new Set<string>() };
    m.name = name;
    m.socketIds.add(socketId);
    this.members.set(playerId, m);
    const seat = this.seatOf(playerId);
    if (seat !== null) this.seats[seat].name = name;
    // Al entrar, se sienta automáticamente en el primer hueco libre (si no ha empezado).
    else if (!this.table && !watch) {
      const free = this.seats.findIndex((s) => !s.playerId && !s.bot);
      if (free >= 0) {
        this.seats[free] = { playerId, name, bot: false };
        this.scheduleAutoStart();
      }
    }
    this.touch();
  }

  disconnect(playerId: string, socketId: string) {
    this.members.get(playerId)?.socketIds.delete(socketId);
    this.voice.delete(socketId);
  }

  private dropVoice(playerId: string) {
    for (const [sid, v] of this.voice) if (v.playerId === playerId) this.voice.delete(sid);
  }

  /** Entrar en la llamada de voz (solo quien está sentado: los que miran no hablan, igual que en el chat). */
  voiceJoin(playerId: string, socketId: string) {
    if (this.seatOf(playerId) === null) throw new RuleError('Solo los jugadores sentados pueden entrar en la llamada.');
    if (!this.members.get(playerId)?.socketIds.has(socketId)) throw new RuleError('No estás en esta sala.');
    this.voice.set(socketId, { playerId, muted: this.voice.get(socketId)?.muted ?? false });
  }

  voiceLeave(socketId: string) {
    return this.voice.delete(socketId);
  }

  voiceMute(socketId: string, muted: boolean) {
    const v = this.voice.get(socketId);
    if (!v || v.muted === muted) return false;
    v.muted = muted;
    return true;
  }

  /** ¿Está esta conexión en la llamada (y sigue sentada)? */
  inVoice(socketId: string) {
    const v = this.voice.get(socketId);
    return !!v && this.seatOf(v.playerId) !== null;
  }

  voicePeers(): VoicePeer[] {
    const out: VoicePeer[] = [];
    for (const [id, v] of this.voice) {
      const seat = this.seatOf(v.playerId);
      if (seat !== null) out.push({ id, seat, muted: v.muted });
    }
    return out;
  }

  leave(playerId: string) {
    this.dropVoice(playerId);
    this.members.delete(playerId);
    const seat = this.seatOf(playerId);
    if (seat !== null && !this.table) {
      this.seats[seat] = { playerId: null, name: null, bot: false };
      this.scheduleAutoStart();
    }
    if (this.hostId === playerId) {
      const next = [...this.members.keys()][0];
      if (next) this.hostId = next;
    }
  }

  /** Personas conectadas que miran sin jugar. */
  get spectatorCount() {
    let n = 0;
    for (const m of this.members.values()) if (m.socketIds.size > 0 && this.seatOf(m.playerId) === null) n++;
    return n;
  }

  setVisibility(playerId: string, isPublic: boolean) {
    this.requireHost(playerId);
    this.makePublic(isPublic);
  }

  makePublic(isPublic: boolean) {
    this.isPublic = !!isPublic;
    this.scheduleAutoStart();
  }

  /** ¿Puede entrar este jugador? (no expulsado) */
  canJoin(playerId: string) {
    return !this.banned.has(playerId);
  }

  /**
   * Mesa pública en espera: si en un rato no entra nadie más, se rellenan los huecos con bots y empieza.
   * El reloj vuelve a empezar cada vez que alguien se sienta o se va.
   */
  private scheduleAutoStart() {
    if (this.autoTimer) clearTimeout(this.autoTimer);
    this.autoTimer = null;
    this.autoStartAt = null;
    if (!this.isPublic || this.table) return;
    if (!this.seats.some((s) => s.playerId)) return;
    const ms = this.hooks.autoFillMs ?? AUTO_FILL_MS;
    this.autoStartAt = Date.now() + ms;
    this.autoTimer = setTimeout(() => this.autoStart(), ms);
    this.autoTimer.unref?.();
  }

  private autoStart() {
    this.autoTimer = null;
    this.autoStartAt = null;
    if (!this.isPublic || this.table) return;
    // Los que se sentaron y ya no están conectados dejan su sitio a un bot.
    this.seats = this.seats.map((s) => (s.playerId && !this.isConnected(s.playerId) ? { playerId: null, name: null, bot: false } : s));
    if (!this.seats.some((s) => s.playerId)) return;
    this.seats.forEach((s, i) => {
      if (!s.playerId && !s.bot) this.seats[i] = { playerId: null, name: BOT_NAMES[i % BOT_NAMES.length], bot: true };
    });
    this.startTable(this.kingDraw ? 0 : randomInt(this.seats.length));
    this.hooks.broadcast(this);
  }

  /** Resumen para la lista de partidas públicas (sin apodos). */
  publicInfo(): PublicRoom {
    const m = this.table?.match;
    return {
      code: this.code,
      players: this.config.players === 6 ? 6 : 4,
      seated: this.seats.filter((s) => s.playerId || s.bot).length,
      started: !!this.table,
      spectators: this.spectatorCount,
      score: m ? [m.score[0], m.score[1]] : null,
    };
  }

  get empty() {
    return [...this.members.values()].every((m) => m.socketIds.size === 0);
  }

  private requireHost(playerId: string) {
    if (playerId !== this.hostId) throw new RuleError('Solo el anfitrión puede hacer eso.');
  }
  private requireLobby() {
    if (this.table) throw new RuleError('La partida ya ha empezado.');
  }
  private requireSeat(seat: number) {
    if (!Number.isInteger(seat) || seat < 0 || seat >= this.seats.length) throw new RuleError('Asiento no válido.');
  }

  sit(playerId: string, seat: number) {
    this.requireLobby();
    this.requireSeat(seat);
    const target = this.seats[seat];
    if (target.playerId || target.bot) throw new RuleError('Ese asiento está ocupado.');
    const current = this.seatOf(playerId);
    if (current !== null) this.seats[current] = { playerId: null, name: null, bot: false };
    this.seats[seat] = { playerId, name: this.members.get(playerId)?.name ?? 'Jugador', bot: false };
    this.kingDraw = null;
    if (current === null) this.scheduleAutoStart();
  }

  addBot(playerId: string, seat: number) {
    this.requireHost(playerId);
    this.requireLobby();
    this.requireSeat(seat);
    if (this.seats[seat].playerId || this.seats[seat].bot) throw new RuleError('Ese asiento está ocupado.');
    this.seats[seat] = { playerId: null, name: BOT_NAMES[seat % BOT_NAMES.length], bot: true };
  }

  clearSeat(playerId: string, seat: number) {
    this.requireHost(playerId);
    this.requireLobby();
    this.requireSeat(seat);
    this.seats[seat] = { playerId: null, name: null, bot: false };
    this.kingDraw = null;
  }

  setConfig(playerId: string, patch: Partial<GameConfig>) {
    this.requireHost(playerId);
    this.requireLobby();
    const prevPlayers = this.config.players;
    this.config = sanitizeConfig(this.config, patch);
    if (this.config.players !== prevPlayers) {
      const people = this.seats.filter((s) => s.playerId || s.bot);
      this.seats = this.emptySeats(this.config.players);
      people.slice(0, this.config.players).forEach((p, i) => (this.seats[i] = p));
      this.kingDraw = null;
    }
  }

  /** Sorteo de equipos por reyes: reordena los asientos y el primer rey será el mano. */
  drawTeams(playerId: string) {
    this.requireHost(playerId);
    this.requireLobby();
    if (this.seats.some((s) => !s.playerId && !s.bot)) throw new RuleError('Llena todos los asientos antes de sortear.');
    const draw = drawTeamsByKings(this.seats.length, secureRng);
    const old = this.seats;
    const next = this.emptySeats(old.length);
    draw.seatFor.forEach((seat, player) => (next[seat] = old[player]));
    this.seats = next;
    // Nombres de los que sacaron rey primero (forman el primer equipo; el primero es el mano).
    this.kingDraw = draw.kingOrder.slice(0, old.length / 2).map((p) => old[p].name ?? '?');
  }

  start(playerId: string) {
    this.requireHost(playerId);
    this.requireLobby();
    if (this.seats.some((s) => !s.playerId && !s.bot)) throw new RuleError('Faltan jugadores: añade bots o espera a que entren.');
    // Tras un sorteo por reyes, el mano es el asiento 0; si no, al azar.
    const dealer = this.kingDraw ? 0 : randomInt(this.seats.length);
    this.startTable(dealer);
  }

  private startTable(dealer: number) {
    if (this.autoTimer) clearTimeout(this.autoTimer);
    this.autoTimer = null;
    this.autoStartAt = null;
    this.table?.dispose();
    const bots = this.seats.flatMap((s, i) => (s.bot ? [i] : []));
    this.hooks.usage?.matchStarted();
    let handsCounted = 0;
    let finishedCounted = false;
    this.table = new GameTable(this.config, dealer, bots, {
      onChange: () => {
        this.touch();
        const m = this.table?.match;
        if (m && this.hooks.usage) {
          // Contadores anónimos: manos repartidas y partidas terminadas.
          while (handsCounted < m.handNumber) {
            handsCounted++;
            this.hooks.usage.handPlayed();
          }
          if (m.phase === 'finished' && !finishedCounted) {
            finishedCounted = true;
            this.hooks.usage.matchFinished();
          }
        }
        this.hooks.broadcast(this);
      },
    }, secureRng);
  }

  rematch(playerId: string) {
    if (!this.table || this.table.match.phase !== 'finished') throw new RuleError('La partida no ha terminado.');
    if (this.seatOf(playerId) === null && playerId !== this.hostId) throw new RuleError('No estás en la mesa.');
    this.startTable((this.table.match.dealer + 1) % this.seats.length);
  }

  /** El anfitrión puede sustituir a un jugador desconectado por un bot (o devolverle el sitio). */
  replaceWithBot(playerId: string, seat: number) {
    this.requireHost(playerId);
    this.requireSeat(seat);
    if (!this.table) throw new RuleError('La partida no ha empezado.');
    const s = this.seats[seat];
    if (s.bot) throw new RuleError('Ya es un bot.');
    if (this.isConnected(s.playerId)) throw new RuleError('Ese jugador sigue conectado.');
    this.seats[seat] = { playerId: null, name: `Bot (${s.name ?? 'Jugador'})`, bot: true };
    this.table.setBot(seat, true);
  }

  action(playerId: string, action: Parameters<GameTable['act']>[1]) {
    if (!this.table) throw new RuleError('La partida no ha empezado.');
    const seat = this.seatOf(playerId);
    if (seat === null) throw new RuleError('Estás mirando la partida, no jugando.');
    this.table.act(seat, action);
  }

  /**
   * Chat libre: se envía tal cual (solo se limpia el texto). No se filtran insultos: es entre amigos.
   * Devuelve un aviso para el autor, o null si se ha enviado (o no había nada que enviar).
   */
  chat(playerId: string, raw: unknown): string | null {
    const seat = this.seatOf(playerId);
    if (typeof raw !== 'string') return null;
    if (seat === null) return 'Mientras miras no puedes escribir: el chat es de los jugadores.';
    const now = Date.now();
    if (now - (this.lastChat.get(playerId) ?? 0) < 1000) return 'Espera un segundo entre mensajes.';
    const text = cleanChat(raw);
    if (!text) return null;
    this.lastChat.set(playerId, now);
    this.hooks.sendQuick(this, seat, text);
    return null;
  }

  /**
   * Reportar a otro jugador de la mesa (solo pueden hacerlo los que están sentados, a otra persona).
   * Si lo reporta la mitad o más del resto de personas de la mesa, se le expulsa (juega un bot por él).
   * No se guarda nada: el recuento vive en la sala y desaparece con ella.
   */
  report(playerId: string, seat: number): string {
    this.requireSeat(seat);
    if (this.seatOf(playerId) === null) throw new RuleError('Solo pueden reportar los jugadores de la mesa.');
    const target = this.seats[seat];
    if (!target.playerId || target.bot) throw new RuleError('A los bots no se les puede reportar.');
    if (target.playerId === playerId) throw new RuleError('No puedes reportarte a ti mismo.');
    const set = this.reports.get(target.playerId) ?? new Set<string>();
    if (set.has(playerId)) return 'Ya lo habías reportado. Lo hemos silenciado para ti.';
    set.add(playerId);
    this.reports.set(target.playerId, set);
    this.hooks.usage?.reported?.();
    const others = this.seats.filter((s) => s.playerId && s.playerId !== target.playerId).length;
    const needed = Math.max(1, Math.ceil(others / 2));
    if (set.size >= needed) {
      const name = target.name ?? 'Jugador';
      this.kick(target.playerId, 'Has sido expulsado de la mesa porque otros jugadores te han reportado.');
      return `${name} ha sido expulsado de la mesa.`;
    }
    const left = needed - set.size;
    return left > 1
      ? `Reporte enviado. Si lo reportan ${left} jugadores más, será expulsado. Mientras, lo hemos silenciado para ti.`
      : 'Reporte enviado. Si lo reporta 1 jugador más, será expulsado. Mientras, lo hemos silenciado para ti.';
  }

  /** Expulsa a un jugador: deja la sala y no puede volver. Si la partida ha empezado, juega un bot por él. */
  kick(playerId: string, reason = 'Has sido expulsado de la partida.') {
    this.hooks.usage?.kicked?.();
    this.banned.add(playerId);
    const seat = this.seatOf(playerId);
    const member = this.members.get(playerId);
    this.dropVoice(playerId);
    this.members.delete(playerId);
    if (seat !== null) {
      const name = this.seats[seat].name ?? 'Jugador';
      if (this.table) {
        this.seats[seat] = { playerId: null, name: `Bot (${name})`, bot: true };
        this.table.setBot(seat, true);
      } else {
        this.seats[seat] = { playerId: null, name: null, bot: false };
      }
    }
    if (this.hostId === playerId) {
      const next = [...this.members.keys()][0];
      if (next) this.hostId = next;
    }
    this.scheduleAutoStart();
    this.hooks.onKicked?.(this, member?.socketIds ?? new Set(), reason);
  }

  quick(playerId: string, index: number) {
    const seat = this.seatOf(playerId);
    const text = QUICK_MESSAGES[index];
    if (seat === null || !text) return;
    this.hooks.sendQuick(this, seat, text);
  }

  stateFor(playerId: string): RoomState {
    const yourSeat = this.seatOf(playerId);
    const seats: SeatInfo[] = this.seats.map((s, i) => ({
      seat: i,
      name: s.name,
      bot: s.bot,
      connected: s.bot || this.isConnected(s.playerId),
      isYou: !!s.playerId && s.playerId === playerId,
      isHost: !!s.playerId && s.playerId === this.hostId,
    }));
    return {
      room: {
        code: this.code,
        config: this.config,
        seats,
        started: !!this.table,
        youAreHost: playerId === this.hostId,
        yourSeat,
        kingDraw: this.kingDraw,
        spectators: this.spectatorCount,
        isPublic: this.isPublic,
        autoStartAt: this.autoStartAt,
        voice: this.voicePeers(),
      },
      view: this.table ? getView(this.table.match, yourSeat) : null,
    };
  }

  dispose() {
    if (this.autoTimer) clearTimeout(this.autoTimer);
    this.table?.dispose();
  }
}

export class RoomManager {
  rooms = new Map<string, Room>();
  constructor(private hooks: RoomHooks) {}

  create(hostId: string, config: Partial<GameConfig>): Room {
    let code = '';
    do {
      code = Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
    } while (this.rooms.has(code));
    const room = new Room(code, hostId, config, this.hooks);
    this.rooms.set(code, room);
    return room;
  }

  /**
   * Partidas públicas activas (con alguien conectado y sin terminar): primero las que esperan jugadores,
   * después las que se están jugando (para mirarlas).
   */
  listPublic(limit = 40): PublicRoom[] {
    const list: PublicRoom[] = [];
    for (const r of this.rooms.values()) {
      if (!r.isPublic || r.empty || r.table?.match.phase === 'finished') continue;
      list.push(r.publicInfo());
    }
    const free = (x: PublicRoom) => (!x.started && x.seated < x.players ? 0 : 1);
    return list.sort((a, b) => free(a) - free(b) || b.seated - a.seated).slice(0, limit);
  }

  /** Partida rápida: la mesa pública en espera con sitio y más gente (prefiere 2 contra 2). */
  findQuick(playerId: string): Room | undefined {
    let best: Room | undefined;
    let bestScore = -1;
    for (const r of this.rooms.values()) {
      if (!r.isPublic || r.table || r.empty || !r.canJoin(playerId)) continue;
      const seated = r.seats.filter((s) => s.playerId || s.bot).length;
      if (seated >= r.seats.length) continue;
      const score = (r.config.players === 4 ? 100 : 0) + seated;
      if (score > bestScore) {
        best = r;
        bestScore = score;
      }
    }
    return best;
  }

  get(code: string): Room | undefined {
    return this.rooms.get(String(code ?? '').trim().toUpperCase());
  }

  /** Borra salas vacías o inactivas. */
  sweep(maxIdleMs = 1000 * 60 * 60 * 3, emptyIdleMs = 1000 * 60 * 15) {
    const now = Date.now();
    for (const [code, room] of this.rooms) {
      const idle = now - room.lastActivity;
      if (idle > maxIdleMs || (room.empty && idle > emptyIdleMs)) {
        room.dispose();
        this.rooms.delete(code);
      }
    }
  }
}

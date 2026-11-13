/**
 * Construye el servidor HTTP + Socket.IO. Separado de index.ts para poder probarlo (tests/server.test.ts).
 * Medidas de seguridad: ver docs/SEGURIDAD.md.
 */
import express from 'express';
import { createServer, Server as HttpServer } from 'node:http';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Server, Socket } from 'socket.io';
import { RuleError } from '../shared/engine';
import type { ClientToServer, ServerToClient } from '../shared/protocol';
import { Room, RoomManager, sanitizeName } from './rooms';
import { Metrics } from './metrics';
import { Usage } from './usage';
import {
  KeyedLimiter,
  TokenBucket,
  clientIp,
  originAllowed,
  parseAction,
  parseConfigPatch,
  securityHeaders,
  toSeat,
  validCode,
  validPlayerId,
} from './security';

export interface ServerOptions {
  /** Carpeta con el cliente compilado (index.html). Si no existe, solo hay API/WebSocket. */
  clientDir?: string;
  /** Orígenes permitidos además del propio dominio (CORS_ORIGIN). */
  allowedOrigins?: string[];
  /** Fiarse de X-Forwarded-For / X-Forwarded-Proto (detrás de un proxy). */
  trustProxy?: boolean;
  maxRooms?: number;
  /** Fichero de las estadísticas de uso anónimas. Sin él, solo se cuentan en memoria. */
  usageFile?: string;
  maxConnectionsPerIp?: number;
  /** Salas que puede crear una IP: ráfaga y recarga por minuto. */
  roomsPerIp?: { burst: number; perMinute: number };
  /** Intentos de unirse a salas inexistentes por IP. */
  badJoinsPerIp?: { burst: number; perMinute: number };
  /** Mensajes por segundo por conexión. */
  eventsPerSecond?: { burst: number; perSecond: number };
  /** Espera de una mesa pública antes de rellenarla con bots y empezar (ms). */
  autoFillMs?: number;
}

export interface GameServer {
  http: HttpServer;
  io: Server<ClientToServer, ServerToClient>;
  manager: RoomManager;
  metrics: Metrics;
  usage: Usage;
  close: () => Promise<void>;
}

type AnyAck = (r: unknown) => void;
const ackOf = (v: unknown): AnyAck => (typeof v === 'function' ? (v as AnyAck) : () => {});

export function createGameServer(opts: ServerOptions = {}): GameServer {
  const allowed = opts.allowedOrigins ?? [];
  const trustProxy = !!opts.trustProxy;
  const maxRooms = opts.maxRooms ?? 500;
  const maxConnPerIp = opts.maxConnectionsPerIp ?? 30;
  const roomLimiter = new KeyedLimiter(opts.roomsPerIp?.burst ?? 10, (opts.roomsPerIp?.perMinute ?? 2) / 60);
  const badJoinLimiter = new KeyedLimiter(opts.badJoinsPerIp?.burst ?? 20, (opts.badJoinsPerIp?.perMinute ?? 10) / 60);
  const ev = opts.eventsPerSecond ?? { burst: 40, perSecond: 15 };
  const connectionsPerIp = new Map<string, number>();

  const app = express();
  app.disable('x-powered-by');
  if (trustProxy) app.set('trust proxy', 1);
  app.use((req, res, next) => {
    const https = req.secure || (trustProxy && req.headers['x-forwarded-proto'] === 'https');
    for (const [k, v] of Object.entries(securityHeaders(req.headers.host, https))) res.setHeader(k, v);
    next();
  });

  const http = createServer(app);
  const io = new Server<ClientToServer, ServerToClient>(http, {
    // Ningún mensaje legítimo pasa de unos pocos KB.
    maxHttpBufferSize: 16 * 1024,
    cors: allowed.length ? { origin: allowed } : undefined,
    allowRequest: (req, cb) => {
      if (!originAllowed(req.headers.origin, req.headers.host, allowed)) return cb('Origen no permitido', false);
      const ip = clientIp(req, trustProxy);
      if ((connectionsPerIp.get(ip) ?? 0) >= maxConnPerIp) return cb('Demasiadas conexiones', false);
      cb(null, true);
    },
  });

  const usage = new Usage(opts.usageFile);
  const manager = new RoomManager({
    usage,
    autoFillMs: opts.autoFillMs,
    broadcast: (room) => broadcast(room),
    sendQuick: (room, from, text) => io.to(room.code).emit('quick', { from, text, at: Date.now() }),
    onKicked: (room, socketIds, reason) => {
      for (const sid of socketIds) {
        io.to(sid).emit('kicked', reason);
        io.in(sid).socketsLeave(room.code);
      }
    },
  });

  function broadcast(room: Room) {
    for (const m of room.members.values()) {
      const state = room.stateFor(m.playerId);
      for (const sid of m.socketIds) io.to(sid).emit('state', state);
    }
  }

  io.on('connection', (socket: Socket) => {
    const ip = clientIp(socket.request, trustProxy);
    connectionsPerIp.set(ip, (connectionsPerIp.get(ip) ?? 0) + 1);
    const data = socket.data as { playerId?: string; code?: string };
    const bucket = new TokenBucket(ev.burst, ev.perSecond);
    let strikes = 0;

    /**
     * Envuelve cada manejador: límite de frecuencia y captura de errores.
     * Un error en un manejador nunca debe tumbar el proceso.
     */
    const on = (event: string, handler: (...args: unknown[]) => void) => {
      socket.on(event, (...args: unknown[]) => {
        const ack = ackOf(args[args.length - 1]);
        if (!bucket.take()) {
          if (++strikes > 20) socket.disconnect(true);
          return ack({ ok: false, error: 'Vas demasiado rápido.' });
        }
        try {
          handler(...args);
        } catch (e) {
          if (!(e instanceof RuleError)) console.error(`Error en ${event}:`, e);
          ack({ ok: false, error: e instanceof RuleError ? e.message : 'Error inesperado.' });
        }
      });
    };

    const currentRoom = () => (data.code ? manager.get(data.code) : undefined);

    /** Operación de sala que requiere estar dentro; responde por ack y retransmite. */
    const roomOp = (fn: (room: Room, playerId: string) => void) => (ackArg: unknown) => {
      const ack = ackOf(ackArg);
      const room = currentRoom();
      if (!room || !data.playerId) return ack({ ok: false, error: 'No estás en ninguna sala.' });
      fn(room, data.playerId);
      room.touch();
      ack({ ok: true });
      broadcast(room);
    };

    const leaveCurrent = () => {
      const room = currentRoom();
      if (room && data.playerId) {
        room.disconnect(data.playerId, socket.id);
        socket.leave(room.code);
        broadcast(room);
      }
      data.code = undefined;
    };

    const enter = (room: Room, playerId: string, name: string, watch = false) => {
      if (data.code && data.code !== room.code) leaveCurrent();
      room.join(playerId, name, socket.id, watch); // lanza RuleError si la sala está llena
      data.playerId = playerId;
      data.code = room.code;
      socket.join(room.code);
      broadcast(room);
    };

    on('room:create', (p, a) => {
      const ack = ackOf(a);
      const body = (p ?? {}) as { name?: unknown; playerId?: unknown; config?: unknown; isPublic?: unknown };
      if (!validPlayerId(body.playerId)) return ack({ ok: false, error: 'Identificador no válido.' });
      if (manager.rooms.size >= maxRooms) return ack({ ok: false, error: 'El servidor está lleno. Inténtalo más tarde.' });
      if (!roomLimiter.take(ip)) return ack({ ok: false, error: 'Has creado demasiadas salas. Espera unos minutos.' });
      const room = manager.create(body.playerId, parseConfigPatch(body.config));
      room.makePublic(body.isPublic === true);
      enter(room, body.playerId, sanitizeName(body.name));
      ack({ ok: true, code: room.code });
    });

    on('room:join', (p, a) => {
      const ack = ackOf(a);
      const body = (p ?? {}) as { code?: unknown; name?: unknown; playerId?: unknown; watch?: unknown };
      if (!validPlayerId(body.playerId)) return ack({ ok: false, error: 'Identificador no válido.' });
      const room = validCode(body.code) ? manager.get(body.code) : undefined;
      if (!room) {
        // Frena a quien prueba códigos al azar.
        if (!badJoinLimiter.take(ip)) return ack({ ok: false, error: 'Demasiados intentos. Espera un poco.' });
        return ack({ ok: false, error: 'No existe ninguna sala con ese código.' });
      }
      enter(room, body.playerId, sanitizeName(body.name), body.watch === true);
      ack({ ok: true, code: room.code });
    });

    on('room:quick', (p, a) => {
      const ack = ackOf(a);
      const body = (p ?? {}) as { name?: unknown; playerId?: unknown };
      if (!validPlayerId(body.playerId)) return ack({ ok: false, error: 'Identificador no válido.' });
      let room = manager.findQuick(body.playerId);
      if (!room) {
        if (manager.rooms.size >= maxRooms) return ack({ ok: false, error: 'El servidor está lleno. Inténtalo más tarde.' });
        if (!roomLimiter.take(ip)) return ack({ ok: false, error: 'Has creado demasiadas salas. Espera unos minutos.' });
        room = manager.create(body.playerId, { players: 4 });
        room.makePublic(true);
      }
      enter(room, body.playerId, sanitizeName(body.name));
      ack({ ok: true, code: room.code });
    });

    on('room:mine', (p, a) => {
      const ack = ackOf(a);
      const body = (p ?? {}) as { code?: unknown; playerId?: unknown };
      if (!validPlayerId(body.playerId) || !validCode(body.code)) return ack({ ok: true, active: false });
      const room = manager.get(body.code);
      const active = !!room?.table && room.table.match.phase !== 'finished' && room.seatOf(body.playerId) !== null;
      ack({ ok: true, active });
    });

    on('room:report', (p, a) => {
      const ack = ackOf(a);
      const room = currentRoom();
      if (!room || !data.playerId) return ack({ ok: false, error: 'No estás en ninguna sala.' });
      const message = room.report(data.playerId, seatOf(p));
      ack({ ok: true, message });
      broadcast(room);
    });

    on('room:leave', () => {
      const room = currentRoom();
      if (room && data.playerId) {
        room.leave(data.playerId);
        socket.leave(room.code);
        broadcast(room);
      }
      data.code = undefined;
    });

    const seatOf = (p: unknown) => toSeat((p as { seat?: unknown } | null)?.seat);
    on('room:visibility', (p, a) => roomOp((r, id) => r.setVisibility(id, (p as { isPublic?: unknown } | null)?.isPublic === true))(a));
    on('room:sit', (p, a) => roomOp((r, id) => r.sit(id, seatOf(p)))(a));
    on('room:addBot', (p, a) => roomOp((r, id) => r.addBot(id, seatOf(p)))(a));
    on('room:clearSeat', (p, a) => roomOp((r, id) => r.clearSeat(id, seatOf(p)))(a));
    on('room:config', (p, a) => roomOp((r, id) => r.setConfig(id, parseConfigPatch(p)))(a));
    on('room:drawTeams', (a) => roomOp((r, id) => r.drawTeams(id))(a));
    on('room:start', (a) => roomOp((r, id) => r.start(id))(a));
    on('room:replaceWithBot', (p, a) => roomOp((r, id) => r.replaceWithBot(id, seatOf(p)))(a));
    on('game:rematch', (a) => roomOp((r, id) => r.rematch(id))(a));
    on('game:action', (p, a) => {
      const action = parseAction(p);
      if (!action) return ackOf(a)({ ok: false, error: 'Acción no válida.' });
      roomOp((r, id) => r.action(id, action))(a);
    });
    on('game:chat', (p, a) => {
      const ack = ackOf(a);
      const room = currentRoom();
      if (!room || !data.playerId) return ack({ ok: false, error: 'No estás en ninguna sala.' });
      const warning = room.chat(data.playerId, (p as { text?: unknown } | null)?.text);
      ack(warning ? { ok: false, error: warning } : { ok: true });
    });
    on('game:quick', (p) => {
      const room = currentRoom();
      const index = (p as { index?: unknown } | null)?.index;
      if (room && data.playerId && Number.isInteger(index)) room.quick(data.playerId, index as number);
    });

    socket.on('disconnect', () => {
      const n = (connectionsPerIp.get(ip) ?? 1) - 1;
      if (n <= 0) connectionsPerIp.delete(ip);
      else connectionsPerIp.set(ip, n);
      try {
        leaveCurrent();
      } catch (e) {
        console.error('Error al desconectar:', e);
      }
    });
  });

  const sweeper = setInterval(() => {
    manager.sweep();
    roomLimiter.sweep();
    badJoinLimiter.sweep();
    listLimiter.sweep();
  }, 60_000);
  sweeper.unref();

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  // Lista de partidas públicas (sin apodos ni datos de nadie). Petición GET simple: sin CORS previo.
  const listLimiter = new KeyedLimiter(30, 1);
  app.get('/api/salas', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const origin = req.headers.origin;
    if (origin && originAllowed(origin, req.headers.host, allowed)) res.setHeader('Access-Control-Allow-Origin', origin);
    if (!listLimiter.take(clientIp(req, trustProxy))) return res.sendStatus(429);
    res.json({ rooms: manager.listPublic() });
  });

  // Avisos anónimos de las partidas contra bots (se juegan en el móvil, sin pasar por el servidor).
  // Cuerpo en texto plano (JSON) para que el navegador no necesite una petición previa de CORS.
  const practiceLimiter = new KeyedLimiter(30, 1 / 10);
  app.post('/api/uso/practica', express.text({ type: '*/*', limit: '1kb' }), (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const origin = req.headers.origin;
    if (origin && originAllowed(origin, req.headers.host, allowed)) res.setHeader('Access-Control-Allow-Origin', origin);
    if (!practiceLimiter.take(clientIp(req, trustProxy))) return res.sendStatus(429);
    let body: { playerId?: unknown; event?: unknown } = {};
    try {
      body = JSON.parse(typeof req.body === 'string' ? req.body : '{}');
    } catch {
      return res.sendStatus(400);
    }
    const event = body.event;
    if (!validPlayerId(body.playerId) || (event !== 'start' && event !== 'hand' && event !== 'end')) return res.sendStatus(400);
    usage.practice(body.playerId, event);
    res.sendStatus(204);
  });

  // ---------------------------------------------------------------- Métricas para el panel (servidor aparte: src/server/admin.ts)
  const metrics = new Metrics(() => {
    let playing = 0;
    for (const r of manager.rooms.values()) {
      if (r.table && r.table.match.phase !== 'finished') playing += r.seats.filter((st) => !st.bot && r.isConnected(st.playerId)).length;
    }
    return { connections: io.engine.clientsCount, rooms: manager.rooms.size, playing };
  });
  const clientDir = opts.clientDir;
  if (clientDir && existsSync(join(clientDir, 'index.html'))) {
    app.use(express.static(clientDir, { maxAge: '1h', index: false, dotfiles: 'ignore' }));
    app.get(/^(?!\/socket\.io|\/api).*/, (_req, res) => res.sendFile(join(clientDir, 'index.html')));
  }

  return {
    http,
    io,
    manager,
    metrics,
    usage,
    close: async () => {
      clearInterval(sweeper);
      metrics.stop();
      usage.stop();
      for (const r of manager.rooms.values()) r.dispose();
      await new Promise<void>((resolve) => io.close(() => resolve()));
    },
  };
}

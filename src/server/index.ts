/**
 * Servidor: HTTP (sirve el cliente compilado) + Socket.IO (partidas online).
 * Puerto: argumento --port (lo usa `npm run dev`), si no la variable PORT, si no 3001.
 * CORS_ORIGIN (opcional): orígenes permitidos si el cliente se sirve desde otro dominio.
 */
import express from 'express';
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server, Socket } from 'socket.io';
import { RuleError } from '../shared/engine';
import type { Ack, ClientToServer, ServerToClient } from '../shared/protocol';
import { Room, RoomManager, sanitizeName } from './rooms';

const portArg = process.argv.indexOf('--port');
const PORT = Number(portArg > 0 ? process.argv[portArg + 1] : (process.env.PORT ?? 3001));
const app = express();
const http = createServer(app);
const io = new Server<ClientToServer, ServerToClient>(http, {
  cors: process.env.CORS_ORIGIN ? { origin: process.env.CORS_ORIGIN.split(',') } : undefined,
});

interface SocketData {
  playerId?: string;
  code?: string;
}

const manager = new RoomManager({
  broadcast: (room) => broadcast(room),
  sendSena: (room, to, from, sena) => {
    for (const pid of to) for (const sid of room.members.get(pid)?.socketIds ?? []) io.to(sid).emit('sena', { from, sena, at: Date.now() });
  },
  sendQuick: (room, from, text) => io.to(room.code).emit('quick', { from, text, at: Date.now() }),
});

function broadcast(room: Room) {
  for (const m of room.members.values()) {
    const state = room.stateFor(m.playerId);
    for (const sid of m.socketIds) io.to(sid).emit('state', state);
  }
}

/** Ejecuta una operación de sala, responde por ack y retransmite el estado. */
function guarded(socket: Socket, ack: Ack | undefined, fn: (room: Room, playerId: string) => void) {
  const data = socket.data as SocketData;
  const room = data.code ? manager.get(data.code) : undefined;
  const reply = typeof ack === 'function' ? ack : () => {};
  if (!room || !data.playerId) return reply({ ok: false, error: 'No estás en ninguna sala.' });
  try {
    fn(room, data.playerId);
    room.touch();
    reply({ ok: true });
    broadcast(room);
  } catch (e) {
    reply({ ok: false, error: e instanceof RuleError ? e.message : 'Error inesperado.' });
    if (!(e instanceof RuleError)) console.error(e);
  }
}

const validId = (id: unknown): id is string => typeof id === 'string' && /^[a-zA-Z0-9-]{8,64}$/.test(id);

io.on('connection', (socket) => {
  const data = socket.data as SocketData;

  const enter = (room: Room, playerId: string, name: string) => {
    if (data.code && data.code !== room.code) leaveCurrent();
    data.playerId = playerId;
    data.code = room.code;
    socket.join(room.code);
    room.join(playerId, name, socket.id);
    broadcast(room);
  };

  const leaveCurrent = () => {
    const room = data.code ? manager.get(data.code) : undefined;
    if (room && data.playerId) {
      room.disconnect(data.playerId, socket.id);
      socket.leave(room.code);
      broadcast(room);
    }
    data.code = undefined;
  };

  socket.on('room:create', (p, ack) => {
    if (!validId(p?.playerId)) return ack({ ok: false, error: 'Identificador no válido.' });
    const room = manager.create(p.playerId, p.config ?? {});
    enter(room, p.playerId, sanitizeName(p.name));
    ack({ ok: true, code: room.code });
  });

  socket.on('room:join', (p, ack) => {
    if (!validId(p?.playerId)) return ack({ ok: false, error: 'Identificador no válido.' });
    const room = manager.get(p.code);
    if (!room) return ack({ ok: false, error: 'No existe ninguna sala con ese código.' });
    enter(room, p.playerId, sanitizeName(p.name));
    ack({ ok: true, code: room.code });
  });

  socket.on('room:leave', () => {
    const room = data.code ? manager.get(data.code) : undefined;
    if (room && data.playerId) {
      room.leave(data.playerId);
      socket.leave(room.code);
      broadcast(room);
    }
    data.code = undefined;
  });

  socket.on('room:sit', (p, ack) => guarded(socket, ack, (r, id) => r.sit(id, p?.seat)));
  socket.on('room:addBot', (p, ack) => guarded(socket, ack, (r, id) => r.addBot(id, p?.seat)));
  socket.on('room:clearSeat', (p, ack) => guarded(socket, ack, (r, id) => r.clearSeat(id, p?.seat)));
  socket.on('room:config', (p, ack) => guarded(socket, ack, (r, id) => r.setConfig(id, p ?? {})));
  socket.on('room:drawTeams', (ack) => guarded(socket, ack, (r, id) => r.drawTeams(id)));
  socket.on('room:start', (ack) => guarded(socket, ack, (r, id) => r.start(id)));
  socket.on('room:replaceWithBot', (p, ack) => guarded(socket, ack, (r, id) => r.replaceWithBot(id, p?.seat)));
  socket.on('game:rematch', (ack) => guarded(socket, ack, (r, id) => r.rematch(id)));
  // Las acciones de juego ya provocan broadcast vía GameTable.onChange.
  socket.on('game:action', (a, ack) => guarded(socket, ack, (r, id) => r.action(id, a)));
  socket.on('game:sena', (p) => {
    const room = data.code ? manager.get(data.code) : undefined;
    if (room && data.playerId && p?.sena) room.sena(data.playerId, p.sena);
  });
  socket.on('game:quick', (p) => {
    const room = data.code ? manager.get(data.code) : undefined;
    if (room && data.playerId) room.quick(data.playerId, Number(p?.index));
  });

  socket.on('disconnect', leaveCurrent);
});

setInterval(() => manager.sweep(), 60_000).unref();

app.get('/api/health', (_req, res) => res.json({ ok: true, rooms: manager.rooms.size }));

// En producción se sirve el cliente compilado (dist/client).
const here = dirname(fileURLToPath(import.meta.url));
const clientDir = [join(here, '../client'), join(process.cwd(), 'dist/client')].find((d) => existsSync(join(d, 'index.html')));
if (clientDir) {
  app.use(express.static(clientDir, { maxAge: '1h', index: false }));
  app.get(/^(?!\/socket\.io|\/api).*/, (_req, res) => res.sendFile(join(clientDir, 'index.html')));
}

http.listen(PORT, () => console.log(`Servidor del Pablo escuchando en http://localhost:${PORT}`));

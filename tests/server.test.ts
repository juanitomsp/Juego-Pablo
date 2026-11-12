/**
 * Tests de seguridad del servidor: arrancan un servidor real en un puerto libre y se conectan con socket.io-client.
 */
import { afterEach, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import { io as connect, Socket } from 'socket.io-client';
import { GameServer, ServerOptions, createGameServer } from '../src/server/app';
import { createAdminServer } from '../src/server/admin';
import { parseAction, parseConfigPatch, originAllowed } from '../src/server/security';
import { MAX_MEMBERS } from '../src/server/rooms';
import type { RoomState } from '../src/shared/protocol';

let server: GameServer | null = null;
const clients: Socket[] = [];

async function start(opts: ServerOptions = {}) {
  server = createGameServer(opts);
  await new Promise<void>((r) => server!.http.listen(0, '127.0.0.1', () => r()));
  return `http://127.0.0.1:${(server.http.address() as AddressInfo).port}`;
}

function client(url: string, headers?: Record<string, string>): Promise<Socket> {
  const s = connect(url, { transports: ['websocket'], forceNew: true, reconnection: false, extraHeaders: headers });
  clients.push(s);
  return new Promise((resolve, reject) => {
    s.on('connect', () => resolve(s));
    s.on('connect_error', reject);
  });
}

const call = <T = Record<string, unknown>>(s: Socket, ev: string, payload?: unknown): Promise<T> =>
  new Promise((resolve) => (payload === undefined ? s.emit(ev, resolve) : s.emit(ev, payload, resolve)));

const id = (n: number) => `test-player-${n}-abcdef`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

afterEach(async () => {
  clients.splice(0).forEach((c) => c.disconnect());
  await server?.close();
  server = null;
});

describe('validación de entrada', () => {
  it('parseAction solo acepta acciones conocidas y bien formadas', () => {
    expect(parseAction({ type: 'play', card: { suit: 'oros', rank: 3 } })).toEqual({ type: 'play', card: { suit: 'oros', rank: 3 } });
    expect(parseAction({ type: 'play', card: { suit: 'oros', rank: 3, extra: 'x' } })).toEqual({ type: 'play', card: { suit: 'oros', rank: 3 } });
    expect(parseAction({ type: 'play', card: { suit: 'diamantes', rank: 3 } })).toBeNull();
    expect(parseAction({ type: 'play', card: { suit: 'oros', rank: 99 } })).toBeNull();
    expect(parseAction({ type: 'quiero', play: 'si' })).toBeNull();
    expect(parseAction({ type: '__proto__' })).toBeNull();
    expect(parseAction(null)).toBeNull();
    expect(parseAction('bet')).toBeNull();
  });
  it('parseConfigPatch ignora claves y tipos desconocidos', () => {
    expect(parseConfigPatch({ players: 6, maxStake: 999, handValue: 50, teamNames: 'x', carteta: 'si' })).toEqual({ players: 6 });
    expect(parseConfigPatch({ teamNames: ['A', 'B'], pointsPerCuerno: 8 })).toEqual({ teamNames: ['A', 'B'], pointsPerCuerno: 8 });
  });
  it('originAllowed: mismo dominio o lista blanca', () => {
    expect(originAllowed('https://juego.com', 'juego.com', [])).toBe(true);
    expect(originAllowed('https://malo.com', 'juego.com', [])).toBe(false);
    expect(originAllowed('https://app.vercel.app', 'api.juego.com', ['https://app.vercel.app'])).toBe(true);
    expect(originAllowed('no es una url', 'juego.com', [])).toBe(false);
    expect(originAllowed(undefined, 'juego.com', [])).toBe(true);
  });
});

describe('servidor', () => {
  it('no se cae con mensajes malformados o sin respuesta', async () => {
    const url = await start();
    const s = await client(url);
    s.emit('room:create'); // sin datos ni ack
    s.emit('room:create', null);
    s.emit('room:join', { code: { $gt: '' }, playerId: id(1) });
    s.emit('game:action', { type: 'play', card: null });
    s.emit('game:sena', { sena: '<script>' });
    s.emit('room:sit', { seat: 'x' });
    s.emit('room:config', 'basura');
    s.emit('desconocido', 1, 2, 3);
    await sleep(100);
    const res = await call<{ ok: boolean; code?: string }>(s, 'room:create', { name: 'Ana', playerId: id(1), config: {} });
    expect(res.ok).toBe(true);
    expect(res.code).toMatch(/^[A-Z0-9]{6}$/);
  });

  it('envía cabeceras de seguridad', async () => {
    const url = await start();
    const r = await fetch(`${url}/api/health`);
    expect(r.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
    expect(r.headers.get('x-content-type-options')).toBe('nosniff');
    expect(r.headers.get('x-powered-by')).toBeNull();
  });

  it('rechaza conexiones desde otros dominios', async () => {
    const url = await start();
    await expect(client(url, { origin: 'https://web-maliciosa.com' })).rejects.toBeTruthy();
    await expect(client(url, { origin: url })).resolves.toBeTruthy();
  });

  it('acepta los orígenes de CORS_ORIGIN', async () => {
    const url = await start({ allowedOrigins: ['https://mi-juego.vercel.app'] });
    await expect(client(url, { origin: 'https://mi-juego.vercel.app' })).resolves.toBeTruthy();
  });

  it('limita las salas que crea una misma IP', async () => {
    const url = await start({ roomsPerIp: { burst: 2, perMinute: 0.001 } });
    const s = await client(url);
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await call<{ ok: boolean }>(s, 'room:create', { name: 'A', playerId: id(i), config: {} }));
    expect(results.map((r) => r.ok)).toEqual([true, true, false, false]);
  });

  it('limita los intentos de adivinar códigos', async () => {
    const url = await start({ badJoinsPerIp: { burst: 3, perMinute: 0.001 } });
    const s = await client(url);
    const errors: string[] = [];
    for (let i = 0; i < 5; i++) errors.push((await call<{ error: string }>(s, 'room:join', { code: `ZZZZZ${i}`, name: 'x', playerId: id(1) })).error);
    expect(errors[4]).toMatch(/Demasiados intentos/);
  });

  it('respeta el máximo de salas', async () => {
    const url = await start({ maxRooms: 1 });
    const s = await client(url);
    expect((await call<{ ok: boolean }>(s, 'room:create', { name: 'A', playerId: id(1), config: {} })).ok).toBe(true);
    expect((await call<{ ok: boolean }>(s, 'room:create', { name: 'B', playerId: id(2), config: {} })).ok).toBe(false);
  });

  it('corta a quien inunda de mensajes', async () => {
    const url = await start({ eventsPerSecond: { burst: 5, perSecond: 1 } });
    const s = await client(url);
    const replies = await Promise.all(Array.from({ length: 10 }, () => call<{ ok: boolean; error?: string }>(s, 'room:sit', { seat: 0 })));
    expect(replies.filter((r) => r.error === 'Vas demasiado rápido.').length).toBeGreaterThan(0);
  });

  it('nadie recibe las cartas de los demás y un mirón no puede jugar', async () => {
    const url = await start();
    const host = await client(url);
    const states: RoomState[] = [];
    host.on('state', (st: RoomState) => states.push(st));
    const { code } = await call<{ code: string }>(host, 'room:create', { name: 'Ana', playerId: id(1), config: { players: 4 } });
    for (const seat of [1, 2, 3]) await call(host, 'room:addBot', { seat });
    expect((await call<{ ok: boolean }>(host, 'room:start')).ok).toBe(true);

    const watcher = await client(url);
    const wStates: RoomState[] = [];
    watcher.on('state', (st: RoomState) => wStates.push(st));
    await call(watcher, 'room:join', { code, name: 'Mirón', playerId: id(9) });
    const res = await call<{ ok: boolean }>(watcher, 'game:action', { type: 'deal' });
    expect(res.ok).toBe(false);
    await sleep(1500);

    const all = JSON.stringify([...states, ...wStates]);
    expect(all).not.toContain('"hands"');
    expect(all).not.toContain('"dormant"');
    expect(all).not.toContain('playerId');
    expect(all).not.toContain(id(1));
    expect(wStates.every((s) => !s.view?.hand || s.view.hand.myCards.length === 0)).toBe(true);
  });

  it('espectadores: entran a mirar con el código, se cuentan y no pueden escribir', async () => {
    const url = await start();
    const host = await client(url);
    const hStates: RoomState[] = [];
    host.on('state', (st: RoomState) => hStates.push(st));
    const { code } = await call<{ code: string }>(host, 'room:create', { name: 'Ana', playerId: id(1), config: { players: 4 } });

    // En la sala de espera, con watch no se sienta aunque haya sitio.
    const w1 = await client(url);
    await call(w1, 'room:join', { code, name: 'Mirón', playerId: id(8), watch: true });
    await sleep(50);
    let last = hStates[hStates.length - 1];
    expect(last.room.spectators).toBe(1);
    expect(last.room.seats.filter((s) => s.name).length).toBe(1);

    for (const seat of [1, 2, 3]) await call(host, 'room:addBot', { seat });
    await call(host, 'room:start');
    // Con la partida empezada, entrar con el código también es mirar.
    const w2 = await client(url);
    await call(w2, 'room:join', { code, name: 'Otro', playerId: id(9) });
    await sleep(50);
    last = hStates[hStates.length - 1];
    expect(last.room.spectators).toBe(2);
    const chat = await call<{ ok: boolean; error?: string }>(w2, 'game:chat', { text: 'hola' });
    expect(chat.ok).toBe(false);

    w2.disconnect();
    await sleep(100);
    expect(hStates[hStates.length - 1].room.spectators).toBe(1);
  });

  it('partidas públicas: solo salen las públicas, sin apodos, y el anfitrión decide', async () => {
    const url = await start();
    const a = await client(url);
    const b = await client(url);
    const pub = await call<{ code: string }>(a, 'room:create', { name: 'Ana', playerId: id(1), config: { players: 4 }, isPublic: true });
    const priv = await call<{ code: string }>(b, 'room:create', { name: 'Bea', playerId: id(2), config: { players: 6 } });
    let list = (await (await fetch(`${url}/api/salas`)).json()) as { rooms: { code: string; seated: number; players: number }[] };
    expect(list.rooms.map((r) => r.code)).toEqual([pub.code]);
    expect(list.rooms[0]).toMatchObject({ players: 4, seated: 1, started: false });
    expect(JSON.stringify(list)).not.toContain('Ana');

    // Solo el anfitrión cambia la visibilidad.
    const c = await client(url);
    await call(c, 'room:join', { code: priv.code, name: 'Carla', playerId: id(3) });
    expect((await call<{ ok: boolean }>(c, 'room:visibility', { isPublic: true })).ok).toBe(false);
    expect((await call<{ ok: boolean }>(b, 'room:visibility', { isPublic: true })).ok).toBe(true);
    list = await (await fetch(`${url}/api/salas`)).json();
    expect(list.rooms.length).toBe(2);
    // La que tiene más gente esperando sale primero.
    expect(list.rooms[0].code).toBe(priv.code);

    // Si se van todos, deja de aparecer.
    a.disconnect();
    await sleep(100);
    list = await (await fetch(`${url}/api/salas`)).json();
    expect(list.rooms.map((r) => r.code)).toEqual([priv.code]);
  });

  it('partida rápida: te sienta en una mesa pública con sitio o crea una', async () => {
    const url = await start();
    const a = await client(url);
    const r1 = await call<{ ok: boolean; code: string }>(a, 'room:quick', { name: 'Ana', playerId: id(1) });
    expect(r1.ok).toBe(true);
    let list = (await (await fetch(`${url}/api/salas`)).json()) as { rooms: { code: string; seated: number }[] };
    expect(list.rooms.map((r) => r.code)).toEqual([r1.code]);
    // Una sala privada con sitio no cuenta para la partida rápida.
    const b = await client(url);
    await call(b, 'room:create', { name: 'Bea', playerId: id(2), config: { players: 4 } });
    const c = await client(url);
    const r2 = await call<{ ok: boolean; code: string }>(c, 'room:quick', { name: 'Carla', playerId: id(3) });
    expect(r2.code).toBe(r1.code);
    list = await (await fetch(`${url}/api/salas`)).json();
    expect(list.rooms[0].seated).toBe(2);
  });

  it('mesa pública: si no entra nadie más, se rellena con bots y empieza sola', async () => {
    const url = await start({ autoFillMs: 300 });
    const a = await client(url);
    const states: RoomState[] = [];
    a.on('state', (st: RoomState) => states.push(st));
    await call(a, 'room:create', { name: 'Ana', playerId: id(1), config: { players: 4 }, isPublic: true });
    await sleep(50);
    expect(states[states.length - 1].room.autoStartAt).toBeGreaterThan(Date.now());
    await sleep(600);
    const last = states[states.length - 1];
    expect(last.room.started).toBe(true);
    expect(last.room.seats.filter((s) => s.bot).length).toBe(3);
    // Las privadas no empiezan solas.
    const b = await client(url);
    const bStates: RoomState[] = [];
    b.on('state', (st: RoomState) => bStates.push(st));
    await call(b, 'room:create', { name: 'Bea', playerId: id(2), config: { players: 4 } });
    await sleep(600);
    expect(bStates[bStates.length - 1].room.started).toBe(false);
    expect(bStates[bStates.length - 1].room.autoStartAt).toBeNull();
  });

  it('reportar: con la mitad del resto de la mesa se expulsa (y juega un bot)', async () => {
    const url = await start();
    const socks = await Promise.all([1, 2, 3, 4].map(() => client(url)));
    const { code } = await call<{ code: string }>(socks[0], 'room:create', { name: 'Ana', playerId: id(1), config: { players: 4 } });
    for (const i of [1, 2, 3]) await call(socks[i], 'room:join', { code, name: `J${i}`, playerId: id(i + 1) });
    await call(socks[0], 'room:start');
    let kicked = '';
    socks[3].on('kicked', (r: string) => (kicked = r));
    const states: RoomState[] = [];
    socks[0].on('state', (st: RoomState) => states.push(st));
    // No se puede reportar a uno mismo ni a un bot; los mirones no reportan.
    expect((await call<{ ok: boolean }>(socks[0], 'room:report', { seat: 0 })).ok).toBe(false);
    const r1 = await call<{ ok: boolean; message: string }>(socks[0], 'room:report', { seat: 3 });
    expect(r1.ok).toBe(true);
    expect(r1.message).toMatch(/1 jugador más/);
    // El mismo jugador no cuenta dos veces.
    expect((await call<{ message: string }>(socks[0], 'room:report', { seat: 3 })).message).toMatch(/Ya lo habías reportado/);
    const r2 = await call<{ ok: boolean; message: string }>(socks[1], 'room:report', { seat: 3 });
    expect(r2.message).toMatch(/expulsado/);
    await sleep(50);
    expect(kicked).toMatch(/reportado/);
    const seat3 = states[states.length - 1].room.seats[3];
    expect(seat3.bot).toBe(true);
    // No puede volver a entrar.
    const back = await call<{ ok: boolean }>(socks[3], 'room:join', { code, name: 'J3', playerId: id(4) });
    expect(back.ok).toBe(false);
    expect(server!.usage.report().thisMonth.reports).toBe(2);
    expect(server!.usage.report().thisMonth.kicks).toBe(1);
  });

  it('volver a tu partida: solo si sigues sentado en una partida en curso', async () => {
    const url = await start();
    const a = await client(url);
    const { code } = await call<{ code: string }>(a, 'room:create', { name: 'Ana', playerId: id(1), config: { players: 4 } });
    const mine = (pid: string, c = code) => call<{ ok: boolean; active: boolean }>(a, 'room:mine', { code: c, playerId: pid });
    expect((await mine(id(1))).active).toBe(false); // aún no ha empezado
    for (const seat of [1, 2, 3]) await call(a, 'room:addBot', { seat });
    await call(a, 'room:start');
    expect((await mine(id(1))).active).toBe(true);
    expect((await mine(id(2))).active).toBe(false);
    expect((await mine(id(1), 'ZZZZZZ')).active).toBe(false);
  });

  it('el servidor del juego no expone el panel; el panel aparte sí da los datos', async () => {
    const url = await start();
    expect((await fetch(`${url}/api/admin/metrics`)).status).toBe(404);
    expect((await fetch(`${url}/api/metrics`)).status).toBe(404);

    const admin = createAdminServer({ metrics: server!.metrics, usage: server!.usage });
    await new Promise<void>((r) => admin.listen(0, '127.0.0.1', () => r()));
    const port = (admin.address() as AddressInfo).port;
    const r = await fetch(`http://127.0.0.1:${port}/api/metrics`);
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.now.memPct).toBeGreaterThan(0);
    expect(['good', 'warning', 'critical']).toContain(body.advice.level);
    expect(body.usage.thisMonth).toMatchObject({ players: 0, matches: 0 });
    await new Promise<void>((res) => admin.close(() => res()));
  });

  it('cuenta de forma anónima las partidas contra bots', async () => {
    const url = await start();
    const send = (body: unknown) =>
      fetch(`${url}/api/uso/practica`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(body) });
    expect((await send({ playerId: id(1), event: 'start' })).status).toBe(204);
    expect((await send({ playerId: id(1), event: 'hand' })).status).toBe(204);
    expect((await send({ playerId: id(1), event: 'end' })).status).toBe(204);
    expect((await send({ playerId: id(2), event: 'start' })).status).toBe(204);
    expect((await send({ playerId: 'x', event: 'start' })).status).toBe(400);
    expect((await send({ playerId: id(3), event: 'hackear' })).status).toBe(400);
    const m = server!.usage.report().thisMonth;
    expect(m).toMatchObject({ players: 2, practice: 2, practiceHands: 1, practiceFinished: 1, matches: 0 });
  });

  it('chat: llega a la mesa tal cual (se puede hablar de cartas); los insultos no se envían y a la tercera se expulsa', async () => {
    const url = await start();
    const a = await client(url);
    const b = await client(url);
    const { code } = await call<{ code: string }>(a, 'room:create', { name: 'Ana', playerId: id(1), config: {} });
    await call(b, 'room:join', { code, name: 'Beto', playerId: id(2) });
    const received: string[] = [];
    b.on('quick', (m: { text: string }) => received.push(m.text));

    expect((await call<{ ok: boolean }>(a, 'game:chat', { text: 'tengo el 3 de basto, ¿vamos?' })).ok).toBe(true);
    await sleep(100);
    expect(received).toEqual(['tengo el 3 de basto, ¿vamos?']);

    const kicked: string[] = [];
    a.on('kicked', (r: string) => kicked.push(r));
    for (let i = 1; i <= 3; i++) {
      await sleep(1100);
      const r = await call<{ ok: boolean; error: string }>(a, 'game:chat', { text: 'eres un gilipollas' });
      expect(r.ok).toBe(false);
      expect(r.error).toMatch(i < 3 ? /No se puede insultar/ : /expulsado/);
    }
    await sleep(100);
    expect(received).toHaveLength(1); // ningún insulto llegó
    expect(kicked).toHaveLength(1);
    // No puede volver a entrar en esa sala.
    expect((await call<{ ok: boolean; error: string }>(a, 'room:join', { code, name: 'Ana', playerId: id(1) })).error).toMatch(/expulsado/);
  });

  it('no deja entrar a más de MAX_MEMBERS personas en una sala', async () => {
    const url = await start();
    const s = await client(url);
    const { code } = await call<{ code: string }>(s, 'room:create', { name: 'A', playerId: id(0), config: {} });
    const sockets: Socket[] = [];
    for (let i = 1; i < MAX_MEMBERS; i++) {
      const c = await client(url);
      sockets.push(c);
      expect((await call<{ ok: boolean }>(c, 'room:join', { code, name: `P${i}`, playerId: id(100 + i) })).ok).toBe(true);
    }
    const extra = await client(url);
    expect((await call<{ ok: boolean; error: string }>(extra, 'room:join', { code, name: 'X', playerId: id(999) })).error).toMatch(/llena/);
  });
});

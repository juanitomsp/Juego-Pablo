/**
 * Tests de seguridad del servidor: arrancan un servidor real en un puerto libre y se conectan con socket.io-client.
 */
import { afterEach, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import { io as connect, Socket } from 'socket.io-client';
import { GameServer, ServerOptions, createGameServer } from '../src/server/app';
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

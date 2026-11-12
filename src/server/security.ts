/**
 * Utilidades de seguridad del servidor: validación de datos de entrada, límites de frecuencia
 * y comprobación de origen. Ver docs/SEGURIDAD.md.
 */
import type { IncomingMessage } from 'node:http';
import { Action, GameConfig, SUITS } from '../shared/engine';

// ---------------------------------------------------------------- Validación

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Convierte lo que envía el cliente en una Action válida, o null. Nunca se pasa el objeto original al motor. */
export function parseAction(a: unknown): Action | null {
  if (!isObj(a)) return null;
  switch (a.type) {
    case 'deal':
      return { type: 'deal' };
    case 'bet':
    case 'accept':
    case 'reject':
      return { type: a.type };
    case 'quiero':
      return typeof a.play === 'boolean' ? { type: 'quiero', play: a.play } : null;
    case 'play': {
      const c = a.card;
      if (!isObj(c) || !SUITS.includes(c.suit as never) || !Number.isInteger(c.rank) || (c.rank as number) < 1 || (c.rank as number) > 12)
        return null;
      return { type: 'play', card: { suit: c.suit as (typeof SUITS)[number], rank: c.rank as number } };
    }
    default:
      return null;
  }
}

/** Asiento: entero pequeño o -1 (que las salas rechazan). */
export const toSeat = (v: unknown): number => (Number.isInteger(v) && (v as number) >= 0 && (v as number) < 16 ? (v as number) : -1);

/** Solo se aceptan las claves y tipos conocidos de la configuración. */
export function parseConfigPatch(p: unknown): Partial<GameConfig> {
  if (!isObj(p)) return {};
  const out: Partial<GameConfig> = {};
  if (p.players === 4 || p.players === 6) out.players = p.players;
  for (const k of ['pointsPerCuerno', 'cuernosPerPablo', 'pablosToWin'] as const) {
    if (typeof p[k] === 'number' && Number.isFinite(p[k])) out[k] = p[k] as number;
  }
  if (Array.isArray(p.teamNames) && p.teamNames.length === 2 && p.teamNames.every((n) => typeof n === 'string')) {
    out.teamNames = [p.teamNames[0] as string, p.teamNames[1] as string];
  }
  return out;
}

export const validPlayerId = (id: unknown): id is string => typeof id === 'string' && /^[a-zA-Z0-9-]{8,64}$/.test(id);
export const validCode = (c: unknown): c is string => typeof c === 'string' && /^[A-Za-z0-9]{4,8}$/.test(c.trim());

// ---------------------------------------------------------------- Límites de frecuencia

/** Cubo de fichas: `capacity` acciones seguidas como máximo, que se recargan a `perSecond` por segundo. */
export class TokenBucket {
  private tokens: number;
  private last = Date.now();
  constructor(
    private capacity: number,
    private perSecond: number,
  ) {
    this.tokens = capacity;
  }
  take(n = 1): boolean {
    const now = Date.now();
    this.tokens = Math.min(this.capacity, this.tokens + ((now - this.last) / 1000) * this.perSecond);
    this.last = now;
    if (this.tokens < n) return false;
    this.tokens -= n;
    return true;
  }
}

/** Un cubo por clave (p. ej. por IP), con limpieza de claves antiguas. */
export class KeyedLimiter {
  private buckets = new Map<string, { bucket: TokenBucket; seen: number }>();
  constructor(
    private capacity: number,
    private perSecond: number,
  ) {}
  take(key: string): boolean {
    let e = this.buckets.get(key);
    if (!e) {
      e = { bucket: new TokenBucket(this.capacity, this.perSecond), seen: 0 };
      this.buckets.set(key, e);
    }
    e.seen = Date.now();
    return e.bucket.take();
  }
  sweep(maxAgeMs = 30 * 60_000) {
    const now = Date.now();
    for (const [k, e] of this.buckets) if (now - e.seen > maxAgeMs) this.buckets.delete(k);
  }
}

// ---------------------------------------------------------------- Origen e IP

/**
 * IP del cliente. Solo se fía de X-Forwarded-For si TRUST_PROXY=1
 * (cuando el servidor está detrás de nginx, Caddy, Render...).
 */
export function clientIp(req: IncomingMessage, trustProxy: boolean): string {
  if (trustProxy) {
    const fwd = req.headers['x-forwarded-for'];
    const first = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.socket.remoteAddress ?? 'desconocida';
}

/**
 * Permite conexiones del mismo dominio que sirve el juego o de los orígenes de CORS_ORIGIN.
 * Las peticiones sin cabecera Origin (clientes que no son navegadores) se permiten: no tienen
 * cookies ni sesión que robar, y los límites de frecuencia siguen aplicándose.
 */
export function originAllowed(origin: string | undefined, host: string | undefined, allowed: string[]): boolean {
  if (!origin) return true;
  try {
    const u = new URL(origin);
    if (host && u.host === host) return true;
    return allowed.some((a) => a === origin || a === u.origin);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------- Cabeceras HTTP

export function securityHeaders(host: string | undefined, https: boolean): Record<string, string> {
  const h = host ?? '';
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    `connect-src 'self' wss://${h} ws://${h}`,
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "manifest-src 'self'",
  ].join('; ');
  const headers: Record<string, string> = {
    'Content-Security-Policy': csp,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
  };
  if (https) headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
  return headers;
}

/**
 * Métricas del servidor para el panel de control (#/admin): memoria, CPU, retardo, jugadores y salas.
 * Guarda una muestra por minuto durante 7 días (en memoria) y calcula si conviene ampliar el servidor.
 * Ver docs/PANEL_SERVIDOR.md.
 */
import { readFileSync } from 'node:fs';
import { cpus, loadavg, totalmem, freemem } from 'node:os';
import { monitorEventLoopDelay } from 'node:perf_hooks';

export interface Sample {
  /** Marca de tiempo (ms). */
  t: number;
  /** % de memoria del sistema en uso (descontando la caché que el sistema puede liberar). */
  memPct: number;
  /** Memoria que usa el juego (MB). */
  rssMb: number;
  /** % de CPU del sistema (carga media 1 min / núcleos). */
  cpuPct: number;
  /** Retardo del bucle de eventos (p99, ms): si sube, los jugadores notan tirones. */
  lagMs: number;
  connections: number;
  rooms: number;
  playing: number;
}

export type Level = 'good' | 'warning' | 'critical';

export interface Advice {
  level: Level;
  title: string;
  reasons: string[];
}

export interface Counts {
  connections: number;
  rooms: number;
  playing: number;
}

const MINUTE = 60_000;
const KEEP_MS = 7 * 24 * 60 * MINUTE;

/** Memoria del sistema. En Linux usa MemAvailable (lo que de verdad queda libre, contando la caché). */
export function systemMemory(): { totalMb: number; availableMb: number } {
  try {
    const info = readFileSync('/proc/meminfo', 'utf8');
    const kb = (key: string) => Number(new RegExp(`^${key}:\\s+(\\d+)`, 'm').exec(info)?.[1] ?? NaN);
    const total = kb('MemTotal');
    const available = kb('MemAvailable');
    if (Number.isFinite(total) && Number.isFinite(available)) return { totalMb: total / 1024, availableMb: available / 1024 };
  } catch {
    // No es Linux: se usa lo que da Node.
  }
  return { totalMb: totalmem() / 1048576, availableMb: freemem() / 1048576 };
}

const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

export class Metrics {
  history: Sample[] = [];
  readonly startedAt = Date.now();
  private loop = monitorEventLoopDelay({ resolution: 20 });
  private lastCpu = process.cpuUsage();
  private lastCpuAt = Date.now();
  private timer: ReturnType<typeof setInterval>;
  /** Memoria del proceso con poca gente conectada: base para estimar cuánto gasta cada jugador. */
  private baseRssMb = process.memoryUsage().rss / 1048576;

  constructor(private counts: () => Counts) {
    this.loop.enable();
    this.timer = setInterval(() => this.record(), MINUTE);
    this.timer.unref();
  }

  stop() {
    clearInterval(this.timer);
    this.loop.disable();
  }

  /** CPU: carga media del sistema en Linux; en otros sistemas, la CPU que usa el propio proceso. */
  private cpuPct(): number {
    const cores = cpus().length || 1;
    const load = loadavg()[0];
    if (load > 0) return Math.min(100, (load / cores) * 100);
    const now = Date.now();
    const used = process.cpuUsage(this.lastCpu);
    const elapsedUs = (now - this.lastCpuAt) * 1000;
    this.lastCpu = process.cpuUsage();
    this.lastCpuAt = now;
    return elapsedUs > 0 ? Math.min(100, ((used.user + used.system) / elapsedUs / cores) * 100) : 0;
  }

  current(): Sample {
    const mem = systemMemory();
    const rssMb = process.memoryUsage().rss / 1048576;
    const c = this.counts();
    if (c.connections <= 1) this.baseRssMb = Math.min(this.baseRssMb, rssMb);
    return {
      t: Date.now(),
      memPct: round(((mem.totalMb - mem.availableMb) / mem.totalMb) * 100),
      rssMb: round(rssMb),
      cpuPct: round(this.cpuPct()),
      lagMs: round(this.loop.percentile(99) / 1e6),
      ...c,
    };
  }

  record(): Sample {
    const s = this.current();
    this.loop.reset();
    this.history.push(s);
    const cutoff = Date.now() - KEEP_MS;
    while (this.history.length && this.history[0].t < cutoff) this.history.shift();
    return s;
  }

  /** Historial agrupado en tramos (se queda con el máximo de cada tramo: lo que importa son los picos). */
  series(rangeMs: number, bucketMs: number): Sample[] {
    const from = Date.now() - rangeMs;
    const out: Sample[] = [];
    let bucket: Sample[] = [];
    let bucketStart = 0;
    const flush = () => {
      if (!bucket.length) return;
      const max = (k: keyof Sample) => Math.max(...bucket.map((b) => b[k]));
      out.push({
        t: bucketStart,
        memPct: max('memPct'),
        rssMb: max('rssMb'),
        cpuPct: max('cpuPct'),
        lagMs: max('lagMs'),
        connections: max('connections'),
        rooms: max('rooms'),
        playing: max('playing'),
      });
      bucket = [];
    };
    for (const s of this.history) {
      if (s.t < from) continue;
      const start = s.t - (s.t % bucketMs);
      if (start !== bucketStart) {
        flush();
        bucketStart = start;
      }
      bucket.push(s);
    }
    flush();
    return out;
  }

  /** Cuántos jugadores más caben con la memoria que queda (estimación). */
  capacity(now: Sample): { perPlayerMb: number; estimatedMaxPlayers: number } {
    const mem = systemMemory();
    // Por jugador conectado: lo que ha crecido el proceso desde la base; mínimo 0,5 MB por prudencia.
    const measured = now.connections >= 4 ? (now.rssMb - this.baseRssMb) / now.connections : 0;
    const perPlayerMb = Math.max(0.5, measured);
    // Se deja libre un 15 % de la memoria para el sistema.
    const usableMb = Math.max(0, mem.availableMb - mem.totalMb * 0.15);
    return { perPlayerMb: round(perPlayerMb, 2), estimatedMaxPlayers: Math.floor(now.connections + usableMb / perPlayerMb) };
  }

  /** ¿Hay que ampliar el servidor? Mira la última hora (picos) para no alarmarse por un momento puntual. */
  advice(now: Sample): Advice {
    const lastHour = [...this.history.filter((s) => s.t > Date.now() - 60 * MINUTE), now];
    const p95 = (k: keyof Sample) => {
      const v = lastHour.map((s) => s[k]).sort((a, b) => a - b);
      return v[Math.min(v.length - 1, Math.floor(v.length * 0.95))];
    };
    const mem = p95('memPct');
    const cpu = p95('cpuPct');
    const lag = p95('lagMs');
    const reasons: string[] = [];
    let level = 'good' as Level;
    const raise = (l: Level, reason: string) => {
      reasons.push(reason);
      if (l === 'critical' || (l === 'warning' && level === 'good')) level = l;
    };
    if (mem >= 85) raise('critical', `La memoria está al ${mem} % en los picos de la última hora.`);
    else if (mem >= 70) raise('warning', `La memoria llega al ${mem} % en los picos.`);
    if (cpu >= 85) raise('critical', `La CPU está al ${cpu} % en los picos.`);
    else if (cpu >= 65) raise('warning', `La CPU llega al ${cpu} % en los picos.`);
    if (lag >= 200) raise('critical', `Hay retardos de ${lag} ms: los jugadores notan tirones.`);
    else if (lag >= 80) raise('warning', `Hay retardos de ${lag} ms en los picos.`);

    const title =
      level === 'critical'
        ? 'Amplía el servidor: se está quedando corto'
        : level === 'warning'
          ? 'Vigila: si crece el número de jugadores, se quedará corto'
          : 'Todo bien: el servidor va holgado';
    if (level === 'good') reasons.push('Memoria, CPU y retardo por debajo de los umbrales en la última hora.');
    return { level, title, reasons };
  }

  report(range: '24h' | '7d' = '24h') {
    const now = this.current();
    const series = range === '7d' ? this.series(7 * 24 * 60 * MINUTE, 30 * MINUTE) : this.series(24 * 60 * MINUTE, 5 * MINUTE);
    const day = this.history.filter((s) => s.t > Date.now() - 24 * 60 * MINUTE);
    const mem = systemMemory();
    return {
      now,
      advice: this.advice(now),
      capacity: this.capacity(now),
      system: { totalMemMb: Math.round(mem.totalMb), cores: cpus().length, uptimeMin: Math.round((Date.now() - this.startedAt) / MINUTE) },
      peaks24h: {
        connections: Math.max(now.connections, ...day.map((s) => s.connections)),
        memPct: Math.max(now.memPct, ...day.map((s) => s.memPct)),
        cpuPct: Math.max(now.cpuPct, ...day.map((s) => s.cpuPct)),
      },
      thresholds: { memWarn: 70, memCrit: 85, cpuWarn: 65, cpuCrit: 85, lagWarn: 80, lagCrit: 200 },
      range,
      series,
    };
  }
}

export type MetricsReport = ReturnType<Metrics['report']>;

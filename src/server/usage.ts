/**
 * Estadísticas de uso ANÓNIMAS para la beta: cuánta gente juega y cuánto (por día y por mes).
 *
 * Qué se guarda en disco (data/uso.json): solo totales. Ningún identificador, nombre ni IP.
 * Para contar jugadores distintos se usa, en memoria, una huella (hash) del identificador aleatorio
 * del jugador mezclada con una clave al azar que se genera al arrancar y nunca se guarda: no se puede
 * saber de quién es cada huella, y al reiniciar el servidor se olvidan todas. Por eso, si se reinicia
 * a mitad de mes, alguien puede contarse dos veces: los «jugadores distintos» son aproximados.
 * Ver docs/PANEL_SERVIDOR.md.
 */
import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export interface UsageCounts {
  /** Jugadores distintos (aproximado). */
  players: number;
  /** Partidas online empezadas. */
  matches: number;
  /** Partidas online terminadas (alguien ganó). */
  finished: number;
  /** Manos repartidas. */
  hands: number;
  /** Entradas en salas (cada vez que alguien entra a una sala). */
  visits: number;
  /** Partidas contra bots empezadas (las avisa el propio juego, de forma anónima). */
  practice: number;
  /** Partidas contra bots terminadas. */
  practiceFinished: number;
  /** Manos jugadas contra bots. */
  practiceHands: number;
  /** Reportes de jugadores (por mal comportamiento). */
  reports: number;
  /** Expulsiones de una mesa (por insultos o por reportes). */
  kicks: number;
}

interface UsageFile {
  version: 1;
  days: Record<string, UsageCounts>;
  months: Record<string, UsageCounts>;
}

const empty = (): UsageCounts => ({ players: 0, matches: 0, finished: 0, hands: 0, visits: 0, practice: 0, practiceFinished: 0, practiceHands: 0, reports: 0, kicks: 0 });
const KEEP_DAYS = 400;

/** Fecha local del servidor en formato AAAA-MM-DD y AAAA-MM. */
function keys(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return { day: `${y}-${m}-${day}`, month: `${y}-${m}` };
}

export class Usage {
  private data: UsageFile = { version: 1, days: {}, months: {} };
  private readonly salt = randomBytes(32);
  private seenDay = new Set<string>();
  private seenMonth = new Set<string>();
  private seenKeys = keys();
  private dirty = false;
  private timer: ReturnType<typeof setInterval> | null = null;

  /** @param file Ruta del fichero de totales; sin ella, solo en memoria (tests). */
  constructor(private file?: string) {
    if (file) {
      try {
        const parsed = JSON.parse(readFileSync(file, 'utf8')) as UsageFile;
        if (parsed?.version === 1) {
          const fill = (r: Record<string, UsageCounts>) => Object.fromEntries(Object.entries(r ?? {}).map(([k, v]) => [k, { ...empty(), ...v }]));
          this.data = { version: 1, days: fill(parsed.days), months: fill(parsed.months) };
        }
      } catch {
        // Primera vez o fichero ilegible: se empieza de cero.
      }
      this.timer = setInterval(() => this.save(), 60_000);
      this.timer.unref();
    }
  }

  private bump(field: keyof UsageCounts, n = 1) {
    const k = keys();
    if (k.day !== this.seenKeys.day) this.seenDay.clear();
    if (k.month !== this.seenKeys.month) this.seenMonth.clear();
    this.seenKeys = k;
    (this.data.days[k.day] ??= empty())[field] += n;
    (this.data.months[k.month] ??= empty())[field] += n;
    this.dirty = true;
  }

  /** Un jugador ha entrado en una sala. */
  player(playerId: string) {
    this.bump('visits');
    const h = createHash('sha256').update(this.salt).update(playerId).digest('base64');
    const k = keys();
    if (k.day !== this.seenKeys.day) this.seenDay.clear();
    if (k.month !== this.seenKeys.month) this.seenMonth.clear();
    this.seenKeys = k;
    if (!this.seenDay.has(h)) {
      this.seenDay.add(h);
      (this.data.days[k.day] ??= empty()).players++;
    }
    if (!this.seenMonth.has(h)) {
      this.seenMonth.add(h);
      (this.data.months[k.month] ??= empty()).players++;
    }
    this.dirty = true;
  }

  /** Cuenta a un jugador como activo (jugadores distintos) sin sumar una entrada en sala. */
  private seen(playerId: string) {
    const h = createHash('sha256').update(this.salt).update(playerId).digest('base64');
    const k = keys();
    if (k.day !== this.seenKeys.day) this.seenDay.clear();
    if (k.month !== this.seenKeys.month) this.seenMonth.clear();
    this.seenKeys = k;
    if (!this.seenDay.has(h)) {
      this.seenDay.add(h);
      (this.data.days[k.day] ??= empty()).players++;
    }
    if (!this.seenMonth.has(h)) {
      this.seenMonth.add(h);
      (this.data.months[k.month] ??= empty()).players++;
    }
    this.dirty = true;
  }

  /** Aviso anónimo de una partida contra bots: empieza, se juega una mano o termina. */
  practice(playerId: string, event: 'start' | 'hand' | 'end') {
    this.seen(playerId);
    this.bump(event === 'start' ? 'practice' : event === 'hand' ? 'practiceHands' : 'practiceFinished');
  }

  matchStarted() {
    this.bump('matches');
  }
  matchFinished() {
    this.bump('finished');
  }
  handPlayed() {
    this.bump('hands');
  }
  reported() {
    this.bump('reports');
  }
  kicked() {
    this.bump('kicks');
  }

  /** Guarda los totales (escritura atómica) y borra días de hace más de ~13 meses. */
  save() {
    if (!this.file || !this.dirty) return;
    const cutoff = keys(new Date(Date.now() - KEEP_DAYS * 86_400_000)).day;
    for (const d of Object.keys(this.data.days)) if (d < cutoff) delete this.data.days[d];
    try {
      mkdirSync(dirname(this.file), { recursive: true });
      const tmp = `${this.file}.tmp`;
      writeFileSync(tmp, JSON.stringify(this.data));
      renameSync(tmp, this.file);
      this.dirty = false;
    } catch (e) {
      console.error('No se pudieron guardar las estadísticas de uso:', e);
    }
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.save();
  }

  report() {
    const k = keys();
    const months = Object.entries(this.data.months)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, c]) => ({ month, ...c }));
    const days: { day: string; players: number; matches: number; finished: number; hands: number; visits: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const day = keys(new Date(Date.now() - i * 86_400_000)).day;
      days.push({ day, ...(this.data.days[day] ?? empty()) });
    }
    return {
      today: this.data.days[k.day] ?? empty(),
      thisMonth: this.data.months[k.month] ?? empty(),
      months,
      days,
    };
  }
}

export type UsageReport = ReturnType<Usage['report']>;

/**
 * Panel del servidor: ¿va holgado o hay que ampliarlo? ¿Cuánta gente juega?
 * Es una web aparte del juego que sirve el propio servidor SOLO en la máquina (127.0.0.1) y que se
 * publica únicamente en tu red de Tailscale. Ver docs/PANEL_SERVIDOR.md.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

interface Sample {
  t: number;
  memPct: number;
  rssMb: number;
  cpuPct: number;
  lagMs: number;
  connections: number;
  rooms: number;
  playing: number;
}

interface Report {
  now: Sample;
  advice: { level: 'good' | 'warning' | 'critical'; title: string; reasons: string[] };
  capacity: { perPlayerMb: number; estimatedMaxPlayers: number };
  system: { totalMemMb: number; cores: number; uptimeMin: number };
  peaks24h: { connections: number; memPct: number; cpuPct: number };
  thresholds: { memWarn: number; memCrit: number; cpuWarn: number; cpuCrit: number; lagWarn: number; lagCrit: number };
  range: '24h' | '7d';
  series: Sample[];
  usage?: UsageReport;
}

interface UsageCounts {
  players: number;
  matches: number;
  finished: number;
  hands: number;
  visits: number;
  practice?: number;
  practiceFinished?: number;
  practiceHands?: number;
  reports?: number;
  kicks?: number;
}

interface UsageReport {
  today: UsageCounts;
  thisMonth: UsageCounts;
  months: (UsageCounts & { month: string })[];
  days: (UsageCounts & { day: string })[];
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const monthLabel = (m: string) => `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(2, 4)}`;
const dayLabel = (d: string) => `${Number(d.slice(8, 10))}/${Number(d.slice(5, 7))}`;

const REFRESH_MS = 30_000;

// Colores (paleta de referencia de visualización): una serie = un tono; estados reservados, siempre con icono y texto.
const SERIES_COLOR = '#2a78d6';
const STATUS = {
  good: { color: '#0ca30c', icon: '✅', label: 'Bien' },
  warning: { color: '#fab219', icon: '⚠️', label: 'Vigilar' },
  critical: { color: '#d03b3b', icon: '⛔', label: 'Ampliar' },
} as const;

const fmtTime = (t: number, range: string) =>
  new Date(t).toLocaleString('es-ES', range === '7d' ? { weekday: 'short', hour: '2-digit', minute: '2-digit' } : { hour: '2-digit', minute: '2-digit' });

const levelFor = (v: number, warn: number, crit: number): keyof typeof STATUS => (v >= crit ? 'critical' : v >= warn ? 'warning' : 'good');

export function AdminApp() {
  const [range, setRange] = useState<'24h' | '7d'>('24h');
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`api/metrics?range=${range}`);
      if (!r.ok) {
        setError(`Error ${r.status}`);
        return;
      }
      setReport((await r.json()) as Report);
      setError(null);
      setUpdatedAt(Date.now());
    } catch {
      setError('No se puede conectar con el servidor.');
    }
  }, [range]);

  useEffect(() => {
    void load();
    const t = setInterval(load, REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  const th = report?.thresholds;
  const st = report ? STATUS[report.advice.level] : null;

  return (
    <main className="page admin">
      <nav className="topnav">
        <span>🃏 El Pablo · Panel del servidor</span>
        <span className="muted-light small">Solo accesible desde tu Tailscale</span>
      </nav>

      {error && <p className="banner warn">{error}</p>}
      {!report && !error && <p className="center-msg">Cargando…</p>}

      {report && st && th && (
        <>
          <section className="panel status-panel" style={{ borderLeftColor: st.color }}>
            <div className="status-head">
              <span className="status-chip" style={{ background: st.color, color: report.advice.level === 'warning' ? '#0b0b0b' : '#fff' }}>
                {st.icon} {st.label}
              </span>
              <strong>{report.advice.title}</strong>
            </div>
            <ul className="reasons">
              {report.advice.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            <p className="muted small">
              Servidor: {report.system.totalMemMb} MB de RAM · {report.system.cores} núcleo(s) · encendido hace {Math.floor(report.system.uptimeMin / 60)} h{' '}
              {report.system.uptimeMin % 60} min · actualizado {updatedAt ? new Date(updatedAt).toLocaleTimeString('es-ES') : '—'}
            </p>
          </section>

          <section className="tile-grid">
            <Tile label="Jugadores conectados" value={report.now.connections} sub={`Pico 24 h: ${report.peaks24h.connections}`} />
            <Tile label="Jugando ahora" value={report.now.playing} sub={`${report.now.rooms} sala(s) abiertas`} />
            <Tile
              label="Memoria en uso"
              value={`${report.now.memPct} %`}
              sub={`El juego usa ${report.now.rssMb} MB`}
              level={levelFor(report.now.memPct, th.memWarn, th.memCrit)}
            />
            <Tile label="CPU" value={`${report.now.cpuPct} %`} sub={`Pico 24 h: ${report.peaks24h.cpuPct} %`} level={levelFor(report.now.cpuPct, th.cpuWarn, th.cpuCrit)} />
            <Tile label="Retardo" value={`${report.now.lagMs} ms`} sub="Por encima de 80 ms se notan tirones" level={levelFor(report.now.lagMs, th.lagWarn, th.lagCrit)} />
            <Tile
              label="Capacidad estimada"
              value={`~${report.capacity.estimatedMaxPlayers}`}
              sub={`jugadores a la vez (≈${report.capacity.perPlayerMb} MB cada uno)`}
            />
          </section>

          <CostSection series={report.series} cores={report.system.cores} />

          {report.usage && <UsageSection usage={report.usage} />}

          <h3 className="section-title">Carga del servidor</h3>
          <div className="segmented range-switch" role="group" aria-label="Periodo">
            {(['24h', '7d'] as const).map((r) => (
              <button key={r} className={range === r ? 'on' : ''} onClick={() => setRange(r)}>
                {r === '24h' ? 'Últimas 24 h' : 'Últimos 7 días'}
              </button>
            ))}
          </div>

          <LineChart title="Memoria en uso (%)" data={report.series} field="memPct" unit=" %" max={100} range={range} refLines={[th.memWarn, th.memCrit]} />
          <LineChart title="CPU (%)" data={report.series} field="cpuPct" unit=" %" max={100} range={range} refLines={[th.cpuWarn, th.cpuCrit]} />
          <LineChart title="Jugadores conectados" data={report.series} field="connections" unit="" range={range} />

          <details className="panel data-table">
            <summary>Ver los datos en tabla</summary>
            <table className="matches">
              <thead>
                <tr>
                  <th>Hora</th>
                  <th>Memoria</th>
                  <th>CPU</th>
                  <th>Retardo</th>
                  <th>Jugadores</th>
                  <th>Salas</th>
                </tr>
              </thead>
              <tbody>
                {report.series
                  .slice()
                  .reverse()
                  .map((s) => (
                    <tr key={s.t}>
                      <td>{fmtTime(s.t, range)}</td>
                      <td>{s.memPct} %</td>
                      <td>{s.cpuPct} %</td>
                      <td>{s.lagMs} ms</td>
                      <td>{s.connections}</td>
                      <td>{s.rooms}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </details>

          <section className="panel">
            <h3>¿Cuándo ampliar?</h3>
            <ul className="reasons">
              <li>
                <strong>⚠️ Vigilar</strong>: memoria por encima del {th.memWarn} %, CPU del {th.cpuWarn} % o retardo de {th.lagWarn} ms en los picos de la
                última hora. Ve mirando opciones.
              </li>
              <li>
                <strong>⛔ Ampliar</strong>: memoria por encima del {th.memCrit} %, CPU del {th.cpuCrit} % o retardo de {th.lagCrit} ms. Los jugadores ya lo
                notan: pasa a un servidor con el doble de RAM.
              </li>
              <li>Si la «capacidad estimada» se acerca a vuestro pico de jugadores, amplía antes de que llegue.</li>
            </ul>
          </section>
        </>
      )}
    </main>
  );
}

// ---------------------------------------------------------------- Coste de la luz

interface CostSettings {
  idleW: number;
  maxW: number;
  priceKwh: number;
  extraMonth: number;
}
// Clave nueva: así los navegadores que guardaron los valores genéricos antiguos (45/150 W) usan los medidos.
const COST_KEY = 'pablo.admin.coste';
/**
 * Valores de la torre del servidor (HP Slimline con Core i3): el procesador medido con RAPL gasta ~1 W
 * con 6 personas jugando → torre ≈ (1 + 8) ÷ 0,8 ≈ 12 W. Luz: precio típico en España. Se cambian en el panel.
 */
const COST_DEFAULTS: CostSettings = { idleW: 12, maxW: 60, priceKwh: 0.15, extraMonth: 0 };
const HOURS_MONTH = 730; // 365 × 24 / 12

function loadCost(): CostSettings {
  try {
    return { ...COST_DEFAULTS, ...(JSON.parse(localStorage.getItem(COST_KEY) ?? '{}') as Partial<CostSettings>) };
  } catch {
    return COST_DEFAULTS;
  }
}

const eur = (v: number) => v.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 });

/**
 * Estimación de lo que cuesta al mes tener el servidor encendido.
 * Consumo ≈ reposo + (a tope − reposo) × CPU media que usa el juego. Es una estimación: para saberlo
 * exacto, mide el ordenador con un enchufe medidor y pon aquí los vatios.
 */
function CostSection({ series }: { series: Sample[]; cores: number }) {
  const [cfg, setCfgState] = useState<CostSettings>(loadCost);
  const [open, setOpen] = useState(false);
  // Solo se guarda lo que cambias tú: si no tocas nada, siempre se usan los valores por defecto.
  const setCfg = (c: CostSettings) => {
    setCfgState(c);
    localStorage.setItem(COST_KEY, JSON.stringify(c));
  };

  const avgCpu = series.length ? series.reduce((s, x) => s + x.cpuPct, 0) / series.length : 0;
  const gameW = Math.max(0, cfg.maxW - cfg.idleW) * (avgCpu / 100);
  const totalW = cfg.idleW + gameW;
  const kwhMonth = (totalW * HOURS_MONTH) / 1000;
  const lightMonth = kwhMonth * cfg.priceKwh;
  const gameMonth = ((gameW * HOURS_MONTH) / 1000) * cfg.priceKwh;
  const total = lightMonth + cfg.extraMonth;

  const field = (key: keyof CostSettings, label: string, step: number, unit: string) => (
    <label className="cost-field">
      <span>{label}</span>
      <span className="cost-input">
        <input
          type="number"
          min={0}
          step={step}
          value={cfg[key]}
          onChange={(e) => setCfg({ ...cfg, [key]: Math.max(0, Number(e.target.value) || 0) })}
        />
        {unit}
      </span>
    </label>
  );

  return (
    <section className="panel cost-panel">
      <h3>💶 Coste estimado al mes</h3>
      <section className="tile-grid">
        <Tile label="Total al mes" value={eur(total)} sub={`≈ ${eur(total * 12)} al año`} />
        <Tile label="Luz del ordenador" value={eur(lightMonth)} sub={`${Math.round(totalW)} W de media · ${Math.round(kwhMonth)} kWh/mes`} />
        <Tile label="Lo que añade el juego" value={eur(gameMonth)} sub={`CPU media del juego: ${avgCpu.toFixed(1)} %`} />
      </section>
      <p className="muted small">
        Encendido las 24 h, con la luz a {cfg.priceKwh.toLocaleString('es-ES')} €/kWh
        {cfg.extraMonth > 0 ? ` y ${eur(cfg.extraMonth)} de otros gastos` : ''}. Si el ordenador ya lo tenías encendido igualmente, lo que de verdad te
        cuesta el juego es «lo que añade el juego». No incluye la parte fija de la factura (potencia contratada).
      </p>
      <button className="link" onClick={() => setOpen(!open)}>
        {open ? 'Ocultar ajustes' : 'Ajustar consumo y precio'}
      </button>
      {open && (
        <div className="cost-form">
          {field('idleW', 'Consumo del ordenador en reposo', 5, 'W')}
          {field('maxW', 'Consumo a tope', 5, 'W')}
          {field('priceKwh', 'Precio de la luz (mira tu factura)', 0.01, '€/kWh')}
          {field('extraMonth', 'Otros gastos al mes (dominio, etc.)', 0.5, '€')}
          <p className="muted small">
            Para saber el consumo real, enchufa el ordenador a un medidor de consumo (unos 10 € en cualquier ferretería) y apunta los vatios en
            reposo. Se guarda solo en este navegador. <button className="link" onClick={() => setCfg(COST_DEFAULTS)}>Volver a los valores de la torre</button>
          </p>
        </div>
      )}
    </section>
  );
}

function Tile({ label, value, sub, level }: { label: string; value: string | number; sub: string; level?: keyof typeof STATUS }) {
  const s = level ? STATUS[level] : null;
  return (
    <div className="stat admin-tile">
      <span>{label}</span>
      <strong>{value}</strong>
      <span className="muted small">{sub}</span>
      {s && level !== 'good' && (
        <span className="tile-status" style={{ color: '#3b3b3b' }}>
          <span aria-hidden="true">{s.icon}</span> {s.label}
        </span>
      )}
    </div>
  );
}

/** Gráfica de una sola serie (sin leyenda: el título la nombra), con cruz y etiqueta al pasar por encima. */
function LineChart({
  title,
  data,
  field,
  unit,
  max,
  range,
  refLines = [],
}: {
  title: string;
  data: Sample[];
  field: keyof Sample;
  unit: string;
  max?: number;
  range: string;
  refLines?: number[];
}) {
  const W = 640;
  const H = 170;
  const pad = { l: 36, r: 12, t: 10, b: 24 };
  const ref = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  if (data.length < 2) {
    return (
      <section className="panel chart">
        <h4>{title}</h4>
        <p className="muted small">Aún no hay suficientes datos: se guarda una muestra por minuto.</p>
      </section>
    );
  }
  const yMax = max ?? Math.max(4, ...data.map((d) => d[field] as number)) * 1.2;
  const t0 = data[0].t;
  const t1 = data[data.length - 1].t;
  const x = (t: number) => pad.l + ((t - t0) / Math.max(1, t1 - t0)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - v / yMax) * (H - pad.t - pad.b);
  const path = data.map((d, i) => `${i ? 'L' : 'M'}${x(d.t).toFixed(1)},${y(d[field] as number).toFixed(1)}`).join(' ');
  const ticks = [0, yMax / 2, yMax].map((v) => Math.round(v));

  const onMove = (e: React.PointerEvent) => {
    const svg = ref.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    for (let i = 1; i < data.length; i++) if (Math.abs(x(data[i].t) - px) < Math.abs(x(data[best].t) - px)) best = i;
    setHover(best);
  };
  const h = hover !== null ? data[hover] : null;

  return (
    <section className="panel chart">
      <h4>{title}</h4>
      <div className="chart-wrap">
        <svg
          ref={ref}
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`${title}: último valor ${data[data.length - 1][field]}${unit}`}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        >
          {ticks.map((v) => (
            <g key={v}>
              <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="#e4e1d8" strokeWidth="1" />
              <text x={pad.l - 6} y={y(v) + 4} textAnchor="end" className="axis-label">
                {v}
              </text>
            </g>
          ))}
          {refLines.map((v) => (
            <line key={`r${v}`} x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="#8a8780" strokeWidth="1" strokeDasharray="4 4" />
          ))}
          <path d={path} fill="none" stroke={SERIES_COLOR} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          <text x={pad.l} y={H - 6} className="axis-label">
            {fmtTime(t0, range)}
          </text>
          <text x={W - pad.r} y={H - 6} textAnchor="end" className="axis-label">
            {fmtTime(t1, range)}
          </text>
          {h && (
            <g>
              <line x1={x(h.t)} x2={x(h.t)} y1={pad.t} y2={H - pad.b} stroke="#8a8780" strokeWidth="1" />
              <circle cx={x(h.t)} cy={y(h[field] as number)} r="4" fill={SERIES_COLOR} stroke="#fcfcfb" strokeWidth="2" />
            </g>
          )}
        </svg>
        {h && (
          <div className="chart-tip" style={{ left: `${(x(h.t) / W) * 100}%` }}>
            <strong>
              {h[field]}
              {unit}
            </strong>
            <span>{fmtTime(h.t, range)}</span>
          </div>
        )}
      </div>
    </section>
  );
}

/** Uso del juego para la beta: cuánta gente juega de verdad (datos anónimos, solo totales). */
function UsageSection({ usage }: { usage: UsageReport }) {
  const m = usage.thisMonth;
  return (
    <>
      <h3 className="section-title">Uso del juego (beta)</h3>
      <section className="tile-grid">
        <Tile label="Jugadores este mes" value={m.players} sub={`Hoy: ${usage.today.players}`} />
        <Tile label="Partidas online este mes" value={m.matches} sub={`${m.finished} terminadas · ${m.hands} manos`} />
        <Tile label="Partidas contra bots este mes" value={m.practice ?? 0} sub={`${m.practiceFinished ?? 0} terminadas · ${m.practiceHands ?? 0} manos`} />
        <Tile label="Entradas en salas" value={m.visits} sub="este mes (incluye reconexiones)" />
        <Tile label="Reportes este mes" value={m.reports ?? 0} sub={`${m.kicks ?? 0} expulsiones por reportes`} />
      </section>
      <BarChart
        title="Jugadores distintos por mes"
        bars={usage.months.map((x) => ({ label: monthLabel(x.month), value: x.players, detail: `${x.matches} online · ${x.practice ?? 0} contra bots` }))}
      />
      <BarChart
        title="Jugadores distintos por día (últimos 30 días)"
        bars={usage.days.map((x) => ({ label: dayLabel(x.day), value: x.players, detail: `${x.matches} online · ${x.practice ?? 0} contra bots` }))}
        sparseLabels
      />
      <details className="panel data-table">
        <summary>Ver el uso por meses en tabla</summary>
        <table className="matches">
          <thead>
            <tr>
              <th>Mes</th>
              <th>Jugadores</th>
              <th>Online</th>
              <th>Contra bots</th>
              <th>Manos</th>
            </tr>
          </thead>
          <tbody>
            {usage.months
              .slice()
              .reverse()
              .map((x) => (
                <tr key={x.month}>
                  <td>{monthLabel(x.month)}</td>
                  <td>{x.players}</td>
                  <td>{x.matches}</td>
                  <td>{x.practice ?? 0}</td>
                  <td>{x.hands + (x.practiceHands ?? 0)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </details>
      <p className="muted small">
        Datos anónimos: solo se guardan totales, sin nombres, identificadores ni direcciones IP. «Jugadores distintos» es aproximado (si el servidor se
        reinicia a mitad de mes, alguien puede contarse dos veces). Las partidas contra bots se cuentan si el móvil tiene conexión.
      </p>
    </>
  );
}

/** Barras de una sola serie (el título la nombra), con la cifra al pasar por encima. */
function BarChart({ title, bars, sparseLabels }: { title: string; bars: { label: string; value: number; detail?: string }[]; sparseLabels?: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640;
  const H = 170;
  const pad = { l: 36, r: 8, t: 10, b: 24 };
  if (bars.length === 0 || bars.every((b) => b.value === 0)) {
    return (
      <section className="panel chart">
        <h4>{title}</h4>
        <p className="muted small">Aún no hay datos.</p>
      </section>
    );
  }
  const max = Math.max(1, ...bars.map((b) => b.value));
  const yMax = Math.ceil(max * 1.15);
  const slot = (W - pad.l - pad.r) / bars.length;
  const bw = Math.max(2, slot - 2); // 2 px de separación entre barras
  const y = (v: number) => pad.t + (1 - v / yMax) * (H - pad.t - pad.b);
  const h = hover !== null ? bars[hover] : null;
  return (
    <section className="panel chart">
      <h4>{title}</h4>
      <div className="chart-wrap">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}: último valor ${bars[bars.length - 1].value}`} onPointerLeave={() => setHover(null)}>
          {[0, Math.round(yMax / 2), yMax].map((v) => (
            <g key={v}>
              <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="#e4e1d8" strokeWidth="1" />
              <text x={pad.l - 6} y={y(v) + 4} textAnchor="end" className="axis-label">
                {v}
              </text>
            </g>
          ))}
          {bars.map((b, i) => {
            const x = pad.l + i * slot + 1;
            const top = y(b.value);
            const height = H - pad.b - top;
            const r = Math.min(4, bw / 2, height);
            return (
              <g key={b.label + i} onPointerEnter={() => setHover(i)}>
                {/* Zona sensible más grande que la barra */}
                <rect x={x - 1} y={pad.t} width={slot} height={H - pad.t - pad.b} fill="transparent" />
                {b.value > 0 && (
                  <path
                    d={`M${x},${H - pad.b} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${H - pad.b} Z`}
                    fill={SERIES_COLOR}
                    opacity={hover === null || hover === i ? 1 : 0.55}
                  />
                )}
                {(!sparseLabels || i % 5 === 0 || i === bars.length - 1) && (
                  <text x={x + bw / 2} y={H - 6} textAnchor="middle" className="axis-label">
                    {b.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        {h && hover !== null && (
          <div className="chart-tip" style={{ left: `${((pad.l + hover * slot + slot / 2) / W) * 100}%` }}>
            <strong>{h.value}</strong>
            <span>{h.label}</span>
            {h.detail && <span>{h.detail}</span>}
          </div>
        )}
      </div>
    </section>
  );
}

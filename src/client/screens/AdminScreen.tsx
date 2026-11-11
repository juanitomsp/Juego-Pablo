/**
 * Panel de control del servidor (#/admin): ¿va holgado o hay que ampliarlo?
 * Pide la contraseña del panel (ADMIN_TOKEN del servidor), que se guarda solo en este dispositivo.
 * Ver docs/PANEL_SERVIDOR.md.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { go } from '../App';

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
}

const TOKEN_KEY = 'pablo.adminToken';
const SERVER = ((import.meta.env.VITE_SERVER_URL as string | undefined) || '').replace(/\/$/, '');
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

export function AdminScreen() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) ?? '');
  const [input, setInput] = useState('');
  const [range, setRange] = useState<'24h' | '7d'>('24h');
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch(`${SERVER}/api/admin/metrics?range=${range}`, { headers: { Authorization: `Bearer ${token}` } });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(body.error ?? `Error ${r.status}`);
        if (r.status === 401) {
          localStorage.removeItem(TOKEN_KEY);
          setToken('');
        }
        return;
      }
      setReport(body as Report);
      setError(null);
      setUpdatedAt(Date.now());
    } catch {
      setError('No se puede conectar con el servidor.');
    }
  }, [token, range]);

  useEffect(() => {
    void load();
    const t = setInterval(load, REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  if (!token) {
    return (
      <main className="page narrow">
        <nav className="topnav">
          <button className="link" onClick={() => go('/')}>
            ← Inicio
          </button>
          <span>Panel del servidor</span>
        </nav>
        <section className="panel">
          <h3>Contraseña del panel</h3>
          <p className="muted small">
            Es el <code>ADMIN_TOKEN</code> del servidor. En tu servidor la ves con <code>sudo cat /etc/pablo/admin-token</code>. Se guarda solo
            en este dispositivo.
          </p>
          <input type="password" value={input} autoComplete="off" onChange={(e) => setInput(e.target.value)} placeholder="Contraseña" />
          <div className="row">
            <button
              className="primary"
              disabled={!input.trim()}
              onClick={() => {
                localStorage.setItem(TOKEN_KEY, input.trim());
                setToken(input.trim());
                setInput('');
              }}
            >
              Entrar
            </button>
          </div>
          {error && <p className="error">{error}</p>}
        </section>
      </main>
    );
  }

  const th = report?.thresholds;
  const st = report ? STATUS[report.advice.level] : null;

  return (
    <main className="page admin">
      <nav className="topnav">
        <button className="link" onClick={() => go('/')}>
          ← Inicio
        </button>
        <span>Panel del servidor</span>
        <button
          className="link"
          onClick={() => {
            localStorage.removeItem(TOKEN_KEY);
            setToken('');
          }}
        >
          Salir
        </button>
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

import { useEffect, useState } from 'react';
import { go } from '../App';
import { clearLocalData } from '../services/identity';
import { MatchSummary, aggregate, loadMatches } from '../services/stats';

const MODE: Record<string, string> = { online: 'Online', practica: 'Práctica', vivo: 'En vivo' };

export function StatsScreen() {
  const [list, setList] = useState<MatchSummary[] | null>(null);

  const reload = () => {
    setList(null);
    void loadMatches().then(setList);
  };
  useEffect(reload, []);

  const agg = aggregate(list ?? []);

  const download = () => {
    const blob = new Blob([JSON.stringify(list ?? [], null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'mis-partidas-pablo.json';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <main className="page">
      <nav className="topnav">
        <button className="link" onClick={() => go('/')}>
          ← Inicio
        </button>
        <span>Estadísticas</span>
      </nav>

      <section className="panel">
        <p className="muted small">
          Tus partidas se guardan <strong>solo en este dispositivo</strong>: no se envían a ningún sitio. Si desinstalas la app o borras los datos del
          navegador, se pierden.
        </p>
      </section>

      <section className="panel">
        <h3>Resumen</h3>
        {list === null ? (
          <p>Cargando…</p>
        ) : list.length === 0 ? (
          <p className="muted">Aún no hay partidas terminadas.</p>
        ) : (
          <div className="stat-grid">
            <Stat label="Partidas" value={agg.played} />
            <Stat label="Ganadas" value={agg.won} />
            <Stat label="Perdidas" value={agg.lost} />
            <Stat label="% victorias" value={`${agg.winRate}%`} />
            <Stat label="Bazas ganadas" value={agg.tricks} />
            <Stat label="Apuestas hechas" value={agg.bets} />
            <Stat label="Apuestas ganadas" value={agg.betsWon} />
          </div>
        )}
      </section>

      {list && list.length > 0 && (
        <section className="panel">
          <h3>Últimas partidas</h3>
          <table className="matches">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Modo</th>
                <th>Jug.</th>
                <th>Resultado</th>
                <th>Pablos</th>
                <th>Bazas</th>
              </tr>
            </thead>
            <tbody>
              {list.slice(0, 50).map((m) => (
                <tr key={m.id}>
                  <td>{new Date(m.date).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}</td>
                  <td>{MODE[m.mode] ?? m.mode}</td>
                  <td>{m.players}</td>
                  <td>{m.won === null ? '—' : m.won ? '✅ Ganada' : '❌ Perdida'}</td>
                  <td>
                    {m.pablos[0]}–{m.pablos[1]}
                  </td>
                  <td>{m.tricksWon}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="panel">
        <h3>Tus datos</h3>
        <div className="row">
          <button onClick={download} disabled={!list?.length}>
            Descargar mis datos (JSON)
          </button>
          <button
            className="danger"
            onClick={() => {
              if (!confirm('Se borrarán el apodo, el marcador en vivo y las partidas guardadas en este navegador. ¿Continuar?')) return;
              clearLocalData();
              reload();
            }}
          >
            Borrar datos de este navegador
          </button>

        </div>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="stat">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

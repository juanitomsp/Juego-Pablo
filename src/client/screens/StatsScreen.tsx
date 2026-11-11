import { useEffect, useState } from 'react';
import { go } from '../App';
import { useAccount } from '../account';
import { availableProviders, deleteAccountAndData, signIn, signOutUser } from '../services/firebase';
import { adsPrivacyOptionsRequired, isNativeApp, showAdsPrivacyOptions } from '../native/ads';
import { clearLocalData } from '../services/identity';
import { MatchSummary, aggregate, loadLocalMatches, loadMatches, uploadLocalMatches } from '../services/stats';

const MODE: Record<string, string> = { online: 'Online', practica: 'Práctica', vivo: 'En vivo' };

export function StatsScreen() {
  const { enabled, user, ready } = useAccount();
  const [list, setList] = useState<MatchSummary[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  const reload = () => {
    setList(null);
    void loadMatches().then(setList);
  };
  useEffect(() => {
    if (ready) reload();
  }, [ready, user?.uid]);

  const safe = async (fn: () => Promise<unknown>, ok?: string) => {
    try {
      await fn();
      if (ok) setMsg(ok);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Algo ha fallado.');
    }
  };

  const agg = aggregate(list ?? []);
  const localCount = loadLocalMatches().length;

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
        <h3>Cuenta</h3>
        {!enabled && (
          <p className="muted">
            Las cuentas aún no están activadas en este servidor. Tus partidas se guardan solo en este navegador. (Para activarlas, ver{' '}
            <code>docs/CUENTAS_Y_DATOS.md</code>.)
          </p>
        )}
        {enabled && !user && (
          <>
            <p>Entra con Google para guardar tus estadísticas y verlas en cualquier dispositivo. Es opcional: puedes jugar sin cuenta.</p>
            <label className="toggle">
              <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} /> He leído la{' '}
              <a href="#/privacidad">política de privacidad</a>
            </label>
            <div className="row">
              {availableProviders().map((p) => (
                <button key={p} className="primary" disabled={!accepted} onClick={() => safe(() => signIn(p))}>
                  {p === 'apple' ? ' Iniciar sesión con Apple' : 'Entrar con Google'}
                </button>
              ))}
            </div>
          </>
        )}
        {enabled && user && (
          <>
            <p>
              Sesión iniciada{user.displayName ? ` como ${user.displayName}` : ''}. Tus partidas se guardan en tu cuenta.
            </p>
            <div className="row">
              {localCount > 0 && (
                <button onClick={() => safe(async () => setMsg(`Subidas ${await uploadLocalMatches(user.uid)} partidas.`)).then(reload)}>
                  Subir partidas de este dispositivo ({localCount})
                </button>
              )}
              <button onClick={() => safe(signOutUser)}>Cerrar sesión</button>
              <button
                className="danger"
                onClick={() =>
                  confirm('Se borrarán tu cuenta y todas tus partidas guardadas en la nube. No se puede deshacer. ¿Continuar?') &&
                  safe(() => deleteAccountAndData(user.uid), 'Cuenta y datos borrados.')
                }
              >
                Borrar mi cuenta y mis datos
              </button>
            </div>
          </>
        )}
        {msg && <p className="muted">{msg}</p>}
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
          {isNativeApp() && adsPrivacyOptionsRequired() && (
            <button onClick={() => safe(showAdsPrivacyOptions)}>Privacidad de los anuncios</button>
          )}
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

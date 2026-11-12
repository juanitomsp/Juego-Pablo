import { useCallback, useEffect, useState } from 'react';
import type { PublicRoom } from '../../shared/protocol';
import { go } from '../App';
import { Icon } from '../components/Icon';
import { SpectatorCount } from '../components/SpectatorCount';
import { createRoom, fetchPublicRooms } from '../services/controller';
import { getName } from '../services/identity';

/**
 * Partidas públicas: salas abiertas a cualquiera, para jugar con gente de todo el mundo
 * o mirar partidas en curso. Se actualiza sola cada pocos segundos.
 */
export function PublicRooms() {
  const [rooms, setRooms] = useState<PublicRoom[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetchPublicRooms();
    if (r) {
      setRooms(r);
      setFailed(false);
    } else setFailed(true);
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 5000);
    return () => clearInterval(t);
  }, [load]);

  const needName = () => {
    if (getName().trim()) return false;
    setError('Antes, escribe tu apodo en la pantalla de inicio.');
    return true;
  };

  const create = async (players: 4 | 6) => {
    if (needName()) return;
    setBusy(true);
    setError(null);
    const r = await createRoom({ players }, true);
    setBusy(false);
    if (r.code) go(`/sala/${r.code}`);
    else setError(r.error ?? 'No se pudo crear la sala.');
  };

  const waiting = rooms?.filter((r) => !r.started) ?? [];
  const playing = rooms?.filter((r) => r.started) ?? [];

  return (
    <main className="page public-rooms">
      <nav className="topnav">
        <button className="link" onClick={() => go('/')}>
          ← Inicio
        </button>
        <span>Partidas públicas</span>
      </nav>

      <section className="panel">
        <h2>
          <Icon name="globe" size={22} /> Juega con gente de todas partes
        </h2>
        <p className="muted">
          Únete a una mesa que esté buscando jugadores o crea la tuya. También puedes mirar partidas que ya se están jugando.
          Recuerda: en el chat no se puede insultar.
        </p>
        <div className="row">
          <button className="primary" disabled={busy} onClick={() => create(4)}>
            Crear mesa pública 2 contra 2
          </button>
          <button disabled={busy} onClick={() => create(6)}>
            3 contra 3
          </button>
        </div>
        {error && <p className="error">{error}</p>}
      </section>

      {failed && !rooms && <p className="error">No se puede conectar con el servidor. Comprueba tu conexión.</p>}
      {!rooms && !failed && <p className="muted center">Buscando partidas…</p>}

      {rooms && (
        <>
          <section className="panel">
            <h3>Buscando jugadores</h3>
            {waiting.length === 0 ? (
              <p className="muted">Ahora mismo no hay mesas esperando. ¡Crea una y que se unan los demás!</p>
            ) : (
              <ul className="room-list">
                {waiting.map((r) => (
                  <li key={r.code} className="room-item">
                    <div className="room-main">
                      <strong>{r.players === 4 ? '2 contra 2' : '3 contra 3'}</strong>
                      <span className="muted small">
                        {r.seated}/{r.players} jugadores
                      </span>
                    </div>
                    <SeatDots seated={r.seated} total={r.players} />
                    <div className="row tight">
                      <button className="primary" disabled={r.seated >= r.players} onClick={() => !needName() && go(`/sala/${r.code}`)}>
                        Unirme
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel">
            <h3>Jugándose ahora</h3>
            {playing.length === 0 ? (
              <p className="muted">No hay partidas públicas en juego en este momento.</p>
            ) : (
              <ul className="room-list">
                {playing.map((r) => (
                  <li key={r.code} className="room-item">
                    <div className="room-main">
                      <strong>{r.players === 4 ? '2 contra 2' : '3 contra 3'}</strong>
                      {r.score && (
                        <span className="muted small">
                          Marcador {r.score[0]} – {r.score[1]}
                        </span>
                      )}
                    </div>
                    <SpectatorCount n={r.spectators} />
                    <button onClick={() => !needName() && go(`/ver/${r.code}`)}>
                      <Icon name="eye" size={16} /> Mirar
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}

function SeatDots({ seated, total }: { seated: number; total: number }) {
  return (
    <span className="seat-dots" aria-hidden="true">
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={i < seated ? 'full' : ''} />
      ))}
    </span>
  );
}

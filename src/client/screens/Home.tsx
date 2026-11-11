import { useState } from 'react';
import { go } from '../App';
import { useAccount } from '../account';
import { createRoom } from '../services/controller';
import { getName, setName } from '../services/identity';
import { CardView } from '../components/CardView';

export function Home() {
  const [name, setNameState] = useState(getName());
  const [code, setCode] = useState('');
  const [players, setPlayers] = useState<4 | 6>(4);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { enabled, user } = useAccount();

  const saveName = (v: string) => {
    setNameState(v);
    setName(v);
  };

  const create = async () => {
    if (!name.trim()) return setError('Escribe tu apodo primero.');
    setBusy(true);
    setError(null);
    const r = await createRoom({ players });
    setBusy(false);
    if (r.code) go(`/sala/${r.code}`);
    else setError(r.error ?? 'No se pudo crear la sala.');
  };

  const join = () => {
    if (!name.trim()) return setError('Escribe tu apodo primero.');
    const c = code.trim().toUpperCase();
    if (c.length < 4) return setError('Escribe el código de la sala.');
    go(`/sala/${c}`);
  };

  return (
    <main className="home">
      <section className="hero">
        <div className="hero-cards" aria-hidden="true">
          <CardView card={{ suit: 'bastos', rank: 4 }} trump="copas" hints />
          <CardView card={{ suit: 'oros', rank: 11 }} trump="copas" hints />
          <CardView card={{ suit: 'copas', rank: 3 }} trump="copas" hints />
        </div>
        <h1>El Pablo</h1>
        <p className="tagline">El juego de naipes de Níjar y Mairena del Alcor, ahora para jugar desde cualquier sitio.</p>
      </section>

      <section className="panel">
        <label className="field">
          <span>Tu apodo</span>
          <input value={name} maxLength={20} placeholder="Por ejemplo: Juanito" onChange={(e) => saveName(e.target.value)} />
        </label>
        <p className="muted small">
          No hace falta cuenta. El apodo solo lo ven los jugadores de tu mesa.
          {enabled && !user && ' Si quieres guardar tus estadísticas en la nube, puedes entrar con Google en Estadísticas.'}
        </p>
      </section>

      <section className="panel">
        <h2>Jugar online con amigos</h2>
        <div className="row">
          <div className="segmented">
            <button className={players === 4 ? 'on' : ''} onClick={() => setPlayers(4)}>
              4 jugadores
            </button>
            <button className={players === 6 ? 'on' : ''} onClick={() => setPlayers(6)}>
              6 jugadores
            </button>
          </div>
          <button className="primary" disabled={busy} onClick={create}>
            {busy ? 'Creando…' : 'Crear sala'}
          </button>
        </div>
        <div className="row">
          <input
            className="code-input"
            value={code}
            maxLength={6}
            placeholder="CÓDIGO"
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && join()}
          />
          <button onClick={join}>Unirse</button>
        </div>
        {error && <p className="error">{error}</p>}
      </section>

      <section className="menu-grid">
        <button className="menu-tile" onClick={() => go('/practica')}>
          <strong>🤖 Practicar</strong>
          <span>Partida contra bots, sin conexión.</span>
        </button>
        <button className="menu-tile" onClick={() => go('/vivo')}>
          <strong>🃏 Marcador en vivo</strong>
          <span>Juega con baraja de verdad y lleva aquí los puntos.</span>
        </button>
        <button className="menu-tile" onClick={() => go('/reglas')}>
          <strong>📖 Reglas</strong>
          <span>Cómo se juega, valores y señas.</span>
        </button>
        <button className="menu-tile" onClick={() => go('/estadisticas')}>
          <strong>📊 Estadísticas</strong>
          <span>{user ? 'Tus partidas guardadas en tu cuenta.' : 'Tus partidas en este dispositivo.'}</span>
        </button>
      </section>

      <footer className="site-footer">
        <a href="#/privacidad">Privacidad</a> · <a href="#/reglas">Reglas</a> · <a href="#/baraja">Ver la baraja</a> · Reglas basadas en el artículo «Paulo (juego de naipes)» de Wikipedia (CC BY-SA 4.0)
      </footer>
    </main>
  );
}

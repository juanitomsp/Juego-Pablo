import { useState } from 'react';
import { go } from '../App';
import { createRoom } from '../services/controller';
import { getName, setName } from '../services/identity';
import { CardView } from '../components/CardView';
import { Icon, type IconName } from '../components/Icon';
import { tutorialDone } from './TutorialScreen';

export function Home() {
  const [name, setNameState] = useState(getName());
  const [code, setCode] = useState('');
  const [players, setPlayers] = useState<4 | 6>(4);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOnline, setShowOnline] = useState(false);

  const saveName = (v: string) => {
    setNameState(v);
    setName(v);
  };

  const needName = () => {
    if (name.trim()) return false;
    setError('Escribe tu apodo primero.');
    document.getElementById('apodo')?.focus();
    return true;
  };

  const create = async () => {
    if (needName()) return;
    setBusy(true);
    setError(null);
    const r = await createRoom({ players });
    setBusy(false);
    if (r.code) go(`/sala/${r.code}`);
    else setError(r.error ?? 'No se pudo crear la sala.');
  };

  const join = () => {
    if (needName()) return;
    const c = code.trim().toUpperCase();
    if (c.length < 4) return setError('Escribe el código de la sala.');
    go(`/sala/${c}`);
  };

  return (
    <main className="home">
      <header className="hero">
        <div className="hero-fan" aria-hidden="true">
          <CardView card={{ suit: 'oros', rank: 11 }} trump="copas" />
          <CardView card={{ suit: 'bastos', rank: 4 }} trump="copas" />
          <CardView card={{ suit: 'copas', rank: 3 }} trump="copas" />
        </div>
        <h1 className="wordmark">El Pablo</h1>
        <p className="tagline">El juego de cartas de Níjar y Mairena del Alcor</p>
      </header>

      <section className="panel name-panel">
        <label className="field" htmlFor="apodo">
          <span>Tu apodo</span>
        </label>
        <input id="apodo" value={name} maxLength={20} placeholder="¿Cómo te llamamos?" onChange={(e) => saveName(e.target.value)} />
        <p className="muted small">Sin registro. Solo lo ven los jugadores de tu mesa.</p>
      </section>

      {!tutorialDone() && (
        <section className="panel tut-banner">
          <div>
            <strong>¿Primera vez?</strong> Aprende a jugar en 2 minutos, con ejemplos.
          </div>
          <button className="primary" onClick={() => go('/tutorial')}>
            Aprender
          </button>
        </section>
      )}

      <section className="main-actions">
        <button className={`action-card ${showOnline ? 'open' : ''}`} onClick={() => setShowOnline((x) => !x)}>
          <span className="action-icon">
            <Icon name="online" size={28} />
          </span>
          <span className="action-text">
            <strong>Jugar con amigos</strong>
            <span>Crea una sala o únete con un código</span>
          </span>
        </button>

        {showOnline && (
          <div className="panel online-panel">
            <div className="row">
              <div className="segmented" role="group" aria-label="Jugadores">
                <button className={players === 4 ? 'on' : ''} onClick={() => setPlayers(4)}>
                  2 contra 2
                </button>
                <button className={players === 6 ? 'on' : ''} onClick={() => setPlayers(6)}>
                  3 contra 3
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
                aria-label="Código de la sala"
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && join()}
              />
              <button onClick={join}>Unirse</button>
            </div>
          </div>
        )}

        <ActionCard icon="bot" title="Jugar contra bots" sub="Fácil, normal o difícil. También sin conexión" onClick={() => go('/practica')} />
        <ActionCard icon="learn" title="Aprender a jugar" sub="Tutorial corto con ejercicios" onClick={() => go('/tutorial')} />
        {error && <p className="error">{error}</p>}
      </section>

      <nav className="secondary-actions" aria-label="Más opciones">
        <SmallLink icon="live" label="Marcador en vivo" to="/vivo" />
        <SmallLink icon="book" label="Reglas" to="/reglas" />
        <SmallLink icon="chart" label="Estadísticas" to="/estadisticas" />
        <SmallLink icon="cards" label="La baraja" to="/baraja" />
      </nav>

      <footer className="site-footer">
        <a href="#/privacidad">Privacidad</a> · Gratis, sin anuncios y sin registro
        <br />
        Reglas basadas en «Paulo (juego de naipes)» de Wikipedia (CC BY-SA 4.0) · Cartas «Naipes Libres» de Basquetteur, Wikimedia Commons (
        <a href="https://creativecommons.org/licenses/by-sa/3.0/deed.es" target="_blank" rel="noreferrer">
          CC BY-SA 3.0
        </a>
        )
      </footer>
    </main>
  );
}

function ActionCard({ icon, title, sub, onClick }: { icon: IconName; title: string; sub: string; onClick: () => void }) {
  return (
    <button className="action-card" onClick={onClick}>
      <span className="action-icon">
        <Icon name={icon} size={28} />
      </span>
      <span className="action-text">
        <strong>{title}</strong>
        <span>{sub}</span>
      </span>
    </button>
  );
}

function SmallLink({ icon, label, to }: { icon: IconName; label: string; to: string }) {
  return (
    <button className="small-link" onClick={() => go(to)}>
      <Icon name={icon} size={22} />
      <span>{label}</span>
    </button>
  );
}

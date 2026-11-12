import { useEffect, useState } from 'react';
import { go } from '../App';
import { createRoom, quickMatch } from '../services/controller';
import { checkLastRoom } from '../services/lastRoom';
import { getName, setName } from '../services/identity';
import { CardView } from '../components/CardView';
import { Icon, type IconName } from '../components/Icon';
import { tutorialDone } from './TutorialScreen';
import { lang, setLang, t, tServer } from '../i18n';

export function Home() {
  const [name, setNameState] = useState(getName());
  const [code, setCode] = useState('');
  const [players, setPlayers] = useState<4 | 6>(4);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOnline, setShowOnline] = useState(false);
  const [resume, setResume] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void checkLastRoom().then((c) => alive && setResume(c));
    return () => {
      alive = false;
    };
  }, []);

  const quick = async () => {
    if (needName()) return;
    setBusy(true);
    setError(null);
    const r = await quickMatch();
    setBusy(false);
    if (r.code) go(`/sala/${r.code}`);
    else setError(r.error ?? t('No se pudo encontrar partida.'));
  };

  const saveName = (v: string) => {
    setNameState(v);
    setName(v);
  };

  const needName = () => {
    if (name.trim()) return false;
    setError(t('Escribe tu apodo primero.'));
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
    else setError(r.error ?? t('No se pudo crear la sala.'));
  };

  const join = () => {
    if (needName()) return;
    const c = code.trim().toUpperCase();
    if (c.length < 4) return setError(t('Escribe el código de la sala.'));
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
        <p className="tagline">{t('El juego de cartas de Níjar y Mairena del Alcor')}</p>
      </header>

      <section className="panel name-panel">
        <label className="field" htmlFor="apodo">
          <span>{t('Tu apodo')}</span>
        </label>
        <input id="apodo" value={name} maxLength={20} placeholder={t('¿Cómo te llamamos?')} onChange={(e) => saveName(e.target.value)} />
        <p className="muted small">{t('Sin registro. Solo lo ven los jugadores de tu mesa.')}</p>
      </section>

      {resume && (
        <section className="panel resume-banner">
          <div>
            <strong>{t('Tienes una partida en curso.')}</strong> {t('Tu asiento te espera.')}
          </div>
          <button className="primary" onClick={() => go(`/sala/${resume}`)}>
            {t('Volver a la partida')}
          </button>
        </section>
      )}

      {!tutorialDone() && (
        <section className="panel tut-banner">
          <div>
            <strong>{t('¿Primera vez?')}</strong> {t('Aprende a jugar en 2 minutos, con ejemplos.')}
          </div>
          <button className="primary" onClick={() => go('/tutorial')}>
            {t('Aprender')}
          </button>
        </section>
      )}

      <section className="main-actions">
        <button className="action-card quick-card" disabled={busy} onClick={() => void quick()}>
          <span className="action-icon">
            <Icon name="bolt" size={28} />
          </span>
          <span className="action-text">
            <strong>{busy ? t('Buscando mesa…') : t('Partida rápida')}</strong>
            <span>{t('Te sentamos en una mesa pública con gente de todas partes')}</span>
          </span>
        </button>
        <button className={`action-card ${showOnline ? 'open' : ''}`} onClick={() => setShowOnline((x) => !x)}>
          <span className="action-icon">
            <Icon name="online" size={28} />
          </span>
          <span className="action-text">
            <strong>{t('Jugar con amigos')}</strong>
            <span>{t('Sala privada: crea una o únete con un código')}</span>
          </span>
        </button>

        {showOnline && (
          <div className="panel online-panel">
            <div className="row">
              <div className="segmented" role="group" aria-label={t('Jugadores')}>
                <button className={players === 4 ? 'on' : ''} onClick={() => setPlayers(4)}>
                  {t('2 contra 2')}
                </button>
                <button className={players === 6 ? 'on' : ''} onClick={() => setPlayers(6)}>
                  {t('3 contra 3')}
                </button>
              </div>
              <button className="primary" disabled={busy} onClick={create}>
                {busy ? t('Creando…') : t('Crear sala')}
              </button>
            </div>
            <div className="row">
              <input
                className="code-input"
                value={code}
                maxLength={6}
                placeholder={t('CÓDIGO')}
                aria-label={t('Código de la sala')}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && join()}
              />
              <button onClick={join}>{t('Unirse')}</button>
            </div>
          </div>
        )}

        <ActionCard icon="globe" title={t('Partidas públicas')} sub={t('Juega con gente de todas partes o mira partidas')} onClick={() => go('/publicas')} />
        <ActionCard icon="bot" title={t('Jugar contra bots')} sub={t('Fácil, normal o difícil. Retos diarios. También sin conexión')} onClick={() => go('/practica')} />
        <ActionCard icon="learn" title={t('Aprender a jugar')} sub={t('Tutorial corto con ejercicios')} onClick={() => go('/tutorial')} />
        {error && <p className="error">{tServer(error)}</p>}
      </section>

      <nav className="secondary-actions" aria-label={t('Más opciones')}>
        <SmallLink icon="live" label={t('Marcador en vivo')} to="/vivo" />
        <SmallLink icon="book" label={t('Reglas')} to="/reglas" />
        <SmallLink icon="chart" label={t('Estadísticas')} to="/estadisticas" />
        <SmallLink icon="cards" label={t('La baraja')} to="/baraja" />
      </nav>

      <footer className="site-footer">
        <div className="lang-switch" role="group" aria-label="Idioma / Language">
          <button className={lang() === 'es' ? 'on' : ''} onClick={() => setLang('es')}>
            Español
          </button>
          <button className={lang() === 'en' ? 'on' : ''} onClick={() => setLang('en')}>
            English
          </button>
        </div>
        <a href="#/privacidad">{t('Privacidad')}</a> · {t('Gratis, sin anuncios y sin registro')}
        <br />
        {t('Reglas basadas en «Paulo (juego de naipes)» de Wikipedia (CC BY-SA 4.0) · Cartas «Naipes Libres» de Basquetteur, Wikimedia Commons (')}
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

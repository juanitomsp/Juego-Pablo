import { useEffect, useState } from 'react';
import { teamOf } from '../../shared/engine';
import { go } from '../App';
import { Table, useSnapshot } from '../components/Table';
import { OnlineController } from '../services/controller';
import { getName, setName } from '../services/identity';

export function RoomScreen({ code }: { code: string }) {
  const [needName, setNeedName] = useState(!getName());
  const [ctrl, setCtrl] = useState<OnlineController | null>(null);

  useEffect(() => {
    if (needName) return;
    const c = new OnlineController(code);
    setCtrl(c);
    return () => c.dispose();
  }, [code, needName]);

  if (needName) return <AskName onDone={() => setNeedName(false)} />;
  if (!ctrl) return <div className="center-msg">Conectando…</div>;
  return <Room ctrl={ctrl} />;
}

function AskName({ onDone }: { onDone: () => void }) {
  const [name, setN] = useState('');
  return (
    <main className="page narrow">
      <section className="panel">
        <h2>¿Cómo te llamamos?</h2>
        <input autoFocus value={name} maxLength={20} placeholder="Tu apodo" onChange={(e) => setN(e.target.value)} />
        <div className="row">
          <button
            className="primary"
            disabled={!name.trim()}
            onClick={() => {
              setName(name);
              onDone();
            }}
          >
            Entrar en la sala
          </button>
        </div>
      </section>
    </main>
  );
}

function Room({ ctrl }: { ctrl: OnlineController }) {
  const snap = useSnapshot(ctrl);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const leave = () => {
    ctrl.leave();
    go('/');
  };

  if (ctrl.kickedReason)
    return (
      <main className="page narrow">
        <section className="panel">
          <p className="error">⛔ {ctrl.kickedReason}</p>
          <p className="muted">Recuerda que en el chat no se puede insultar.</p>
          <button onClick={() => go('/')}>Volver al inicio</button>
        </section>
      </main>
    );
  if (ctrl.joinError)
    return (
      <main className="page narrow">
        <section className="panel">
          <p className="error">{ctrl.joinError}</p>
          <button onClick={() => go('/')}>Volver al inicio</button>
        </section>
      </main>
    );
  const state = snap.state;
  if (!state) return <div className="center-msg">{snap.connected ? 'Entrando en la sala…' : 'Conectando con el servidor…'}</div>;

  const { room } = state;
  if (room.started) return <Table controller={ctrl} onLeave={leave} onReplaceWithBot={(s) => void ctrl.replaceWithBot(s)} />;

  const run = async (p: Promise<string | null>) => {
    const e = await p;
    setError(e);
  };
  const link = `${window.location.origin}/#/sala/${room.code}`;
  const cfg = room.config;
  const host = room.youAreHost;
  const full = room.seats.every((s) => s.name);

  return (
    <main className="page">
      <nav className="topnav">
        <button className="link" onClick={leave}>
          ← Salir
        </button>
        <span>Sala {room.code}</span>
      </nav>

      <section className="panel">
        <h2>
          Código de la sala: <span className="code">{room.code}</span>
        </h2>
        <p className="muted">Comparte el código o el enlace con tus amigos.</p>
        <div className="row">
          <input readOnly value={link} onFocus={(e) => e.target.select()} />
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              } catch {
                setError('No se pudo copiar; copia el enlace a mano.');
              }
            }}
          >
            {copied ? '¡Copiado!' : 'Copiar enlace'}
          </button>
          {'share' in navigator && (
            <button
              className="primary"
              onClick={() =>
                navigator.share({ title: 'El Pablo', text: `¡Vente a jugar al Pablo! Sala ${room.code}`, url: link }).catch(() => {})
              }
            >
              Compartir
            </button>
          )}
        </div>
      </section>

      <section className="panel">
        <h3>Mesa ({cfg.players} jugadores)</h3>
        <p className="muted small">Los equipos se sientan alternos. Pulsa un asiento libre para cambiarte.</p>
        <div className="teams">
          {([0, 1] as const).map((t) => (
            <div key={t} className={`team-col team-${t}`}>
              <h4>{cfg.teamNames[t]}</h4>
              {room.seats
                .filter((s) => teamOf(s.seat) === t)
                .map((s) => (
                  <div key={s.seat} className={`lobby-seat ${s.isYou ? 'me' : ''}`}>
                    <span>
                      Asiento {s.seat + 1}: {s.name ? <strong>{s.name}</strong> : <em>libre</em>}
                      {s.bot && <span className="tag">bot</span>}
                      {s.isHost && <span className="tag">anfitrión</span>}
                      {s.name && !s.connected && <span className="tag off">desconectado</span>}
                    </span>
                    <span className="row tight">
                      {!s.name && <button onClick={() => run(ctrl.sit(s.seat))}>Sentarme</button>}
                      {!s.name && host && <button onClick={() => run(ctrl.addBot(s.seat))}>+ Bot</button>}
                      {s.name && host && !s.isYou && (
                        <button className="link" onClick={() => run(ctrl.clearSeat(s.seat))}>
                          Quitar
                        </button>
                      )}
                    </span>
                  </div>
                ))}
            </div>
          ))}
        </div>
        {room.kingDraw && (
          <p className="muted">
            Sorteo por reyes: {room.kingDraw.join(', ')} sacaron rey primero y forman equipo. {room.kingDraw[0]} será el mano.
          </p>
        )}
      </section>

      {host ? (
        <section className="panel">
          <h3>Opciones</h3>
          <div className="options">
            <div className="field">
              <span>Jugadores</span>
              <div className="segmented">
                {([4, 6] as const).map((n) => (
                  <button key={n} className={cfg.players === n ? 'on' : ''} onClick={() => run(ctrl.setConfig({ players: n }))}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <NumberField label="Puntos por cuerno" value={cfg.pointsPerCuerno} onChange={(v) => run(ctrl.setConfig({ pointsPerCuerno: v }))} />
            <NumberField label="Cuernos por Pablo" value={cfg.cuernosPerPablo} onChange={(v) => run(ctrl.setConfig({ cuernosPerPablo: v }))} />
            <NumberField label="Pablos para ganar" value={cfg.pablosToWin} onChange={(v) => run(ctrl.setConfig({ pablosToWin: v }))} />
            <TeamNames names={cfg.teamNames} onChange={(n) => run(ctrl.setConfig({ teamNames: n }))} />
          </div>
          <div className="row">
            <button disabled={!full} onClick={() => run(ctrl.drawTeams())} title="Reparte cartas boca arriba: los primeros en sacar rey forman equipo">
              Sortear equipos por reyes
            </button>
            <button className="primary" disabled={!full} onClick={() => run(ctrl.start())}>
              Empezar partida
            </button>
          </div>
          {!full && <p className="muted small">Faltan jugadores. Puedes rellenar los huecos con bots.</p>}
        </section>
      ) : (
        <section className="panel">
          <p className="muted">
            Esperando a que el anfitrión empiece. Partida a {cfg.pointsPerCuerno} puntos por cuerno, {cfg.cuernosPerPablo} cuernos por Pablo,{' '}
            {cfg.pablosToWin} Pablo(s) para ganar.
          </p>
        </section>
      )}
      {error && <p className="error">{error}</p>}
    </main>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type="number" value={value} min={1} max={60} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

function TeamNames({ names, onChange }: { names: [string, string]; onChange: (n: [string, string]) => void }) {
  const [a, setA] = useState(names[0]);
  const [b, setB] = useState(names[1]);
  return (
    <div className="field">
      <span>Nombres de los equipos</span>
      <div className="row tight">
        <input value={a} maxLength={20} onChange={(e) => setA(e.target.value)} onBlur={() => onChange([a, b])} />
        <input value={b} maxLength={20} onChange={(e) => setB(e.target.value)} onBlur={() => onChange([a, b])} />
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { SpectatorCount } from '../components/SpectatorCount';
import { teamOf } from '../../shared/engine';
import { go } from '../App';
import { Table, useSnapshot } from '../components/Table';
import { OnlineController, getSocket } from '../services/controller';
import { VoiceCall } from '../services/voice';
import { VoiceControls } from '../components/VoiceControls';
import { getName, setName } from '../services/identity';
import { clearLastRoom, setLastRoom } from '../services/lastRoom';
import { t, tServer } from '../i18n';

export function RoomScreen({ code, watch = false }: { code: string; watch?: boolean }) {
  const [needName, setNeedName] = useState(!getName());
  const [ctrl, setCtrl] = useState<OnlineController | null>(null);

  useEffect(() => {
    if (needName) return;
    const c = new OnlineController(code, watch);
    setCtrl(c);
    return () => c.dispose();
  }, [code, needName, watch]);

  if (needName) return <AskName onDone={() => setNeedName(false)} />;
  if (!ctrl) return <div className="center-msg">{t('Conectando…')}</div>;
  return <Room ctrl={ctrl} />;
}

function AskName({ onDone }: { onDone: () => void }) {
  const [name, setN] = useState('');
  return (
    <main className="page narrow">
      <section className="panel">
        <h2>{t('¿Cómo te llamamos?')}</h2>
        <input autoFocus value={name} maxLength={20} placeholder={t('Tu apodo')} onChange={(e) => setN(e.target.value)} />
        <div className="row">
          <button
            className="primary"
            disabled={!name.trim()}
            onClick={() => {
              setName(name);
              onDone();
            }}
          >
            {t('Entrar en la sala')}
          </button>
        </div>
      </section>
    </main>
  );
}

function Room({ ctrl }: { ctrl: OnlineController }) {
  const snap = useSnapshot(ctrl);
  const call = useMemo(() => new VoiceCall(getSocket()), []);
  useEffect(() => () => call.dispose(), [call]);
  const voiceList = snap.state?.room.voice;
  useEffect(() => {
    if (voiceList) call.sync(voiceList);
  }, [call, voiceList]);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const leave = () => {
    call.leave();
    ctrl.leave();
    clearLastRoom();
    go('/');
  };
  const st = snap.state;
  const seated = !!st?.room.started && st.room.yourSeat !== null;
  const finished = st?.view?.phase === 'finished';
  // Recordar la partida para poder volver si se cierra la app.
  useEffect(() => {
    if (!st) return;
    if (seated && !finished) setLastRoom(st.room.code);
    else if (finished) clearLastRoom();
  }, [st, seated, finished]);

  if (ctrl.kickedReason)
    return (
      <main className="page narrow">
        <section className="panel">
          <p className="error">⛔ {tServer(ctrl.kickedReason)}</p>
          <button onClick={() => go('/')}>{t('Volver al inicio')}</button>
        </section>
      </main>
    );
  if (ctrl.joinError)
    return (
      <main className="page narrow">
        <section className="panel">
          <p className="error">{tServer(ctrl.joinError)}</p>
          <button onClick={() => go('/')}>{t('Volver al inicio')}</button>
        </section>
      </main>
    );
  const state = snap.state;
  if (!state) return <div className="center-msg">{snap.connected ? t('Entrando en la sala…') : t('Conectando con el servidor…')}</div>;

  const { room } = state;
  const canVoice = VoiceCall.supported();
  if (room.started)
    return (
      <Table
        controller={ctrl}
        onLeave={leave}
        onReplaceWithBot={(s) => void ctrl.replaceWithBot(s)}
        extraTools={canVoice ? <VoiceControls call={call} room={room} compact /> : null}
      />
    );

  const run = async (p: Promise<string | null>) => {
    const e = await p;
    setError(e ? tServer(e) : null);
  };
  const link = `${window.location.origin}/#/sala/${room.code}`;
  const cfg = room.config;
  const host = room.youAreHost;
  const full = room.seats.every((s) => s.name);

  return (
    <main className="page">
      <nav className="topnav">
        <button className="link" onClick={leave}>
          ← {t('Salir')}
        </button>
        <span>{t('Sala {code}', { code: room.code })}</span>
        <SpectatorCount n={room.spectators} />
      </nav>
      {canVoice && room.yourSeat !== null && (
        <div className="toolbar lobby-voice">
          <VoiceControls call={call} room={room} />
        </div>
      )}
      {room.yourSeat === null && (
        <p className="watch-banner">
          <Icon name="eye" size={18} /> {t('Estás mirando. Si queda un asiento libre, puedes sentarte a jugar.')}
        </p>
      )}

      <section className="panel">
        <h2>
          {t('Código de la sala:')} <span className="code">{room.code}</span>
        </h2>
        <p className="muted">
          {room.isPublic
            ? t('Sala pública: aparece en «Partidas públicas» y puede entrar cualquiera.')
            : t('Sala privada: solo entra quien tenga el código o el enlace.')}
        </p>
        {room.autoStartAt && <AutoStart at={room.autoStartAt} />}
        {host && (
          <div className="segmented visibility" role="group" aria-label={t('Tipo de sala')}>
            <button className={!room.isPublic ? 'on' : ''} onClick={() => run(ctrl.setPublic(false))}>
              {t('Privada')}
            </button>
            <button className={room.isPublic ? 'on' : ''} onClick={() => run(ctrl.setPublic(true))}>
              {t('Pública')}
            </button>
          </div>
        )}
        <div className="row">
          <input readOnly value={link} onFocus={(e) => e.target.select()} />
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              } catch {
                setError(t('No se pudo copiar; copia el enlace a mano.'));
              }
            }}
          >
            {copied ? t('¡Copiado!') : t('Copiar enlace')}
          </button>
          {'share' in navigator && (
            <button
              className="primary"
              onClick={() =>
                navigator.share({ title: 'El Pablo', text: t('¡Vente a jugar al Pablo! Sala {code}', { code: room.code }), url: link }).catch(() => {})
              }
            >
              {t('Compartir')}
            </button>
          )}
        </div>
      </section>

      <section className="panel">
        <h3>{t('Mesa ({n} jugadores)', { n: cfg.players })}</h3>
        <p className="muted small">{t('Los equipos se sientan alternos. Pulsa un asiento libre para cambiarte.')}</p>
        <div className="teams">
          {([0, 1] as const).map((tm) => (
            <div key={tm} className={`team-col team-${tm}`}>
              <h4>{cfg.teamNames[tm]}</h4>
              {room.seats
                .filter((s) => teamOf(s.seat) === tm)
                .map((s) => (
                  <div key={s.seat} className={`lobby-seat ${s.isYou ? 'me' : ''}`}>
                    <span>
                      {t('Asiento {n}:', { n: s.seat + 1 })} {s.name ? <strong>{s.name}</strong> : <em>{t('libre')}</em>}
                      {s.bot && <span className="tag">bot</span>}
                      {s.isHost && <span className="tag">{t('anfitrión')}</span>}
                      {s.name && !s.connected && <span className="tag off">{t('desconectado')}</span>}
                    </span>
                    <span className="row tight">
                      {!s.name && <button onClick={() => run(ctrl.sit(s.seat))}>{t('Sentarme')}</button>}
                      {!s.name && host && <button onClick={() => run(ctrl.addBot(s.seat))}>{t('+ Bot')}</button>}
                      {s.name && host && !s.isYou && (
                        <button className="link" onClick={() => run(ctrl.clearSeat(s.seat))}>
                          {t('Quitar')}
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
            {t('Sorteo por reyes: {names} sacaron rey primero y forman equipo. {first} será el mano.', { names: room.kingDraw.join(', '), first: room.kingDraw[0] })}
          </p>
        )}
      </section>

      {host ? (
        <section className="panel">
          <h3>{t('Opciones')}</h3>
          <div className="options">
            <div className="field">
              <span>{t('Jugadores')}</span>
              <div className="segmented">
                {([4, 6] as const).map((n) => (
                  <button key={n} className={cfg.players === n ? 'on' : ''} onClick={() => run(ctrl.setConfig({ players: n }))}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <NumberField label={t('Puntos por cuerno')} value={cfg.pointsPerCuerno} onChange={(v) => run(ctrl.setConfig({ pointsPerCuerno: v }))} />
            <NumberField label={t('Cuernos por Pablo')} value={cfg.cuernosPerPablo} onChange={(v) => run(ctrl.setConfig({ cuernosPerPablo: v }))} />
            <NumberField label={t('Pablos para ganar')} value={cfg.pablosToWin} onChange={(v) => run(ctrl.setConfig({ pablosToWin: v }))} />
            <TeamNames names={cfg.teamNames} onChange={(n) => run(ctrl.setConfig({ teamNames: n }))} />
          </div>
          <div className="row">
            <button disabled={!full} onClick={() => run(ctrl.drawTeams())} title={t('Reparte cartas boca arriba: los primeros en sacar rey forman equipo')}>
              {t('Sortear equipos por reyes')}
            </button>
            <button className="primary" disabled={!full} onClick={() => run(ctrl.start())}>
              {t('Empezar partida')}
            </button>
          </div>
          {!full && <p className="muted small">{t('Faltan jugadores. Puedes rellenar los huecos con bots.')}</p>}
        </section>
      ) : (
        <section className="panel">
          <p className="muted">
            {t('Esperando a que el anfitrión empiece. Partida a {a} puntos por cuerno, {b} cuernos por Pablo, {c} Pablo(s) para ganar.', {
              a: cfg.pointsPerCuerno,
              b: cfg.cuernosPerPablo,
              c: cfg.pablosToWin,
            })}
          </p>
        </section>
      )}
      {error && <p className="error">{error}</p>}
    </main>
  );
}

/** Cuenta atrás de una mesa pública: si no entra nadie más, empieza con bots. */
function AutoStart({ at }: { at: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const s = Math.max(0, Math.ceil((at - now) / 1000));
  return (
    <p className="autostart">
      {t('Si no entra nadie más, la partida empezará con bots en')} <strong>{s} s</strong>.
    </p>
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
      <span>{t('Nombres de los equipos')}</span>
      <div className="row tight">
        <input value={a} maxLength={20} onChange={(e) => setA(e.target.value)} onBlur={() => onChange([a, b])} />
        <input value={b} maxLength={20} onChange={(e) => setB(e.target.value)} onBlur={() => onChange([a, b])} />
      </div>
    </div>
  );
}

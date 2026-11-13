import { ReactNode, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  Card,
  MatchEvent,
  PlayerView,
  QUICK_MESSAGES,
  Team,
  cardId,
  sortValue,
  teamOf,
  trickWinnerIndex,
  trumpRanking,
} from '../../shared/engine';
import type { RoomInfo } from '../../shared/protocol';
import { Controller } from '../services/controller';
import { recordMatch, summarize } from '../services/stats';
import { Icon } from './Icon';
import { SpectatorCount } from './SpectatorCount';
import { play as playSound, setSoundOn, soundOn } from '../services/sounds';
import { CHAT_MAX_LENGTH } from '../../shared/chat';
import { CardView, SuitIcon } from './CardView';
import { cardLabel, suitName, t, tServer } from '../i18n';

export function useSnapshot(c: Controller) {
  return useSyncExternalStore(
    (cb) => c.subscribe(cb),
    () => c.snapshot(),
  );
}

// Posición de cada asiento en la mesa (% del tapete), empezando por ti (abajo) y siguiendo hacia tu derecha.
// Los asientos laterales se anclan por su borde exterior para que no se salgan en pantallas estrechas.
const POS4 = [
  [50, 86],
  [97, 50],
  [50, 12],
  [3, 50],
];
const POS6 = [
  [50, 87],
  [97, 70],
  [97, 28],
  [50, 10],
  [3, 28],
  [3, 70],
];
const sideClass = (x: number) => (x < 20 ? 'side-left' : x > 80 ? 'side-right' : '');

const REASON: Record<string, string> = {
  bazas: 'por bazas',
  rechazo: 'porque el rival no quiso la apuesta',
  quiero: 'porque el equipo al quiero se fue',
  renuncio: 'por renuncio (no echó triunfo en un arrastre)',
};


export function describeEvent(e: MatchEvent, name: (s: number) => string, team: (t: Team) => string): string {
  switch (e.kind) {
    case 'deal':
      return t('{name} reparte.', { name: name(e.dealer) });
    case 'trick':
      return t('{name} gana la baza {n}.', { name: name(e.winner), n: e.index + 1 });
    case 'bet':
      return t('{name} apuesta: la mano valdría {n}.', { name: name(e.seat), n: e.value });
    case 'accept':
      return t('{name} acepta. La mano vale {n}.', { name: name(e.seat), n: e.value });
    case 'reject':
      return t('{name} no quiere.', { name: name(e.seat) });
    case 'quiero':
      return e.play ? t('{name} decide jugar (al quiero).', { name: name(e.seat) }) : t('{name} decide irse (al quiero).', { name: name(e.seat) });
    case 'handEnd':
      return t('{team} gana {n} puntos {why}.', { team: team(e.result.winner), n: e.result.points, why: t(REASON[e.result.reason]) });
    case 'cuerno':
      return t('¡{team} gana un cuerno!', { team: team(e.team) });
    case 'pablo':
      return t('¡{team} gana un Pablo!', { team: team(e.team) });
    case 'matchEnd':
      return t('¡{team} gana la partida!', { team: team(e.team) });
  }
}

interface TableProps {
  controller: Controller;
  onLeave: () => void;
  onReplaceWithBot?: (seat: number) => void;
  /** Botones extra en la barra de abajo (p. ej. la llamada de voz). */
  extraTools?: ReactNode;
}

export function Table({ controller, onLeave, onReplaceWithBot, extraTools }: TableProps) {
  const snap = useSnapshot(controller);
  const room = snap.state?.room;
  const view = snap.state?.view;
  const [error, setError] = useState<string | null>(null);
  const [hints, setHints] = useState(() => localStorage.getItem('pablo.hints') !== '0');
  const [panel, setPanel] = useState<'none' | 'chat' | 'log' | 'orden'>('none');
  const [now, setNow] = useState(Date.now());
  const recorded = useRef(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => localStorage.setItem('pablo.hints', hints ? '1' : '0'), [hints]);
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 3500);
    return () => clearTimeout(t);
  }, [error]);

  // Guardar estadísticas al terminar la partida.
  useEffect(() => {
    if (!view || !room) return;
    if (view.phase !== 'finished') {
      recorded.current = false;
      return;
    }
    if (recorded.current) return;
    recorded.current = true;
    const s = summarize(view, controller.mode, `${controller.mode}-${room.code}-${Date.now()}`);
    if (s) void recordMatch(s);
  }, [view, room, controller.mode]);

  if (!room || !view) return <div className="center-msg">{t('Cargando partida…')}</div>;

  const act = async (a: Parameters<Controller['act']>[0]) => {
    const err = await controller.act(a);
    if (err) setError(tServer(err));
  };

  return (
    <TableInner
      room={room}
      view={view}
      snapQuicks={snap.quicks}
      connected={snap.connected}
      now={now}
      hints={hints}
      setHints={setHints}
      panel={panel}
      setPanel={setPanel}
      error={error}
      act={act}
      controller={controller}
      onLeave={onLeave}
      onReplaceWithBot={onReplaceWithBot}
      extraTools={extraTools}
    />
  );
}

interface InnerProps {
  room: RoomInfo;
  view: PlayerView;
  snapQuicks: { from: number; text: string; at: number }[];
  connected: boolean;
  now: number;
  hints: boolean;
  setHints: (b: boolean) => void;
  panel: 'none' | 'chat' | 'log' | 'orden';
  setPanel: (p: InnerProps['panel']) => void;
  error: string | null;
  act: (a: Parameters<Controller['act']>[0]) => void;
  controller: Controller;
  onLeave: () => void;
  onReplaceWithBot?: (seat: number) => void;
  extraTools?: ReactNode;
}

/** Tiempo que se ve la baza ya cerrada antes de limpiar la mesa. */
const LAST_TRICK_MS = 1600;

/** En pantallas táctiles, la primera pulsación selecciona la carta y la segunda la juega (evita toques accidentales). */
const isTouch = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

/** Mantiene la pantalla encendida mientras se juega (si el navegador lo permite). */
function useWakeLock() {
  useEffect(() => {
    type WakeLock = { release: () => Promise<void> };
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<WakeLock> } };
    if (!nav.wakeLock) return;
    let lock: WakeLock | null = null;
    const request = () => {
      if (document.visibilityState === 'visible') nav.wakeLock!.request('screen').then((l) => (lock = l)).catch(() => {});
    };
    request();
    document.addEventListener('visibilitychange', request);
    return () => {
      document.removeEventListener('visibilitychange', request);
      void lock?.release().catch(() => {});
    };
  }, []);
}

function TableInner(p: InnerProps) {
  const { room, view, now, hints, act } = p;
  const [selected, setSelected] = useState<string | null>(null);
  const [sound, setSound] = useState(soundOn);
  // Jugadores silenciados (solo en este dispositivo): no se ven sus mensajes ni sus burbujas.
  const [muted, setMuted] = useState<Set<number>>(() => new Set());
  const toggleMute = (seat: number) =>
    setMuted((m) => {
      const n = new Set(m);
      if (n.has(seat)) n.delete(seat);
      else n.add(seat);
      return n;
    });
  useWakeLock();
  const n = room.config.players;
  const you = view.you;
  const base = you ?? 0;
  const h = view.hand;
  const myTeam: Team | null = you === null ? null : teamOf(you);
  const name = (s: number) => (s === you ? t('Tú') : room.seats[s]?.name ?? t('Jugador {n}', { n: s + 1 }));
  const teamName = (t: Team) => room.config.teamNames[t];
  const toasts = useEventToasts(view, room.config.teamNames, you, name);
  const rel = (s: number) => (s - base + n) % n;
  const pos = (s: number) => (n === 4 ? POS4 : POS6)[rel(s)];

  const sortedHand = useMemo(
    () => (h ? h.myCards.slice().sort((a, b) => (a.suit === b.suit ? 0 : a.suit < b.suit ? -1 : 1) || sortValue(b, h.trump) - sortValue(a, h.trump)) : []),
    [h],
  );
  // Ordenar: triunfos primero.
  const handCards = h
    ? sortedHand.slice().sort((a, b) => {
        const ta = sortValue(a, h.trump) >= 100 ? 1 : 0;
        const tb = sortValue(b, h.trump) >= 100 ? 1 : 0;
        return tb - ta;
      })
    : [];

  // Al cerrarse una baza se ve un momento quién se la lleva y después la mesa queda limpia,
  // sin esperar a que se eche la primera carta de la siguiente.
  const trickKey = `${view.handNumber}-${h?.tricks.length ?? 0}`;
  const [clearedKey, setClearedKey] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setClearedKey(trickKey), LAST_TRICK_MS);
    return () => clearTimeout(t);
  }, [trickKey]);
  const lastTrickVisible = !!h && h.trick.length === 0 && !!h.lastTrick && clearedKey !== trickKey;
  const showTrick = h ? (h.trick.length > 0 ? h.trick : lastTrickVisible ? h.lastTrick!.plays : []) : [];
  const trickDone = lastTrickVisible;
  const trickWinner = showTrick.length && h ? showTrick[trickWinnerIndex(showTrick, h.trump)].seat : null;
  // ¿Va ganando la baza tu compañero? Entonces conviene no malgastar cartas buenas.
  const partnerWinning =
    !!h && h.turn === you && h.phase === 'playing' && h.trick.length > 0 && trickWinner !== null && trickWinner !== you && myTeam !== null && teamOf(trickWinner) === myTeam;

  const recentQuick = (s: number) => p.snapQuicks.filter((m) => m.from === s && now - m.at < 5000).slice(-1)[0];

  let status = '';
  if (view.phase === 'deal') {
    status = view.canDeal ? t('Eres el mano: reparte.') : t('Esperando a que {name} reparta.', { name: name(view.dealer) });
  } else if (h && view.phase === 'hand') {
    if (h.phase === 'quiero') {
      const qt = h.quieroTeams[0];
      status = h.canDecideQuiero
        ? t('Tu equipo está al quiero: mirad los triunfos y decidid si jugáis o os vais.')
        : t('{team} está al quiero y decide si juega.', { team: teamName(qt) });
    } else if (h.phase === 'bet' && h.pendingBet) {
      status = h.canRespond
        ? t('{name} apuesta: la mano pasaría a valer {n}. ¿Lo quieres?', { name: name(h.pendingBet.seat), n: h.pendingBet.value })
        : t('{name} apuesta {n}. Esperando respuesta del rival…', { name: name(h.pendingBet.seat), n: h.pendingBet.value });
    } else if (you !== null && h.seats.includes(you) && !h.received[you]) {
      status = t('El mano aún no te ha dado las cartas (se reparten conforme juegan los rivales).');
    } else if (h.turn === you) {
      status = t('Te toca. Elige carta.');
      if (h.renuncio.length > 0) status = t('¡Arrastre! Tienes que echar triunfo (el Pablo te lo puedes guardar).');
      else if (partnerWinning) status = t('{name} (tu compañero) va ganando la baza: echa una carta baja.', { name: name(trickWinner!) });
      else if (hints && h.winning.length > 0) status = t('Te toca. Tienes cartas que ganan esta baza (marcadas con ✓).');
    }
    else status = t('Turno de {name}.', { name: name(h.turn) });
  }

  const lastResult = view.phase === 'handEnd' || view.phase === 'finished' ? view.history[view.history.length - 1] : null;
  const disconnected = room.seats.filter((s) => !s.connected && !s.bot && s.name);

  // Vibrar (en móviles que lo permitan) cuando te toca actuar; y olvidar la carta seleccionada al cambiar de turno.
  const needsMe = !!h && view.phase === 'hand' && ((h.phase === 'playing' && h.turn === you) || h.canRespond || h.canDecideQuiero);
  const needsMeKey = needsMe ? `${view.handNumber}-${h!.trickIndex}-${h!.trick.length}-${h!.phase}` : '';
  useEffect(() => {
    setSelected(null);
    if (needsMeKey) navigator.vibrate?.(60);
  }, [needsMeKey]);

  const onCard = (c: Card) => {
    const id = cardId(c);
    if (isTouch && selected !== id) return setSelected(id);
    setSelected(null);
    if (hints && h?.renuncio.includes(id) && !confirm(t('Hay arrastre y tienes triunfo. Si echas esta carta es renuncio y tu equipo pierde la mano. ¿Echarla igualmente?'))) return;
    act({ type: 'play', card: c });
  };
  if (isTouch && h && h.turn === you && selected && h.phase === 'playing' && h.renuncio.length === 0 && !partnerWinning) status = t('Toca otra vez la carta para jugarla.');
  if (trickDone && trickWinner !== null && view.phase === 'hand' && h?.trick.length === 0) status = `${t('Baza para {name}.', { name: name(trickWinner) })} ${status}`;

  return (
    <div className="game">
      <div className="toasts" aria-live="polite">
        {toasts.map((ts) => (
          <div key={ts.id} className={`toast ${ts.big ? 'big' : ''}`}>
            {ts.text}
          </div>
        ))}
      </div>
      <header className="scorebar">
        {([0, 1] as Team[]).map((tm) => (
          <div key={tm} className={`team-score team-${tm} ${myTeam === tm ? 'mine' : ''}`}>
            <div className="team-name">{teamName(tm)}</div>
            <div className="pts">
              <strong>{view.score[tm]}</strong>
              <small>/{room.config.pointsPerCuerno}</small>
              {view.score[tm] >= view.quieroThreshold && <span className="tag quiero">{t('al quiero')}</span>}
            </div>
            <div className="sub">
              <span title={t('Cuernos (partidas) ganados')}>🐂 {view.cuernos[tm]}/{room.config.cuernosPerPablo}</span>
              {room.config.pablosToWin > 1 && <span title={t('Pablos ganados')}> · 🏆 {view.pablos[tm]}/{room.config.pablosToWin}</span>}
            </div>
          </div>
        ))}
        {h && (
          <div className="hand-info">
            <div className="muestra">
              <div>
                <div className="lbl">{t('Triunfo')}</div>
                <div className="trump-name">
                  <SuitIcon suit={h.trump} size={16} /> {suitName(h.trump)}
                </div>
              </div>
            </div>
            <div className="stake">
              <div className="lbl">{t('Vale')}</div>
              <strong>{h.stake}</strong>
            </div>
            <div className="stake">
              <div className="lbl">{t('Bazas')}</div>
              <strong>
                {myTeam === null ? `${h.wins[0]}-${h.wins[1]}` : `${h.wins[myTeam]}-${h.wins[1 - myTeam]}`}
              </strong>
            </div>
          </div>
        )}
      </header>

      {p.controller.mode === 'online' && view.you === null && (
        <div className="watch-banner">
          <Icon name="eye" size={18} /> {t('Estás mirando esta partida. No ves las cartas de nadie.')}
        </div>
      )}
      {!p.connected && <div className="banner warn">{t('Sin conexión con el servidor. Reintentando…')}</div>}
      {disconnected.length > 0 && view.phase !== 'finished' && (
        <div className="banner warn">
          {t('Desconectado:')} {disconnected.map((s) => s.name).join(', ')}.
          {room.youAreHost && p.onReplaceWithBot &&
            disconnected.map((s) => (
              <button key={s.seat} className="link" onClick={() => p.onReplaceWithBot!(s.seat)}>
                {t('Sustituir a {name} por un bot', { name: s.name ?? '' })}
              </button>
            ))}
        </div>
      )}

      <div className={`felt players-${n}`}>
        {room.seats.map((s) => {
          const [x, y] = pos(s.seat);
          const active = !h || h.seats.includes(s.seat);
          const quick = muted.has(s.seat) ? undefined : recentQuick(s.seat);
          const isTurn = h && view.phase === 'hand' && h.turn === s.seat && h.phase === 'playing';
          return (
            <div
              key={s.seat}
              className={`seat ${sideClass(x)} team-${teamOf(s.seat)} ${isTurn ? 'turn' : ''} ${active ? '' : 'inactive'} ${rel(s.seat) === 0 ? 'me' : ''}`}
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              <div className="seat-name">
                <span className="avatar" aria-hidden="true">
                  {(s.seat === you ? t('Tú') : s.name ?? '?').replace(/^Bot\s*\(?/, '').charAt(0).toUpperCase()}
                </span>
                {s.seat === you ? t('Tú') : s.name ?? '—'}
                {s.bot && <span className="tag">bot</span>}
                {!s.connected && <span className="tag off">{t('desconectado')}</span>}
              </div>
              <div className="seat-tags">
                {view.dealer === s.seat && <span className="tag mano">{t('mano')}</span>}
                {h && h.seats[h.seats.length - 1] === s.seat && view.phase === 'hand' && <span className="tag">{t('postre')}</span>}
                {h && rel(s.seat) !== 0 && h.counts[s.seat] > 0 && <span className="count">🂠 {h.counts[s.seat]}</span>}
              </div>
              {h?.muestraInHand && h.dealer === s.seat && rel(s.seat) !== 0 && (
                <div className="muestra-in-hand">
                  <CardView card={h.muestra} small trump={h.trump} />
                </div>
              )}
              {quick && <div className="bubble">{t(quick.text)}</div>}
            </div>
          );
        })}

        {h && (
          <div className="center-muestra" title={t('Muestra: manda {suit}', { suit: suitName(h.trump) })}>
            <CardView card={h.muestra} small trump={h.trump} />
            <span className="lbl">{t('Muestra')}</span>
          </div>
        )}
        <div className="trick">
          {showTrick.map((pl) => {
            const [x, y] = pos(pl.seat);
            const tx = 50 + (x - 50) * 0.36;
            // Separadas del centro para no tapar la muestra.
            const ty = 50 + (y - 50) * 0.62;
            return (
              <div
                key={cardId(pl.card)}
                className="trick-card"
                style={{
                  left: `${tx}%`,
                  top: `${ty}%`,
                  ['--from-x' as string]: `${(x - tx) * 4}px`,
                  ['--from-y' as string]: `${(y - ty) * 4}px`,
                }}
              >
                <CardView card={pl.card} small trump={h!.trump} hints={hints} highlight={(trickDone || partnerWinning) && pl.seat === trickWinner} />
              </div>
            );
          })}
        </div>

        {lastResult && (
          <div className="overlay-card">
            {view.phase === 'finished' ? (
              <>
                <h2>{view.winner === myTeam ? t('¡Habéis ganado!') : t('Gana {team}', { team: teamName(view.winner!) })}</h2>
                <p>
                  Pablos: {teamName(0)} {view.pablos[0]} – {view.pablos[1]} {teamName(1)}
                </p>
                <div className="row">
                  <button className="primary" onClick={() => void p.controller.rematch()}>
                    {t('Revancha')}
                  </button>
                  <button onClick={p.onLeave}>{t('Salir')}</button>
                </div>
              </>
            ) : (
              <>
                <h3>{t('{team} gana {n} puntos', { team: teamName(lastResult.result.winner), n: lastResult.result.points })}</h3>
                <p>{t(REASON[lastResult.result.reason])}</p>
                {view.hand?.lastTrick?.early && <p className="muted">{t('La última baza se cerró antes: nadie podía superar esa carta.')}</p>}
                {lastResult.cuernoWonBy !== null && <p className="big">🐂 {t('¡Cuerno para {team}!', { team: teamName(lastResult.cuernoWonBy) })}</p>}
                {lastResult.pabloWonBy !== null && <p className="big">🏆 {t('¡Pablo para {team}!', { team: teamName(lastResult.pabloWonBy) })}</p>}
              </>
            )}
          </div>
        )}
      </div>

      <div className="status" role="status">
        {status}
        {p.error && <span className="error"> {p.error}</span>}
      </div>

      {h && h.partnerTrumps.length > 0 && view.phase === 'hand' && (
        <div className="partner-trumps">
          {h.partnerTrumps.map((pt) => (
            <div key={pt.seat}>
              {t('Triunfos de {name}:', { name: name(pt.seat) })}{' '}
              {pt.cards.length === 0 ? <em>{t('ninguno')}</em> : pt.cards.map((c) => <CardView key={cardId(c)} card={c} small trump={h.trump} hints={hints} />)}
            </div>
          ))}
        </div>
      )}

      <div className="actions">
        {view.phase === 'deal' && view.canDeal && (
          <button className="primary" onClick={() => act({ type: 'deal' })}>
            {t('Repartir')}
          </button>
        )}
        {h?.canDecideQuiero && (
          <>
            <button className="primary" onClick={() => act({ type: 'quiero', play: true })}>
              {t('Jugamos')}
            </button>
            <button onClick={() => act({ type: 'quiero', play: false })}>{t('Nos vamos')}</button>
          </>
        )}
        {h?.canRespond && (
          <>
            <button className="primary" onClick={() => act({ type: 'accept' })}>
              {t('Quiero')} ({h.pendingBet?.value})
            </button>
            <button onClick={() => act({ type: 'reject' })}>{t('No quiero')}</button>
          </>
        )}
        {h?.canBet && <button onClick={() => act({ type: 'bet' })}>{t('Apostar')} ({h.nextBet})</button>}
      </div>

      <div className="my-hand">
        {handCards.map((c: Card) => {
          const playable = !!h && h.legal.includes(cardId(c));
          const isMyTurn = !!h && h.turn === you && h.phase === 'playing';
          return (
            <CardView
              key={cardId(c)}
              card={c}
              trump={h!.trump}
              hints={hints}
              playable={playable}
              dimmed={isMyTurn && (!playable || (hints && h!.renuncio.includes(cardId(c))))}
              wins={hints && isMyTurn && !partnerWinning && h!.winning.includes(cardId(c))}
              selected={selected === cardId(c)}
              highlight={!!h?.muestraInHand && h.dealer === you && c.suit === h.muestra.suit && c.rank === h.muestra.rank}
              onClick={playable ? () => onCard(c) : undefined}
            />
          );
        })}
      </div>

      <footer className="toolbar">
        {p.controller.mode === 'online' && <SpectatorCount n={room.spectators} />}
        {p.extraTools}
        <button className={p.panel === 'chat' ? 'on' : ''} onClick={() => p.setPanel(p.panel === 'chat' ? 'none' : 'chat')}>
          <Icon name="chat" size={18} />
          <span className="tb-label"> {t('Chat')}</span>
        </button>
        <button className={p.panel === 'log' ? 'on' : ''} onClick={() => p.setPanel(p.panel === 'log' ? 'none' : 'log')}>
          <Icon name="history" size={18} />
          <span className="tb-label"> {t('Historial')}</span>
        </button>
        <button className={p.panel === 'orden' ? 'on' : ''} onClick={() => p.setPanel(p.panel === 'orden' ? 'none' : 'orden')}>
          <Icon name="ranking" size={18} />
          <span className="tb-label"> {t('Orden')}</span>
        </button>
        <button
          className={sound ? 'on' : ''}
          aria-label={sound ? t('Quitar el sonido') : t('Poner el sonido')}
          title={sound ? t('Sonido activado') : t('Sonido desactivado')}
          onClick={() => {
            setSoundOn(!sound);
            setSound(!sound);
          }}
        >
          <Icon name={sound ? 'sound' : 'mute'} size={18} />
        </button>
        <label className="toggle">
          <input type="checkbox" checked={hints} onChange={(e) => p.setHints(e.target.checked)} /> {t('Ayudas')}
        </label>
        <button className="link" onClick={() => confirm(t('¿Salir de la partida?')) && p.onLeave()}>
          {t('Salir')}
        </button>
      </footer>

      {p.panel !== 'none' && (
        <aside className="side-panel">
          <button className="close" aria-label={t('Cerrar')} onClick={() => p.setPanel('none')}>
            ✕
          </button>
          {p.panel === 'chat' && (
            <ChatPanel
              messages={p.snapQuicks}
              name={name}
              you={you}
              seats={room.seats.map((st) => st.seat)}
              humans={room.seats.filter((st) => !st.bot && st.name).map((st) => st.seat)}
              muted={muted}
              onToggleMute={toggleMute}
              onSend={(text) => p.controller.chat(text)}
              onQuick={(i) => p.controller.quick(i)}
              onReport={
                p.controller.report && you !== null
                  ? async (seat) => {
                      if (!muted.has(seat)) toggleMute(seat);
                      return tServer(await p.controller.report!(seat));
                    }
                  : undefined
              }
            />
          )}
          {p.panel === 'log' && (
            <ul className="log">
              {view.events
                .slice()
                .reverse()
                .map((e) => (
                  <li key={e.id}>{describeEvent(e, name, teamName)}</li>
                ))}
            </ul>
          )}
          {p.panel === 'orden' && h && (
            <>
              <h4>{t('Triunfos de mayor a menor (muestra: {suit})', { suit: suitName(h.trump) })}</h4>
              <ol className="ranking">
                {trumpRanking(h.trump, n).map((c) => (
                  <li key={cardId(c)}>{cardLabel(c)}</li>
                ))}
              </ol>
              <p className="muted">{t('Fuera del triunfo: Rey, Caballo, Sota, As, 7, 6, 5, 4, 3, 2.')}</p>
            </>
          )}
        </aside>
      )}
    </div>
  );
}

/**
 * Chat de la mesa: lo leen todos y se puede decir de todo (es entre amigos).
 * Se puede silenciar o reportar a un jugador.
 */
function ChatPanel({
  messages,
  name,
  you,
  seats,
  muted,
  onToggleMute,
  onSend,
  onQuick,
  humans,
  onReport,
}: {
  messages: { from: number; text: string; at: number }[];
  name: (s: number) => string;
  you: number | null;
  seats: number[];
  humans: number[];
  onReport?: (seat: number) => Promise<string>;
  muted: Set<number>;
  onToggleMute: (seat: number) => void;
  onSend: (t: string) => Promise<string | null>;
  onQuick: (i: number) => void;
}) {
  const [text, setText] = useState('');
  const [warning, setWarning] = useState<string | null>(null);
  const send = async () => {
    if (!text.trim()) return;
    const w = await onSend(text);
    setWarning(w ? tServer(w) : null);
    if (!w) setText('');
  };
  const others = seats.filter((s) => s !== you);
  const reportable = humans.filter((s) => s !== you);
  const [reportMsg, setReportMsg] = useState<string | null>(null);
  const [reported, setReported] = useState<Set<number>>(() => new Set());
  return (
    <>
      <h4>{t('Chat de la mesa')}</h4>
      <p className="muted small">{t('Lo leen todos, también el otro equipo.')}</p>
      <ul className="log chat-log">
        {messages.filter((m) => !muted.has(m.from)).length === 0 && <li className="muted">{t('Aún no hay mensajes.')}</li>}
        {messages
          .filter((m) => !muted.has(m.from))
          .slice(-30)
          .reverse()
          .map((m) => (
            <li key={m.at + '-' + m.from}>
              <strong>{name(m.from)}:</strong> {t(m.text)}
            </li>
          ))}
      </ul>
      <div className="row tight chat-input">
        <input
          value={text}
          maxLength={CHAT_MAX_LENGTH}
          placeholder={t('Escribe a la mesa…')}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void send()}
        />
        <button className="primary" onClick={() => void send()}>
          {t('Enviar')}
        </button>
      </div>
      {warning && (
        <p className="chat-warning" role="alert">
          ⚠️ {warning}
        </p>
      )}
      <div className="grid-buttons quick-row">
        {QUICK_MESSAGES.map((q, i) => (
          <button key={q} onClick={() => onQuick(i)}>
            {t(q)}
          </button>
        ))}
      </div>
      {others.length > 0 && (
        <details className="mute-list">
          <summary>{t('Silenciar a un jugador')}</summary>
          {others.map((s) => (
            <label key={s} className="toggle">
              <input type="checkbox" checked={muted.has(s)} onChange={() => onToggleMute(s)} /> {name(s)}
            </label>
          ))}
        </details>
      )}
      {onReport && reportable.length > 0 && (
        <details className="mute-list report-list">
          <summary>{t('Reportar a un jugador')}</summary>
          <p className="muted small">
            {t('Si alguien hace trampas o molesta. Si lo reporta la mitad del resto de la mesa, se le expulsa y juega un bot por él.')}
          </p>
          {reportable.map((s) => (
            <div key={s} className="row tight report-row">
              <span>{name(s)}</span>
              <button
                className="danger"
                disabled={reported.has(s)}
                onClick={async () => {
                  setReported((r) => new Set(r).add(s));
                  setReportMsg(await onReport(s));
                }}
              >
                {reported.has(s) ? t('Reportado') : t('Reportar')}
              </button>
            </div>
          ))}
          {reportMsg && <p className="chat-warning">{reportMsg}</p>}
        </details>
      )}
    </>
  );
}

/**
 * Avisos flotantes y sonidos a partir de los eventos de la partida (apuestas, bazas, cuernos…).
 * Solo se avisa de los eventos nuevos (no de los que ya estaban al entrar en la mesa).
 */
function useEventToasts(view: PlayerView, teamNames: [string, string], you: number | null, name: (s: number) => string) {
  const [toasts, setToasts] = useState<{ id: number; text: string; big?: boolean }[]>([]);
  const lastSeen = useRef<number | null>(null);
  const lastHand = useRef<number>(view.handNumber);
  const lastTurn = useRef<string>('');

  useEffect(() => {
    const events = view.events;
    const newest = events.length ? events[events.length - 1].id : 0;
    if (lastSeen.current === null) {
      lastSeen.current = newest;
      return;
    }
    const fresh = events.filter((e) => e.id > lastSeen.current!);
    lastSeen.current = newest;
    const myTeam = you === null ? null : teamOf(you);
    const add: { id: number; text: string; big?: boolean }[] = [];
    for (const e of fresh) {
      switch (e.kind) {
        case 'trick':
          playSound('trick');
          break;
        case 'bet':
          playSound('bet');
          add.push({ id: e.id, text: e.seat === you ? t('Apuestas: la mano valdría {n}', { n: e.value }) : t('{name} apuesta: la mano valdría {n}', { name: name(e.seat), n: e.value }) });
          break;
        case 'accept':
          add.push({ id: e.id, text: e.seat === you ? t('Quieres. La mano vale {n}', { n: e.value }) : t('{name} quiere. La mano vale {n}', { name: name(e.seat), n: e.value }) });
          break;
        case 'reject':
          add.push({ id: e.id, text: e.seat === you ? t('No quieres') : t('{name} no quiere', { name: name(e.seat) }) });
          break;
        case 'cuerno':
          playSound(e.team === myTeam ? 'win' : 'lose');
          add.push({ id: e.id, text: `🐂 ${t('¡Cuerno para {team}!', { team: teamNames[e.team] })}`, big: true });
          break;
        case 'matchEnd':
          playSound(e.team === myTeam ? 'win' : 'lose');
          add.push({ id: e.id, text: `🏆 ${t('¡{team} gana la partida!', { team: teamNames[e.team] })}`, big: true });
          break;
        case 'deal':
          playSound('deal');
          break;
      }
    }
    if (add.length) {
      setToasts((ts) => [...ts, ...add].slice(-3));
      const ids = add.map((a) => a.id);
      setTimeout(() => setToasts((ts) => ts.filter((x) => !ids.includes(x.id))), 3200);
    }
  }, [view.events, teamNames, you, name]);

  // Avisos de fuera de la partida (p. ej. retos conseguidos).
  useEffect(() => {
    const on = (e: Event) => {
      const text = String((e as CustomEvent).detail ?? '');
      const id = Date.now() + Math.random();
      playSound('win');
      setToasts((ts) => [...ts, { id, text, big: true }].slice(-3));
      setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), 4000);
    };
    window.addEventListener('pablo:toast', on);
    return () => window.removeEventListener('pablo:toast', on);
  }, []);

  // Sonido al echar carta y cuando te toca.
  const h = view.hand;
  const trickLen = h ? h.trick.length + h.tricks.length * 10 : 0;
  useEffect(() => {
    if (view.handNumber !== lastHand.current) {
      lastHand.current = view.handNumber;
      return;
    }
    if (trickLen > 0) playSound('card');
  }, [trickLen, view.handNumber]);
  const turnKey = h && h.phase === 'playing' && h.turn === you ? `${view.handNumber}-${h.trickIndex}-${h.trick.length}` : '';
  useEffect(() => {
    if (turnKey && turnKey !== lastTurn.current) playSound('turn');
    lastTurn.current = turnKey;
  }, [turnKey]);

  return toasts;
}

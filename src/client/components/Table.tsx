import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  Card,
  MatchEvent,
  PlayerView,
  QUICK_MESSAGES,
  Team,
  cardId,
  cardName,
  sortValue,
  teamOf,
  trickWinnerIndex,
  trumpRanking,
} from '../../shared/engine';
import type { RoomInfo } from '../../shared/protocol';
import { Controller } from '../services/controller';
import { recordMatch, summarize } from '../services/stats';
import { CHAT_MAX_LENGTH } from '../../shared/chat';
import { CardView, SuitIcon } from './CardView';

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
      return `${name(e.dealer)} reparte.`;
    case 'trick':
      return `${name(e.winner)} gana la baza ${e.index + 1}.`;
    case 'bet':
      return `${name(e.seat)} apuesta: la mano valdría ${e.value}.`;
    case 'accept':
      return `${name(e.seat)} acepta. La mano vale ${e.value}.`;
    case 'reject':
      return `${name(e.seat)} no quiere.`;
    case 'quiero':
      return `${name(e.seat)} decide ${e.play ? 'jugar' : 'irse'} (al quiero).`;
    case 'handEnd':
      return `${team(e.result.winner)} gana ${e.result.points} puntos ${REASON[e.result.reason]}.`;
    case 'cuerno':
      return `¡${team(e.team)} gana un cuerno!`;
    case 'pablo':
      return `¡${team(e.team)} gana un Pablo!`;
    case 'matchEnd':
      return `¡${team(e.team)} gana la partida!`;
  }
}

interface TableProps {
  controller: Controller;
  onLeave: () => void;
  onReplaceWithBot?: (seat: number) => void;
}

export function Table({ controller, onLeave, onReplaceWithBot }: TableProps) {
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

  if (!room || !view) return <div className="center-msg">Cargando partida…</div>;

  const act = async (a: Parameters<Controller['act']>[0]) => {
    const err = await controller.act(a);
    if (err) setError(err);
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
  useWakeLock();
  const n = room.config.players;
  const you = view.you;
  const base = you ?? 0;
  const h = view.hand;
  const myTeam: Team | null = you === null ? null : teamOf(you);
  const name = (s: number) => (s === you ? 'Tú' : room.seats[s]?.name ?? `Jugador ${s + 1}`);
  const teamName = (t: Team) => room.config.teamNames[t];
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

  const recentQuick = (s: number) => p.snapQuicks.filter((m) => m.from === s && now - m.at < 5000).slice(-1)[0];

  let status = '';
  if (view.phase === 'deal') {
    status = view.canDeal ? 'Eres el mano: reparte.' : `Esperando a que ${name(view.dealer)} reparta.`;
  } else if (h && view.phase === 'hand') {
    if (h.phase === 'quiero') {
      const t = h.quieroTeams[0];
      status = h.canDecideQuiero
        ? 'Tu equipo está al quiero: mirad los triunfos y decidid si jugáis o os vais.'
        : `${teamName(t)} está al quiero y decide si juega.`;
    } else if (h.phase === 'bet' && h.pendingBet) {
      status = h.canRespond
        ? `${name(h.pendingBet.seat)} apuesta: la mano pasaría a valer ${h.pendingBet.value}. ¿Lo quieres?`
        : `${name(h.pendingBet.seat)} apuesta ${h.pendingBet.value}. Esperando respuesta del rival…`;
    } else if (you !== null && h.seats.includes(you) && !h.received[you]) {
      status = 'El mano aún no te ha dado las cartas (se reparten conforme juegan los rivales).';
    } else if (h.turn === you) {
      status = 'Te toca. Elige carta.';
      if (h.renuncio.length > 0) status = '¡Arrastre! Tienes que echar triunfo (el Pablo te lo puedes guardar).';
      else if (hints && h.winning.length > 0) status = 'Te toca. Tienes cartas que ganan esta baza (marcadas con ✓).';
    }
    else status = `Turno de ${name(h.turn)}.`;
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
    if (hints && h?.renuncio.includes(id) && !confirm('Hay arrastre y tienes triunfo. Si echas esta carta es renuncio y tu equipo pierde la mano. ¿Echarla igualmente?')) return;
    act({ type: 'play', card: c });
  };
  if (isTouch && h && h.turn === you && selected && status.startsWith('Te toca')) status = 'Toca otra vez la carta para jugarla.';
  if (trickDone && trickWinner !== null && view.phase === 'hand' && h?.trick.length === 0) status = `Baza para ${name(trickWinner)}. ${status}`;

  return (
    <div className="game">
      <header className="scorebar">
        {([0, 1] as Team[]).map((t) => (
          <div key={t} className={`team-score team-${t} ${myTeam === t ? 'mine' : ''}`}>
            <div className="team-name">{teamName(t)}</div>
            <div className="pts">
              <strong>{view.score[t]}</strong>
              <small>/{room.config.pointsPerCuerno}</small>
              {view.score[t] >= view.quieroThreshold && <span className="tag quiero">al quiero</span>}
            </div>
            <div className="sub">
              <span title="Cuernos (partidas) ganados">🐂 {view.cuernos[t]}/{room.config.cuernosPerPablo}</span>
              {room.config.pablosToWin > 1 && <span title="Pablos ganados"> · 🏆 {view.pablos[t]}/{room.config.pablosToWin}</span>}
            </div>
          </div>
        ))}
        {h && (
          <div className="hand-info">
            <div className="muestra">
              <div>
                <div className="lbl">Triunfo</div>
                <div className="trump-name">
                  <SuitIcon suit={h.trump} size={16} /> {h.trump}
                </div>
              </div>
            </div>
            <div className="stake">
              <div className="lbl">Vale</div>
              <strong>{h.stake}</strong>
            </div>
            <div className="stake">
              <div className="lbl">Bazas</div>
              <strong>
                {myTeam === null ? `${h.wins[0]}-${h.wins[1]}` : `${h.wins[myTeam]}-${h.wins[1 - myTeam]}`}
              </strong>
            </div>
          </div>
        )}
      </header>

      {!p.connected && <div className="banner warn">Sin conexión con el servidor. Reintentando…</div>}
      {disconnected.length > 0 && view.phase !== 'finished' && (
        <div className="banner warn">
          Desconectado: {disconnected.map((s) => s.name).join(', ')}.
          {room.youAreHost && p.onReplaceWithBot &&
            disconnected.map((s) => (
              <button key={s.seat} className="link" onClick={() => p.onReplaceWithBot!(s.seat)}>
                Sustituir a {s.name} por un bot
              </button>
            ))}
        </div>
      )}

      <div className={`felt players-${n}`}>
        {room.seats.map((s) => {
          const [x, y] = pos(s.seat);
          const active = !h || h.seats.includes(s.seat);
          const quick = recentQuick(s.seat);
          const isTurn = h && view.phase === 'hand' && h.turn === s.seat && h.phase === 'playing';
          return (
            <div
              key={s.seat}
              className={`seat ${sideClass(x)} team-${teamOf(s.seat)} ${isTurn ? 'turn' : ''} ${active ? '' : 'inactive'} ${rel(s.seat) === 0 ? 'me' : ''}`}
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              <div className="seat-name">
                {s.seat === you ? 'Tú' : s.name ?? '—'}
                {s.bot && <span className="tag">bot</span>}
                {!s.connected && <span className="tag off">desconectado</span>}
              </div>
              <div className="seat-tags">
                {view.dealer === s.seat && <span className="tag mano">mano</span>}
                {h && h.seats[h.seats.length - 1] === s.seat && view.phase === 'hand' && <span className="tag">postre</span>}
                {h && rel(s.seat) !== 0 && h.counts[s.seat] > 0 && <span className="count">🂠 {h.counts[s.seat]}</span>}
              </div>
              {h?.muestraInHand && h.dealer === s.seat && rel(s.seat) !== 0 && (
                <div className="muestra-in-hand">
                  <CardView card={h.muestra} small trump={h.trump} />
                </div>
              )}
              {quick && <div className="bubble">{quick.text}</div>}
            </div>
          );
        })}

        {h && (
          <div className="center-muestra" title={`Muestra: manda ${h.trump}`}>
            <CardView card={h.muestra} small trump={h.trump} />
            <span className="lbl">Muestra</span>
          </div>
        )}
        <div className="trick">
          {showTrick.map((pl) => {
            const [x, y] = pos(pl.seat);
            const tx = 50 + (x - 50) * 0.36;
            // Separadas del centro para no tapar la muestra.
            const ty = 50 + (y - 50) * 0.62;
            return (
              <div key={cardId(pl.card)} className="trick-card" style={{ left: `${tx}%`, top: `${ty}%` }}>
                <CardView card={pl.card} small trump={h!.trump} hints={hints} highlight={trickDone && pl.seat === trickWinner} />
              </div>
            );
          })}
        </div>

        {lastResult && (
          <div className="overlay-card">
            {view.phase === 'finished' ? (
              <>
                <h2>{view.winner === myTeam ? '¡Habéis ganado!' : `Gana ${teamName(view.winner!)}`}</h2>
                <p>
                  Pablos: {teamName(0)} {view.pablos[0]} – {view.pablos[1]} {teamName(1)}
                </p>
                <div className="row">
                  <button className="primary" onClick={() => void p.controller.rematch()}>
                    Revancha
                  </button>
                  <button onClick={p.onLeave}>Salir</button>
                </div>
              </>
            ) : (
              <>
                <h3>
                  {teamName(lastResult.result.winner)} gana {lastResult.result.points} puntos
                </h3>
                <p>{REASON[lastResult.result.reason]}</p>
                {lastResult.cuernoWonBy !== null && <p className="big">🐂 ¡Cuerno para {teamName(lastResult.cuernoWonBy)}!</p>}
                {lastResult.pabloWonBy !== null && <p className="big">🏆 ¡Pablo para {teamName(lastResult.pabloWonBy)}!</p>}
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
              Triunfos de {name(pt.seat)}:{' '}
              {pt.cards.length === 0 ? <em>ninguno</em> : pt.cards.map((c) => <CardView key={cardId(c)} card={c} small trump={h.trump} hints={hints} />)}
            </div>
          ))}
        </div>
      )}

      <div className="actions">
        {view.phase === 'deal' && view.canDeal && (
          <button className="primary" onClick={() => act({ type: 'deal' })}>
            Repartir
          </button>
        )}
        {h?.canDecideQuiero && (
          <>
            <button className="primary" onClick={() => act({ type: 'quiero', play: true })}>
              Jugamos
            </button>
            <button onClick={() => act({ type: 'quiero', play: false })}>Nos vamos</button>
          </>
        )}
        {h?.canRespond && (
          <>
            <button className="primary" onClick={() => act({ type: 'accept' })}>
              Quiero ({h.pendingBet?.value})
            </button>
            <button onClick={() => act({ type: 'reject' })}>No quiero</button>
          </>
        )}
        {h?.canBet && <button onClick={() => act({ type: 'bet' })}>Apostar ({h.nextBet})</button>}
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
              wins={hints && isMyTurn && h!.winning.includes(cardId(c))}
              selected={selected === cardId(c)}
              highlight={!!h?.muestraInHand && h.dealer === you && c.suit === h.muestra.suit && c.rank === h.muestra.rank}
              onClick={playable ? () => onCard(c) : undefined}
            />
          );
        })}
      </div>

      <footer className="toolbar">
        <button className={p.panel === 'chat' ? 'on' : ''} onClick={() => p.setPanel(p.panel === 'chat' ? 'none' : 'chat')}>
          💬<span className="tb-label"> Chat</span>
        </button>
        <button className={p.panel === 'log' ? 'on' : ''} onClick={() => p.setPanel(p.panel === 'log' ? 'none' : 'log')}>
          📜<span className="tb-label"> Historial</span>
        </button>
        <button className={p.panel === 'orden' ? 'on' : ''} onClick={() => p.setPanel(p.panel === 'orden' ? 'none' : 'orden')}>
          🃏<span className="tb-label"> Orden</span>
        </button>
        <label className="toggle">
          <input type="checkbox" checked={hints} onChange={(e) => p.setHints(e.target.checked)} /> Ayudas
        </label>
        <button className="link" onClick={() => confirm('¿Salir de la partida?') && p.onLeave()}>
          Salir
        </button>
      </footer>

      {p.panel !== 'none' && (
        <aside className="side-panel">
          <button className="close" aria-label="Cerrar" onClick={() => p.setPanel('none')}>
            ✕
          </button>
          {p.panel === 'chat' && (
            <ChatPanel messages={p.snapQuicks} name={name} onSend={(t) => p.controller.chat(t)} onQuick={(i) => p.controller.quick(i)} />
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
              <h4>Triunfos de mayor a menor (muestra: {h.trump})</h4>
              <ol className="ranking">
                {trumpRanking(h.trump, n).map((c) => (
                  <li key={cardId(c)}>{cardName(c)}</li>
                ))}
              </ol>
              <p className="muted">Fuera del triunfo: Rey, Caballo, Sota, As, 7, 6, 5, 4, 3, 2.</p>
            </>
          )}
        </aside>
      )}
    </div>
  );
}

/** Chat de la mesa: lo leen todos; las palabras que nombran cartas salen tachadas (lo hace el servidor). */
function ChatPanel({
  messages,
  name,
  onSend,
  onQuick,
}: {
  messages: { from: number; text: string; at: number }[];
  name: (s: number) => string;
  onSend: (t: string) => void;
  onQuick: (i: number) => void;
}) {
  const [text, setText] = useState('');
  const send = () => {
    if (!text.trim()) return;
    onSend(text);
    setText('');
  };
  return (
    <>
      <h4>Chat de la mesa</h4>
      <p className="muted small">Lo leen todos. Las palabras que nombran cartas salen tachadas (****).</p>
      <ul className="log chat-log">
        {messages.length === 0 && <li className="muted">Aún no hay mensajes.</li>}
        {messages
          .slice(-30)
          .reverse()
          .map((m) => (
            <li key={m.at + '-' + m.from}>
              <strong>{name(m.from)}:</strong> {m.text}
            </li>
          ))}
      </ul>
      <div className="row tight chat-input">
        <input
          value={text}
          maxLength={CHAT_MAX_LENGTH}
          placeholder="Escribe a la mesa…"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
        />
        <button className="primary" onClick={send}>
          Enviar
        </button>
      </div>
      <div className="grid-buttons quick-row">
        {QUICK_MESSAGES.map((q, i) => (
          <button key={q} onClick={() => onQuick(i)}>
            {q}
          </button>
        ))}
      </div>
    </>
  );
}

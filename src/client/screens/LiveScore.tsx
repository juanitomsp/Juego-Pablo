/**
 * Marcador para partidas en vivo (con baraja física): puntos, cuernos, Pablos, valor de la mano,
 * quién es mano, aviso de "al quiero" y referencia del orden de triunfos.
 */
import { useEffect, useState } from 'react';
import { SUITS, Suit, cardName, cardId, trumpRanking } from '../../shared/engine';
import { go } from '../App';
import { SuitIcon } from '../components/CardView';
import { recordMatch } from '../services/stats';

interface LiveState {
  players: 4 | 6;
  pointsPerCuerno: number;
  cuernosPerPablo: number;
  pablosToWin: number;
  teamNames: [string, string];
  myTeam: 0 | 1 | null;
  dealer: number;
  score: [number, number];
  cuernos: [number, number];
  pablos: [number, number];
  stake: number;
  betCount: number;
  cartetaUsed: boolean;
  hands: number;
  log: string[];
  winner: 0 | 1 | null;
  started: string;
}

const KEY = 'pablo.live';
/** Valor de una mano sin apuestas; cada apuesta aceptada suma 1. */
const HAND = 1;

const fresh = (prev?: Partial<LiveState>): LiveState => ({
  players: prev?.players ?? 4,
  pointsPerCuerno: prev?.pointsPerCuerno ?? 8,
  cuernosPerPablo: prev?.cuernosPerPablo ?? 2,
  pablosToWin: prev?.pablosToWin ?? 1,
  teamNames: prev?.teamNames ?? ['Nosotros', 'Ellos'],
  myTeam: prev?.myTeam ?? 0,
  dealer: 0,
  score: [0, 0],
  cuernos: [0, 0],
  pablos: [0, 0],
  stake: HAND,
  betCount: 0,
  cartetaUsed: false,
  hands: 0,
  log: [],
  winner: null,
  started: new Date().toISOString(),
});

function load(): LiveState {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    return s ? { ...fresh(), ...s } : fresh();
  } catch {
    return fresh();
  }
}

export function LiveScore() {
  const [s, setS] = useState<LiveState>(load);
  const [undo, setUndo] = useState<LiveState[]>([]);
  const [suit, setSuit] = useState<Suit>('oros');
  const [setup, setSetup] = useState(false);

  useEffect(() => localStorage.setItem(KEY, JSON.stringify(s)), [s]);

  const commit = (next: LiveState) => {
    setUndo((u) => [...u.slice(-49), s]);
    setS(next);
  };

  const quiero = s.pointsPerCuerno - HAND;
  const alQuiero = (t: 0 | 1) => s.score[t] >= quiero;
  const forced = alQuiero(0) && alQuiero(1);
  const half = s.pointsPerCuerno / 2;
  const cartetaOk = !s.cartetaUsed && s.score[0] < half && s.score[1] < half;

  const win = (t: 0 | 1, points: number, why: string) => {
    const n: LiveState = structuredClone(s);
    n.hands++;
    n.score[t] += points;
    n.log = [`Mano ${n.hands}: ${s.teamNames[t]} +${points} (${why})`, ...n.log].slice(0, 100);
    if (n.score[t] >= n.pointsPerCuerno) {
      n.cuernos[t]++;
      n.score = [0, 0];
      n.cartetaUsed = false;
      n.log.unshift(`🐂 Cuerno para ${s.teamNames[t]}`);
      if (n.cuernos[t] >= n.cuernosPerPablo) {
        n.pablos[t]++;
        n.cuernos = [0, 0];
        n.log.unshift(`🏆 Pablo para ${s.teamNames[t]}`);
        if (n.pablos[t] >= n.pablosToWin) {
          n.winner = t;
          n.log.unshift(`🎉 ${s.teamNames[t]} gana la partida`);
          if (n.myTeam !== null)
            void recordMatch({
              id: `vivo-${n.started}`,
              date: new Date().toISOString(),
              mode: 'vivo',
              players: n.players,
              won: n.myTeam === t,
              pablos: [n.pablos[n.myTeam], n.pablos[1 - n.myTeam]],
              hands: n.hands,
              handsWon: 0,
              tricksWon: 0,
              betsMade: 0,
              betsWon: 0,
              cartetas: 0,
            });
        }
      }
    }
    n.stake = HAND;
    n.betCount = 0;
    n.dealer = (n.dealer + 1) % n.players;
    commit(n);
  };

  const bet = () => commit({ ...s, stake: s.stake + 1, betCount: s.betCount + 1 });

  return (
    <main className="page live">
      <nav className="topnav">
        <button className="link" onClick={() => go('/')}>
          ← Inicio
        </button>
        <span>Marcador en vivo</span>
        <button className="link" onClick={() => setSetup(!setup)}>
          ⚙️ Ajustes
        </button>
      </nav>

      {setup && (
        <section className="panel">
          <div className="options">
            <div className="field">
              <span>Jugadores</span>
              <div className="segmented">
                {([4, 6] as const).map((n) => (
                  <button key={n} className={s.players === n ? 'on' : ''} onClick={() => setS({ ...s, players: n, dealer: s.dealer % n })}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
            {(['pointsPerCuerno', 'cuernosPerPablo', 'pablosToWin'] as const).map((k) => (
              <label className="field" key={k}>
                <span>{k === 'pointsPerCuerno' ? 'Puntos por cuerno' : k === 'cuernosPerPablo' ? 'Cuernos por Pablo' : 'Pablos para ganar'}</span>
                <input type="number" min={1} max={60} value={s[k]} onChange={(e) => setS({ ...s, [k]: Math.max(1, Number(e.target.value) || 1) })} />
              </label>
            ))}
            {[0, 1].map((t) => (
              <label className="field" key={t}>
                <span>Equipo {t + 1}</span>
                <input
                  value={s.teamNames[t]}
                  maxLength={20}
                  onChange={(e) => {
                    const names = [...s.teamNames] as [string, string];
                    names[t] = e.target.value;
                    setS({ ...s, teamNames: names });
                  }}
                />
              </label>
            ))}
            <label className="field">
              <span>Mi equipo (para estadísticas)</span>
              <select value={s.myTeam ?? ''} onChange={(e) => setS({ ...s, myTeam: e.target.value === '' ? null : (Number(e.target.value) as 0 | 1) })}>
                <option value="0">{s.teamNames[0]}</option>
                <option value="1">{s.teamNames[1]}</option>
                <option value="">No guardar</option>
              </select>
            </label>
          </div>
          <div className="row">
            <button className="danger" onClick={() => confirm('¿Empezar una partida nueva?') && commit(fresh(s))}>
              Nueva partida
            </button>
          </div>
        </section>
      )}

      <section className="live-board">
        {([0, 1] as const).map((t) => (
          <div key={t} className={`live-team team-${t}`}>
            <h2>{s.teamNames[t]}</h2>
            <div className="live-points">
              {s.score[t]}
              <small>/{s.pointsPerCuerno}</small>
            </div>
            <div>
              Cuernos {s.cuernos[t]}/{s.cuernosPerPablo} · Pablos {s.pablos[t]}/{s.pablosToWin}
            </div>
            {alQuiero(t) && <span className="tag quiero">al quiero</span>}
            <button className="primary big" disabled={s.winner !== null} onClick={() => win(t, s.stake, 'gana la mano')}>
              Gana la mano (+{s.stake})
            </button>
            {alQuiero(t) && !forced && (
              <button disabled={s.winner !== null} onClick={() => win(t === 0 ? 1 : 0, HAND, 'el equipo al quiero se va')}>
                Al quiero: se van (+{HAND} al rival)
              </button>
            )}
          </div>
        ))}
      </section>

      <section className="panel live-hand">
        <div>
          Mano (reparte): <strong>Jugador {s.dealer + 1}</strong>{' '}
          <button className="link" onClick={() => setS({ ...s, dealer: (s.dealer + 1) % s.players })}>
            cambiar
          </button>
        </div>
        <div>
          Esta mano vale <strong>{s.stake}</strong> puntos.{' '}
          {forced ? (
            <em>Quiero forzoso: sin apuestas.</em>
          ) : (
            <>
              <button onClick={bet}>Apuesta aceptada → {s.stake + 1}</button>{' '}
              {s.betCount > 0 && (
                <button className="link" onClick={() => setS({ ...s, stake: HAND, betCount: 0 })}>
                  reiniciar
                </button>
              )}
            </>
          )}
        </div>
        <p className="muted small">
          Si un equipo no acepta una apuesta, pulsa «Gana la mano» del equipo que apostó con el valor que tenía la mano antes de apostar.
        </p>
        <div>
          Carteta: {cartetaOk ? 'se puede jugar en este cuerno' : 'no disponible'}{' '}
          {cartetaOk && (
            <button className="link" onClick={() => commit({ ...s, cartetaUsed: true })}>
              marcar como jugada
            </button>
          )}
        </div>
        <div className="row">
          <button disabled={undo.length === 0} onClick={() => (setS(undo[undo.length - 1]), setUndo(undo.slice(0, -1)))}>
            ↶ Deshacer
          </button>
        </div>
      </section>

      <section className="panel">
        <h3>Orden de triunfos</h3>
        <div className="segmented">
          {SUITS.map((x) => (
            <button key={x} className={suit === x ? 'on' : ''} onClick={() => setSuit(x)}>
              <SuitIcon suit={x} size={16} /> {x}
            </button>
          ))}
        </div>
        <ol className="ranking">
          {trumpRanking(suit, s.players).map((c) => (
            <li key={cardId(c)}>{cardName(c)}</li>
          ))}
        </ol>
      </section>

      {s.log.length > 0 && (
        <section className="panel">
          <h3>Historial</h3>
          <ul className="log">
            {s.log.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

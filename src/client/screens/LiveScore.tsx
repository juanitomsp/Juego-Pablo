/**
 * Marcador para partidas en vivo (con baraja física): puntos, cuernos, Pablos, valor de la mano,
 * quién es mano, aviso de "al quiero" y referencia del orden de triunfos.
 */
import { useEffect, useState } from 'react';
import { SUITS, Suit, cardId, trumpRanking } from '../../shared/engine';
import { go } from '../App';
import { SuitIcon } from '../components/CardView';
import { recordMatch } from '../services/stats';
import { cardLabel, suitName, t } from '../i18n';

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
  teamNames: prev?.teamNames ?? [t('Nosotros'), t('Ellos')],
  myTeam: prev?.myTeam ?? 0,
  dealer: 0,
  score: [0, 0],
  cuernos: [0, 0],
  pablos: [0, 0],
  stake: HAND,
  betCount: 0,
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
  const alQuiero = (tm: 0 | 1) => s.score[tm] >= quiero;
  const forced = alQuiero(0) && alQuiero(1);

  const win = (tm: 0 | 1, points: number, why: string) => {
    const n: LiveState = structuredClone(s);
    n.hands++;
    n.score[tm] += points;
    n.log = [`${t('Mano')} ${n.hands}: ${s.teamNames[tm]} +${points} (${t(why)})`, ...n.log].slice(0, 100);
    if (n.score[tm] >= n.pointsPerCuerno) {
      n.cuernos[tm]++;
      n.score = [0, 0];
      n.log.unshift(`🐂 ${t('¡Cuerno para {team}!', { team: s.teamNames[tm] })}`);
      if (n.cuernos[tm] >= n.cuernosPerPablo) {
        n.pablos[tm]++;
        n.cuernos = [0, 0];
        n.log.unshift(`🏆 ${t('¡Pablo para {team}!', { team: s.teamNames[tm] })}`);
        if (n.pablos[tm] >= n.pablosToWin) {
          n.winner = tm;
          n.log.unshift(`🎉 ${t('¡{team} gana la partida!', { team: s.teamNames[tm] })}`);
          if (n.myTeam !== null)
            void recordMatch({
              id: `vivo-${n.started}`,
              date: new Date().toISOString(),
              mode: 'vivo',
              players: n.players,
              won: n.myTeam === tm,
              pablos: [n.pablos[n.myTeam], n.pablos[1 - n.myTeam]],
              hands: n.hands,
              handsWon: 0,
              tricksWon: 0,
              betsMade: 0,
              betsWon: 0,
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
          ← {t('Inicio')}
        </button>
        <span>{t('Marcador en vivo')}</span>
        <button className="link" onClick={() => setSetup(!setup)}>
          ⚙️ {t('Ajustes')}
        </button>
      </nav>

      {setup && (
        <section className="panel">
          <div className="options">
            <div className="field">
              <span>{t('Jugadores')}</span>
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
                <span>{t(k === 'pointsPerCuerno' ? 'Puntos por cuerno' : k === 'cuernosPerPablo' ? 'Cuernos por Pablo' : 'Pablos para ganar')}</span>
                <input type="number" min={1} max={60} value={s[k]} onChange={(e) => setS({ ...s, [k]: Math.max(1, Number(e.target.value) || 1) })} />
              </label>
            ))}
            {[0, 1].map((tm) => (
              <label className="field" key={tm}>
                <span>{t('Equipo {n}', { n: tm + 1 })}</span>
                <input
                  value={s.teamNames[tm]}
                  maxLength={20}
                  onChange={(e) => {
                    const names = [...s.teamNames] as [string, string];
                    names[tm] = e.target.value;
                    setS({ ...s, teamNames: names });
                  }}
                />
              </label>
            ))}
            <label className="field">
              <span>{t('Mi equipo (para estadísticas)')}</span>
              <select value={s.myTeam ?? ''} onChange={(e) => setS({ ...s, myTeam: e.target.value === '' ? null : (Number(e.target.value) as 0 | 1) })}>
                <option value="0">{s.teamNames[0]}</option>
                <option value="1">{s.teamNames[1]}</option>
                <option value="">{t('No guardar')}</option>
              </select>
            </label>
          </div>
          <div className="row">
            <button className="danger" onClick={() => confirm(t('¿Empezar una partida nueva?')) && commit(fresh(s))}>
              {t('Nueva partida')}
            </button>
          </div>
        </section>
      )}

      <section className="live-board">
        {([0, 1] as const).map((tm) => (
          <div key={tm} className={`live-team team-${tm}`}>
            <h2>{s.teamNames[tm]}</h2>
            <div className="live-points">
              {s.score[tm]}
              <small>/{s.pointsPerCuerno}</small>
            </div>
            <div>
              {t('Cuernos')} {s.cuernos[tm]}/{s.cuernosPerPablo} · Pablos {s.pablos[tm]}/{s.pablosToWin}
            </div>
            {alQuiero(tm) && <span className="tag quiero">{t('al quiero')}</span>}
            <button className="primary big" disabled={s.winner !== null} onClick={() => win(tm, s.stake, 'gana la mano')}>
              {t('Gana la mano')} (+{s.stake})
            </button>
            {alQuiero(tm) && !forced && (
              <button disabled={s.winner !== null} onClick={() => win(tm === 0 ? 1 : 0, HAND, 'el equipo al quiero se va')}>
                {t('Al quiero: se van (+{n} al rival)', { n: HAND })}
              </button>
            )}
          </div>
        ))}
      </section>

      <section className="panel live-hand">
        <div>
          {t('Mano (reparte):')} <strong>{t('Jugador {n}', { n: s.dealer + 1 })}</strong>{' '}
          <button className="link" onClick={() => setS({ ...s, dealer: (s.dealer + 1) % s.players })}>
            {t('cambiar')}
          </button>
        </div>
        <div>
          {t('Esta mano vale')} <strong>{s.stake}</strong> {t('puntos.')}{' '}
          {forced ? (
            <em>{t('Quiero forzoso: sin apuestas.')}</em>
          ) : (
            <>
              <button onClick={bet}>{t('Apuesta aceptada')} → {s.stake + 1}</button>{' '}
              {s.betCount > 0 && (
                <button className="link" onClick={() => setS({ ...s, stake: HAND, betCount: 0 })}>
                  {t('reiniciar')}
                </button>
              )}
            </>
          )}
        </div>
        <p className="muted small">
          {t('Si un equipo no acepta una apuesta, pulsa «Gana la mano» del equipo que apostó con el valor que tenía la mano antes de apostar.')}
        </p>
        <div className="row">
          <button disabled={undo.length === 0} onClick={() => (setS(undo[undo.length - 1]), setUndo(undo.slice(0, -1)))}>
            ↶ {t('Deshacer')}
          </button>
        </div>
      </section>

      <section className="panel">
        <h3>{t('Orden de triunfos')}</h3>
        <div className="segmented">
          {SUITS.map((x) => (
            <button key={x} className={suit === x ? 'on' : ''} onClick={() => setSuit(x)}>
              <SuitIcon suit={x} size={16} /> {suitName(x)}
            </button>
          ))}
        </div>
        <ol className="ranking">
          {trumpRanking(suit, s.players).map((c) => (
            <li key={cardId(c)}>{cardLabel(c)}</li>
          ))}
        </ol>
      </section>

      {s.log.length > 0 && (
        <section className="panel">
          <h3>{t('Historial')}</h3>
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

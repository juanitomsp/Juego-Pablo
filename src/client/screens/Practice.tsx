import { useEffect, useState } from 'react';
import { go } from '../App';
import { Table } from '../components/Table';
import { LocalController } from '../services/controller';
import type { BotLevel } from '../../shared/engine';

export function Practice() {
  const [players, setPlayers] = useState<4 | 6>(4);
  const [pablos, setPablos] = useState(1);
  const [level, setLevel] = useState<BotLevel>(() => (localStorage.getItem('pablo.botLevel') as BotLevel) || 'normal');
  const [ctrl, setCtrl] = useState<LocalController | null>(null);

  useEffect(() => {
    ctrl?.resume();
    return () => ctrl?.dispose();
  }, [ctrl]);

  if (ctrl) return <Table controller={ctrl} onLeave={() => setCtrl(null)} />;

  return (
    <main className="page narrow">
      <nav className="topnav">
        <button className="link" onClick={() => go('/')}>
          ← Inicio
        </button>
        <span>Práctica contra bots</span>
      </nav>
      <section className="panel">
        <p>Juegas en el asiento de abajo; tu compañero y los rivales son bots. No necesita conexión.</p>
        <div className="field">
          <span>Jugadores</span>
          <div className="segmented">
            <button className={players === 4 ? 'on' : ''} onClick={() => setPlayers(4)}>
              4
            </button>
            <button className={players === 6 ? 'on' : ''} onClick={() => setPlayers(6)}>
              6
            </button>
          </div>
        </div>
        <div className="field">
          <span>Nivel de los bots</span>
          <div className="segmented">
            {(
              [
                ['facil', 'Fácil'],
                ['normal', 'Normal'],
                ['dificil', 'Difícil'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                className={level === id ? 'on' : ''}
                onClick={() => {
                  setLevel(id);
                  localStorage.setItem('pablo.botLevel', id);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <span>Pablos para ganar</span>
          <div className="segmented">
            {[1, 2].map((p) => (
              <button key={p} className={pablos === p ? 'on' : ''} onClick={() => setPablos(p)}>
                {p}
              </button>
            ))}
          </div>
        </div>
        <div className="row">
          <button className="primary" onClick={() => setCtrl(new LocalController({ players, pablosToWin: pablos, teamNames: ['Tu equipo', 'Bots rivales'] }, level))}>
            Empezar
          </button>
        </div>
      </section>
    </main>
  );
}

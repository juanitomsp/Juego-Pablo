import { useEffect, useState } from 'react';
import { go } from '../App';
import { Table } from '../components/Table';
import { LocalController } from '../services/controller';
import type { BotLevel } from '../../shared/engine';
import { challengeProgress } from '../services/challenges';
import { Icon } from '../components/Icon';
import { t } from '../i18n';

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
          ← {t('Inicio')}
        </button>
        <span>{t('Práctica contra bots')}</span>
      </nav>
      <section className="panel">
        <p>{t('Juegas en el asiento de abajo; tu compañero y los rivales son bots. No necesita conexión.')}</p>
        <div className="field">
          <span>{t('Jugadores')}</span>
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
          <span>{t('Nivel de los bots')}</span>
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
                {t(label)}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <span>{t('Pablos para ganar')}</span>
          <div className="segmented">
            {[1, 2].map((p) => (
              <button key={p} className={pablos === p ? 'on' : ''} onClick={() => setPablos(p)}>
                {p}
              </button>
            ))}
          </div>
        </div>
        <DailyChallenges />
        <div className="row">
          <button className="primary" onClick={() => setCtrl(new LocalController({ players, pablosToWin: pablos, teamNames: [t('Tu equipo'), t('Bots rivales')] }, level))}>
            {t('Empezar')}
          </button>
        </div>
      </section>
    </main>
  );
}

function DailyChallenges() {
  const { list, streak } = challengeProgress();
  const done = list.filter((c) => c.done).length;
  return (
    <div className="daily">
      <div className="daily-head">
        <strong>
          <Icon name="trophy" size={18} /> {t('Retos de hoy')} ({done}/{list.length})
        </strong>
        {streak > 0 && <span className="streak">🔥 {streak === 1 ? t('1 día seguido') : t('{n} días seguidos').replace('{n}', String(streak))}</span>}
      </div>
      <ul>
        {list.map((c) => (
          <li key={c.id} className={c.done ? 'done' : ''}>
            <span className="tick">{c.done ? '✓' : '○'}</span> {t(c.title)}
          </li>
        ))}
      </ul>
      <p className="muted small">{t('Se comprueban solos mientras juegas. Cada día hay retos nuevos.')}</p>
    </div>
  );
}

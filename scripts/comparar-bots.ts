/**
 * Enfrenta dos niveles de bots en muchas partidas para comprobar cuál juega mejor y cuánto tarda.
 *
 *   npx tsx scripts/comparar-bots.ts [nivelEquipo1] [nivelEquipo2] [partidas]
 *   npx tsx scripts/comparar-bots.ts normal facil 40
 *
 * Los niveles se alternan de asiento en cada partida para que no influya quién es mano.
 */
import { BotLevel, DEFAULT_CONFIG, advance, applyAction, chooseBotAction, createMatch, getView, seededRng } from '../src/shared/engine';

const [a = 'normal', b = 'facil', nArg = '30'] = process.argv.slice(2);
const levelA = a as BotLevel;
const levelB = b as BotLevel;
const N = Number(nArg);

let winsA = 0;
let decisions = 0;
let ms = 0;
const t0 = Date.now();
for (let g = 0; g < N; g++) {
  const rng = seededRng(1000 + g);
  // En las partidas pares, A juega en los asientos pares (equipo 1); en las impares, al revés.
  const teamA = g % 2;
  const levelFor = (seat: number) => (seat % 2 === teamA ? levelA : levelB);
  let m = createMatch({ ...DEFAULT_CONFIG, players: 4, pablosToWin: 1 }, g % 4);
  for (let steps = 0; m.phase !== 'finished' && steps < 20000; steps++) {
    if (m.phase === 'handEnd') {
      m = advance(m);
      continue;
    }
    for (let s = 0; s < 4; s++) {
      const start = performance.now();
      const action = chooseBotAction(getView(m, s), rng, levelFor(s));
      if (action) {
        ms += performance.now() - start;
        decisions++;
        m = applyAction(m, s, action, rng);
        break;
      }
    }
  }
  if (m.winner === teamA) winsA++;
}
console.log(`${levelA} contra ${levelB}: ${levelA} gana ${winsA} de ${N} partidas (${Math.round((winsA / N) * 100)} %)`);
console.log(`Tiempo medio por decisión: ${(ms / decisions).toFixed(1)} ms · total ${((Date.now() - t0) / 1000).toFixed(1)} s`);

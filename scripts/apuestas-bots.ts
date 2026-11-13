/**
 * Mide cómo apuestan los bots: cuántas manos tienen apuesta, cuántas apuestas hay por mano,
 * cuánto acaba valiendo la mano y cuántas apuestas se rechazan.
 *
 *   npx tsx scripts/apuestas-bots.ts [nivel] [partidas]
 *   npx tsx scripts/apuestas-bots.ts dificil 20
 */
import { BotLevel, DEFAULT_CONFIG, advance, applyAction, chooseBotAction, createMatch, getView, seededRng } from '../src/shared/engine';

const [lv = 'dificil', nArg = '20'] = process.argv.slice(2);
const level = lv as BotLevel;
const N = Number(nArg);

let hands = 0;
let handsWithBet = 0;
let bets = 0;
let rejected = 0;
let stakeSum = 0;
const perHand: Record<number, number> = {};
const byTrick: Record<number, number> = {};
for (let g = 0; g < N; g++) {
  const rng = seededRng(500 + g);
  let m = createMatch({ ...DEFAULT_CONFIG, players: 4, pablosToWin: 1 }, g % 4);
  for (let steps = 0; m.phase !== 'finished' && steps < 20000; steps++) {
    if (m.phase === 'handEnd') {
      const h = m.hand!;
      hands++;
      const n = h.bets.length;
      bets += n;
      perHand[n] = (perHand[n] ?? 0) + 1;
      if (n > 0) handsWithBet++;
      for (const b of h.bets) byTrick[b.trickIndex + 1] = (byTrick[b.trickIndex + 1] ?? 0) + 1;
      rejected += h.bets.filter((b) => b.accepted === false).length;
      stakeSum += h.stake;
      m = advance(m);
      continue;
    }
    for (let s = 0; s < 4; s++) {
      const action = chooseBotAction(getView(m, s), rng, level);
      if (action) {
        m = applyAction(m, s, action, rng);
        break;
      }
    }
  }
}
const pct = (a: number, b: number) => `${Math.round((a / Math.max(1, b)) * 100)} %`;
console.log(`Nivel ${level}: ${hands} manos en ${N} partidas`);
console.log(`Manos con alguna apuesta: ${pct(handsWithBet, hands)} · apuestas por mano: ${(bets / hands).toFixed(2)} · rechazadas: ${pct(rejected, bets)}`);
console.log(`Valor medio de la mano: ${(stakeSum / hands).toFixed(2)}`);
console.log(
  'Apuestas por mano: ' +
    Object.keys(perHand)
      .sort((a, b) => Number(a) - Number(b))
      .map((k) => `${k}: ${pct(perHand[Number(k)], hands)}`)
      .join(' · '),
);
console.log('Apuestas según la baza: ' + Object.entries(byTrick).map(([k, n]) => `${k}.ª: ${pct(n, bets)}`).join(' · '));

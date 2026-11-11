import { describe, expect, it } from 'vitest';
import {
  Card,
  DEFAULT_CONFIG,
  GameConfig,
  MatchState,
  advance,
  applyAction,
  buildDeck,
  cardId,
  cartetaPairs,
  chooseBotAction,
  createHand,
  createMatch,
  drawTeamsByKings,
  getView,
  legalCards,
  renuncioCards,
  winningCards,
  seededRng,
  teamOf,
  trickWinnerIndex,
  trumpPower,
} from '../src/shared/engine';
import { censorChat } from '../src/shared/chat';

const c = (rank: number, suit: Card['suit']): Card => ({ rank, suit });
const cfg4: GameConfig = { ...DEFAULT_CONFIG, players: 4 };
const cfg6: GameConfig = { ...DEFAULT_CONFIG, players: 6 };

describe('baraja', () => {
  it('a 4 jugadores tiene 28 cartas (sin 5,6,7,8,9)', () => {
    const d = buildDeck(4);
    expect(d).toHaveLength(28);
    expect(d.some((x) => [5, 6, 7, 8, 9].includes(x.rank))).toBe(false);
  });
  it('a 6 jugadores tiene 40 cartas (sin 8,9)', () => {
    expect(buildDeck(6)).toHaveLength(40);
  });
});

describe('valores', () => {
  it('orden de triunfos: Pablo > Andorra > Tuerto > Malilla > Rey > Caballo > Sota > As > 7 > 6 > 5 > 4', () => {
    const t = 'copas';
    const order = [c(4, 'bastos'), c(3, t), c(11, 'oros'), c(2, t), c(12, t), c(11, t), c(10, t), c(1, t), c(7, t), c(6, t), c(5, t), c(4, t)];
    for (let i = 1; i < order.length; i++) expect(trumpPower(order[i - 1], t)).toBeGreaterThan(trumpPower(order[i], t));
  });
  it('cualquier triunfo gana a cualquier carta de otro palo', () => {
    const w = trickWinnerIndex([{ seat: 0, card: c(12, 'oros') }, { seat: 1, card: c(4, 'copas') }], 'copas');
    expect(w).toBe(1);
  });
  it('sin triunfos gana la mayor del palo de salida; el 3 y el 2 son las más bajas', () => {
    const plays = [{ seat: 0, card: c(2, 'oros') }, { seat: 1, card: c(3, 'oros') }, { seat: 2, card: c(12, 'espadas') }];
    expect(trickWinnerIndex(plays, 'copas')).toBe(1);
  });
  it('el 11 de oros (Tuerto) es siempre triunfo: con muestra de bastos gana al 12 de oros y a casi todos los bastos', () => {
    const t = 'bastos';
    const lead = { seat: 0, card: c(11, 'oros') };
    expect(trickWinnerIndex([lead, { seat: 1, card: c(12, 'oros') }], t)).toBe(0);
    expect(trickWinnerIndex([lead, { seat: 1, card: c(12, 'bastos') }], t)).toBe(0);
    expect(trickWinnerIndex([lead, { seat: 1, card: c(2, 'bastos') }], t)).toBe(0);
    // Solo le ganan el 3 del triunfo (Andorra) y el Pablo.
    expect(trickWinnerIndex([lead, { seat: 1, card: c(3, 'bastos') }], t)).toBe(1);
    expect(trickWinnerIndex([lead, { seat: 1, card: c(4, 'bastos') }], t)).toBe(1);
  });
  it('el Pablo cuenta como triunfo aunque la muestra no sea bastos', () => {
    const plays = [{ seat: 0, card: c(12, 'bastos') }, { seat: 1, card: c(4, 'bastos') }];
    expect(trickWinnerIndex(plays, 'oros')).toBe(1);
  });
});

describe('echar cartas y arrastre', () => {
  it('fuera del arrastre se puede echar cualquier carta', () => {
    const hand = [c(1, 'oros'), c(2, 'copas'), c(12, 'espadas')];
    expect(legalCards(hand, [{ seat: 0, card: c(3, 'oros') }], 'copas')).toHaveLength(3);
    expect(renuncioCards(hand, [{ seat: 0, card: c(3, 'oros') }], 'copas')).toEqual([]);
  });
  it('arrastre: si sale triunfo y tienes triunfo, lo demás es renuncio', () => {
    const hand = [c(2, 'copas'), c(12, 'espadas'), c(1, 'oros')];
    expect(renuncioCards(hand, [{ seat: 0, card: c(3, 'copas') }], 'copas')).toEqual([c(12, 'espadas'), c(1, 'oros')]);
  });
  it('el Pablo se puede guardar en el arrastre', () => {
    const hand = [c(4, 'bastos'), c(12, 'espadas')];
    expect(renuncioCards(hand, [{ seat: 0, card: c(3, 'copas') }], 'copas')).toEqual([]);
  });
  it('el Tuerto sí está obligado en el arrastre', () => {
    const hand = [c(11, 'oros'), c(12, 'espadas')];
    expect(renuncioCards(hand, [{ seat: 0, card: c(3, 'copas') }], 'copas')).toEqual([c(12, 'espadas')]);
  });
  it('salir con el Pablo o el Tuerto también es arrastre', () => {
    const hand = [c(2, 'copas'), c(12, 'espadas')];
    expect(renuncioCards(hand, [{ seat: 0, card: c(4, 'bastos') }], 'copas')).toEqual([c(12, 'espadas')]);
    expect(renuncioCards(hand, [{ seat: 0, card: c(11, 'oros') }], 'copas')).toEqual([c(12, 'espadas')]);
  });
  it('sin triunfos se puede echar cualquier carta en el arrastre', () => {
    expect(renuncioCards([c(12, 'espadas'), c(1, 'oros')], [{ seat: 0, card: c(3, 'copas') }], 'copas')).toEqual([]);
  });
  it('avisa de las cartas que ganan la baza', () => {
    const hand = [c(12, 'oros'), c(2, 'oros'), c(4, 'copas')];
    expect(winningCards(hand, [{ seat: 0, card: c(10, 'oros') }], 'copas')).toEqual([c(12, 'oros'), c(4, 'copas')]);
    expect(winningCards(hand, [], 'copas')).toEqual([]);
  });
  it('hacer renuncio hace perder la mano al equipo', () => {
    let m = applyAction(createMatch(cfg4, 0), 0, { type: 'deal' }, seededRng(11));
    const h = m.hand!;
    // Preparamos una situación de arrastre: el asiento 1 sale con triunfo y el 2 tiene triunfo y otra carta.
    const trump = h.trump;
    const other = (['oros', 'copas', 'espadas', 'bastos'] as const).find((x) => x !== trump && x !== 'oros' && x !== 'bastos')!;
    h.hands[1] = [c(trump === 'bastos' ? 12 : 1, trump)];
    h.hands[2] = [c(trump === 'oros' ? 12 : 2, trump), c(5, other)];
    m = applyAction(m, 1, { type: 'play', card: h.hands[1][0] }, seededRng(1));
    m = applyAction(m, 2, { type: 'play', card: c(5, other) }, seededRng(1));
    expect(m.history[m.history.length - 1].result.reason).toBe('renuncio');
    expect(m.score).toEqual([0, 1]);
  });
});

describe('chat', () => {
  it('tacha las palabras que nombran cartas', () => {
    expect(censorChat('tengo el 3 de basto')).toBe('tengo el **** de *****');
    expect(censorChat('Llevo el PABLO y la Malilla')).toBe('Llevo el ***** y la *******');
    expect(censorChat('¿Vamos? Yo voy bien')).toBe('¿Vamos? Yo voy bien');
    expect(censorChat('tengo bastooo y 2 reyes')).toBe('tengo ******* y **** *****');
    expect(censorChat('tengo el tres de óros')).toBe('tengo el **** de ****');
  });
  it('limpia caracteres peligrosos y limita la longitud', () => {
    expect(censorChat('<script>hola</script>')).toBe('scripthola/script');
    expect(censorChat('a'.repeat(500)).length).toBe(140);
  });
});

describe('reparto', () => {
  it('a 4: 5 cartas cada uno, muestra aparte y 7 dormidas', () => {
    const h = createHand(cfg4, { kind: 'normal', dealer: 0, seats: [1, 2, 3, 0], quieroTeams: [] }, seededRng(1));
    expect(h.hands.every((x) => x.length === 5)).toBe(true);
    expect(h.dormant).toHaveLength(7);
    expect(h.turn).toBe(1);
  });
  it('a 6: el mano tiene la muestra (6 cartas) y retiene las cartas de los últimos', () => {
    const h = createHand(cfg6, { kind: 'normal', dealer: 0, seats: [1, 2, 3, 4, 5, 0], quieroTeams: [] }, seededRng(2));
    expect(h.hands[0]).toHaveLength(6);
    expect(h.received).toEqual([false, true, true, false, false, false]);
  });
});

function playUntilDone(start: MatchState, rng = seededRng(7), maxSteps = 20000): MatchState {
  let m = start;
  let steps = 0;
  while (m.phase !== 'finished' && steps++ < maxSteps) {
    if (m.phase === 'handEnd') {
      m = advance(m, rng);
      continue;
    }
    let acted = false;
    for (let s = 0; s < m.config.players; s++) {
      const a = chooseBotAction(getView(m, s), rng);
      if (a) {
        m = applyAction(m, s, a, rng);
        acted = true;
        break;
      }
    }
    if (!acted) throw new Error(`Nadie puede actuar (fase ${m.phase}, mano ${m.hand?.phase})`);
  }
  return m;
}

describe('partida completa con bots', () => {
  for (const players of [4, 6] as const) {
    for (const seed of [1, 2, 3, 4, 5]) {
      it(`termina sin errores a ${players} jugadores (semilla ${seed})`, () => {
        const m = playUntilDone(createMatch({ ...DEFAULT_CONFIG, players, pablosToWin: 1 }), seededRng(seed));
        expect(m.phase).toBe('finished');
        expect(m.pablos[m.winner!]).toBe(1);
      });
    }
  }
});

describe('apuestas', () => {
  const firstHand = (players: 4 | 6, seed = 3) =>
    applyAction(createMatch({ ...DEFAULT_CONFIG, players }, 0), 0, { type: 'deal' }, seededRng(seed));
  const playAny = (m: MatchState, s: number, rng = seededRng(1)) => {
    const v = getView(m, s).hand!;
    return applyAction(m, s, { type: 'play', card: v.myCards.find((x) => v.legal.includes(cardId(x)))! }, rng);
  };

  it('no se puede apostar antes del postre en la primera baza (a 4)', () => {
    expect(getView(firstHand(4), 1).hand!.canBet).toBe(false);
  });
  it('a 6 ya puede apostar el segundo en echar carta', () => {
    const m = playAny(firstHand(6), 1);
    expect(getView(m, 2).hand!.canBet).toBe(true);
  });
  it('apuesta aceptada vale 2 y rechazada da 1 (lo que valía) al que apostó', () => {
    let m = firstHand(4);
    for (const s of [1, 2, 3]) m = playAny(m, s);
    expect(getView(m, 0).hand!.canBet).toBe(true);
    const rng = seededRng(9);
    m = applyAction(m, 0, { type: 'bet' }, rng);
    expect(m.hand!.pendingBet!.value).toBe(2);
    const accepted = applyAction(m, 1, { type: 'accept' }, rng);
    expect(accepted.hand!.stake).toBe(2);
    expect(accepted.hand!.turn).toBe(0);
    const rejected = applyAction(m, 3, { type: 'reject' }, rng);
    expect(rejected.score).toEqual([1, 0]);
    expect(() => applyAction(m, 2, { type: 'accept' }, rng)).toThrow();
  });
  it('cada subida añade 1, y si no la quieren se cobra lo ya aceptado', () => {
    let m = firstHand(4);
    for (const s of [1, 2, 3]) m = playAny(m, s);
    m = applyAction(m, 0, { type: 'bet' }, seededRng(1));
    m = applyAction(m, 1, { type: 'accept' }, seededRng(1));
    m = playAny(m, 0);
    const leader = m.hand!.turn;
    m = applyAction(m, leader, { type: 'bet' }, seededRng(1));
    expect(m.hand!.pendingBet!.value).toBe(3);
    const rival = [1, 3].includes(leader) ? 0 : 1;
    expect(applyAction(m, rival, { type: 'reject' }, seededRng(1)).score[leader % 2]).toBe(2);
  });
  it('irse da al rival el valor actual de la mano', () => {
    const m = applyAction(firstHand(4), 1, { type: 'fold' }, seededRng(1));
    expect(m.score).toEqual([1, 0]);
    expect(m.phase).toBe('handEnd');
  });
});

describe('quiero', () => {
  it('con un equipo al quiero, ese equipo decide si juega; si se va, el rival gana 1', () => {
    let m = createMatch(cfg4, 0);
    m.score = [7, 0];
    m = applyAction(m, 0, { type: 'deal' }, seededRng(4));
    expect(m.hand!.phase).toBe('quiero');
    const v = getView(m, 0);
    expect(v.hand!.canDecideQuiero).toBe(true);
    expect(v.hand!.partnerTrumps.map((p) => p.seat)).toEqual([2]);
    expect(getView(m, 1).hand!.partnerTrumps).toEqual([]);
    m = applyAction(m, 2, { type: 'quiero', play: false }, seededRng(4));
    expect(m.score).toEqual([7, 1]);
  });
  it('quiero forzoso: sin apuestas ni irse', () => {
    let m = createMatch(cfg4, 0);
    m.score = [7, 7];
    m = applyAction(m, 0, { type: 'deal' }, seededRng(4));
    expect(m.hand!.forced).toBe(true);
    expect(getView(m, 1).hand!.canFold).toBe(false);
  });
  it('ganar la mano al quiero da el cuerno y reinicia los puntos', () => {
    let m = createMatch(cfg4, 0);
    m.score = [7, 5];
    m = applyAction(m, 0, { type: 'deal' }, seededRng(4));
    m = applyAction(m, 0, { type: 'quiero', play: true }, seededRng(4));
    m = applyAction(m, 1, { type: 'fold' }, seededRng(4));
    expect(m.cuernos).toEqual([1, 0]);
    expect(m.score).toEqual([0, 0]);
  });
  it('dos cuernos hacen un Pablo', () => {
    let m = createMatch(cfg4, 0);
    m.score = [7, 5];
    m.cuernos = [1, 0];
    m = applyAction(m, 0, { type: 'deal' }, seededRng(4));
    m = applyAction(m, 0, { type: 'quiero', play: true }, seededRng(4));
    m = applyAction(m, 1, { type: 'fold' }, seededRng(4));
    expect(m.pablos).toEqual([1, 0]);
    expect(m.cuernos).toEqual([0, 0]);
  });
});

describe('carteta', () => {
  it('parejas a 4 y a 6', () => {
    expect(cartetaPairs(4, 0)).toEqual([[1, 2], [3, 0]]);
    expect(cartetaPairs(6, 0)).toEqual([[1, 2], [3, 4], [5, 0]]);
  });
  it('se juega una vez por cuerno y en cada mano solo participan dos jugadores', () => {
    let m = createMatch(cfg4, 0);
    const rng = seededRng(5);
    m = applyAction(m, 0, { type: 'deal', carteta: true }, rng);
    expect(m.hand!.seats).toEqual([1, 2]);
    expect(teamOf(1)).not.toBe(teamOf(2));
    m = applyAction(m, 1, { type: 'fold' }, rng);
    m = advance(m, rng);
    expect(m.hand!.seats).toEqual([3, 0]);
    m = applyAction(m, 3, { type: 'fold' }, rng);
    m = advance(m, rng);
    expect(m.phase).toBe('deal');
    expect(m.dealer).toBe(1);
    expect(getView(m, 1).canDealCarteta).toBe(false);
  });
  it('el equipo que no es mano puede pedirla; el del mano no', () => {
    const m = applyAction(createMatch(cfg4, 0), 1, { type: 'requestCarteta' }, seededRng(1));
    expect(m.cartetaRequest).toBe(1);
    expect(() => applyAction(createMatch(cfg4, 0), 2, { type: 'requestCarteta' }, seededRng(1))).toThrow();
  });
});

describe('vista', () => {
  it('no muestra las cartas de los demás', () => {
    const m = applyAction(createMatch(cfg4, 0), 0, { type: 'deal' }, seededRng(1));
    const v = getView(m, 1);
    expect(v.hand!.myCards).toHaveLength(5);
    expect(JSON.stringify(v)).not.toContain('"hands"');
    expect(JSON.stringify(v)).not.toContain('"dormant"');
  });
});

describe('sorteo por reyes', () => {
  it('asigna asientos distintos y el primer rey es el asiento 0', () => {
    for (const n of [4, 6]) {
      const d = drawTeamsByKings(n, seededRng(n));
      expect(new Set(d.seatFor).size).toBe(n);
      expect(d.seatFor[d.kingOrder[0]]).toBe(0);
    }
  });
});

describe('GameTable', () => {
  it('los bots no responden apuestas por un compañero humano', async () => {
    const { GameTable } = await import('../src/shared/table');
    const t = new GameTable({ ...DEFAULT_CONFIG, players: 4 }, 0, [1, 2, 3], { onChange: () => {} }, seededRng(1), { bot: 1, afterTrick: 1, handEnd: 1 });
    // Forzamos una apuesta pendiente del equipo 1 contra el equipo del humano (asiento 0).
    t.act(0, { type: 'deal' });
    const h = t.match.hand!;
    h.phase = 'bet';
    h.pendingBet = { seat: 1, team: 1, value: 6 };
    h.bets.push({ seat: 1, value: 6, accepted: null });
    (t as unknown as { schedule: () => void }).schedule();
    await new Promise((r) => setTimeout(r, 30));
    expect(t.match.hand!.phase).toBe('bet');
    t.dispose();
  });
});

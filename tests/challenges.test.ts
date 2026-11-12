import { beforeEach, describe, expect, it } from 'vitest';
import { CHALLENGES, ChallengeTracker, challengeProgress, todaysChallenges } from '../src/client/services/challenges';
import type { MatchState } from '../src/shared/engine';

// localStorage mínimo para Node.
const store = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: () => null,
  length: 0,
};

describe('retos diarios', () => {
  beforeEach(() => store.clear());

  it('cada día hay 3 retos: uno de baza, uno de mano y uno de partida, iguales para todos ese día', () => {
    const d = new Date(2026, 10, 12);
    const a = todaysChallenges(d);
    expect(a).toHaveLength(3);
    expect(a[0].trick && a[1].hand && a[2].match).toBeTruthy();
    expect(todaysChallenges(new Date(2026, 10, 12, 20))).toEqual(a);
    // A lo largo de un mes salen retos distintos.
    const ids = new Set<string>();
    for (let i = 1; i <= 30; i++) todaysChallenges(new Date(2026, 10, i)).forEach((c) => ids.add(c.id));
    expect(ids.size).toBeGreaterThan(6);
    expect(new Set(CHALLENGES.map((c) => c.id)).size).toBe(CHALLENGES.length);
  });

  it('marca el reto de partida al ganar y suma racha', () => {
    const done: string[] = [];
    const tracker = new ChallengeTracker('dificil', (c) => done.push(c.id));
    const won = { hand: null, handNumber: 3, history: [], phase: 'finished', winner: 0, cuernos: [2, 0] } as unknown as MatchState;
    tracker.update(won);
    tracker.update(won); // no cuenta dos veces
    const matchChallenge = todaysChallenges()[2];
    expect(done).toEqual([matchChallenge.id]);
    const p = challengeProgress();
    expect(p.list.find((c) => c.id === matchChallenge.id)?.done).toBe(true);
    expect(p.streak).toBe(1);
  });

  it('no marca nada si ganan los bots', () => {
    const done: string[] = [];
    const tracker = new ChallengeTracker('dificil', (c) => done.push(c.id));
    tracker.update({ hand: null, handNumber: 3, history: [], phase: 'finished', winner: 1, cuernos: [0, 2] } as unknown as MatchState);
    expect(done).toEqual([]);
  });
});

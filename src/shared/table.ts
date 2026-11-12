/**
 * GameTable: una partida en marcha con bots y temporizadores.
 * Se usa igual en el servidor (partidas online) y en el navegador (práctica contra bots).
 */
import {
  Action,
  GameConfig,
  MatchState,
  Rng,
  BotLevel,
  advance,
  applyAction,
  chooseBotAction,
  createMatch,
  getView,
  teamOf,
} from './engine';

export interface TableCallbacks {
  onChange: () => void;
}

export interface TableDelays {
  bot: number;
  afterTrick: number;
  handEnd: number;
}

export const DEFAULT_DELAYS: TableDelays = { bot: 850, afterTrick: 1700, handEnd: 3200 };

export class GameTable {
  match: MatchState;
  private bots = new Set<number>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;

  constructor(
    config: GameConfig,
    dealer: number,
    botSeats: number[],
    private cb: TableCallbacks,
    private rng: Rng = Math.random,
    private delays: TableDelays = DEFAULT_DELAYS,
    /** Nivel de los bots de esta mesa. */
    private botLevel: BotLevel = 'normal',
  ) {
    this.match = createMatch(config, dealer);
    botSeats.forEach((s) => this.bots.add(s));
    this.schedule();
  }

  isBot(seat: number) {
    return this.bots.has(seat);
  }

  setBot(seat: number, bot: boolean) {
    if (bot) this.bots.add(seat);
    else this.bots.delete(seat);
    this.schedule();
  }

  /** Aplica la acción de un jugador. Lanza RuleError si no es válida. */
  act(seat: number, action: Action) {
    this.match = applyAction(this.match, seat, action, this.rng);
    this.changed();
  }

  dispose() {
    this.disposed = true;
    if (this.timer) clearTimeout(this.timer);
  }

  /** Reanuda una mesa pausada con dispose() (útil con el doble montaje de React StrictMode). */
  resume() {
    if (!this.disposed) return;
    this.disposed = false;
    this.schedule();
  }

  private changed() {
    this.cb.onChange();
    this.schedule();
  }

  private schedule() {
    if (this.disposed) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const m = this.match;

    if (m.phase === 'handEnd') {
      this.timer = setTimeout(() => {
        this.match = advance(this.match, this.rng);
        this.changed();
      }, this.delays.handEnd);
      return;
    }
    if (m.phase === 'finished') return;

    for (const seat of this.bots) {
      const action = chooseBotAction(getView(m, seat), this.rng, this.botLevel);
      if (!action) continue;
      // Las decisiones de equipo (aceptar/rechazar apuesta, jugar al quiero) las toma el humano si lo hay.
      const teamDecision = action.type === 'accept' || action.type === 'reject' || action.type === 'quiero';
      if (teamDecision && m.hand?.seats.some((s) => s !== seat && teamOf(s) === teamOf(seat) && !this.bots.has(s))) continue;
      const justFinishedTrick = !!m.hand && m.hand.trick.length === 0 && m.hand.tricks.length > 0 && action.type === 'play';
      this.timer = setTimeout(
        () => {
          try {
            this.act(seat, action);
          } catch {
            // El estado cambió mientras esperaba (p. ej. un humano actuó antes): se reprograma.
            this.schedule();
          }
        },
        justFinishedTrick ? this.delays.afterTrick : this.delays.bot,
      );
      return;
    }
  }
}

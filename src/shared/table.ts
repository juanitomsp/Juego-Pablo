/**
 * GameTable: una partida en marcha con bots y temporizadores.
 * Se usa igual en el servidor (partidas online) y en el navegador (práctica contra bots).
 */
import {
  Action,
  GameConfig,
  MatchState,
  Rng,
  SenaId,
  advance,
  applyAction,
  botSena,
  chooseBotAction,
  createMatch,
  getView,
  teamOf,
} from './engine';

export interface TableCallbacks {
  onChange: () => void;
  onSena?: (from: number, sena: SenaId) => void;
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
  private senaSent = new Set<string>();
  private disposed = false;

  constructor(
    config: GameConfig,
    dealer: number,
    botSeats: number[],
    private cb: TableCallbacks,
    private rng: Rng = Math.random,
    private delays: TableDelays = DEFAULT_DELAYS,
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
    this.botSenas();
    this.cb.onChange();
    this.schedule();
  }

  /** Los bots hacen una seña a su equipo con su mejor triunfo al recibir las cartas. */
  private botSenas() {
    const h = this.match.hand;
    if (!h || !this.match.config.senas || !this.cb.onSena || h.phase === 'done') return;
    for (const s of h.seats) {
      const key = `${this.match.handNumber}:${s}`;
      if (!this.bots.has(s) || !h.received[s] || this.senaSent.has(key)) continue;
      const partners = h.seats.filter((p) => p !== s && teamOf(p) === teamOf(s));
      if (partners.length === 0) continue;
      this.senaSent.add(key);
      this.cb.onSena(s, botSena(h.hands[s], h.trump));
    }
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
      const action = chooseBotAction(getView(m, seat), this.rng);
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

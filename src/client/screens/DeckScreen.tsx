import { useState } from 'react';
import { SUITS, Suit, buildDeck, cardId } from '../../shared/engine';
import { go } from '../App';
import { CardView } from '../components/CardView';
import { DECK_STYLES, setDeckStyle, useDeckStyle } from '../services/deckStyle';

/** Muestra la baraja completa (útil para aprender las cartas y revisar los dibujos). */
export function DeckScreen() {
  const [players, setPlayers] = useState<4 | 6>(6);
  const [trump, setTrump] = useState<Suit>('copas');
  const deck = buildDeck(players);
  const style = useDeckStyle();
  return (
    <main className="page">
      <nav className="topnav">
        <button className="link" onClick={() => go('/')}>
          ← Inicio
        </button>
        <span>La baraja</span>
      </nav>
      <section className="panel">
        <div className="row">
          <div className="segmented" aria-label="Estilo de baraja">
            {DECK_STYLES.map((d) => (
              <button key={d.id} className={style === d.id ? 'on' : ''} onClick={() => setDeckStyle(d.id)}>
                {d.label}
              </button>
            ))}
          </div>
        </div>
        <div className="row">
          <div className="segmented">
            {([4, 6] as const).map((n) => (
              <button key={n} className={players === n ? 'on' : ''} onClick={() => setPlayers(n)}>
                {n} jugadores ({buildDeck(n).length} cartas)
              </button>
            ))}
          </div>
          <div className="segmented">
            {SUITS.map((s) => (
              <button key={s} className={trump === s ? 'on' : ''} onClick={() => setTrump(s)}>
                Muestra: {s}
              </button>
            ))}
          </div>
        </div>
      </section>
      <section className="deck-row">
        <CardView faceDown />
      </section>
      {SUITS.map((s) => (
        <section key={s} className="deck-row">
          {deck
            .filter((c) => c.suit === s)
            .map((c) => (
              <CardView key={cardId(c)} card={c} trump={trump} hints />
            ))}
        </section>
      ))}
    </main>
  );
}

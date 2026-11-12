/**
 * Tutorial opcional (#/tutorial): lecciones cortas con ejercicios. Las respuestas las comprueba el propio
 * motor del juego (trickWinnerIndex, renuncioCards…), así que no pueden contradecir las reglas.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { Card, Suit, cardId, isTrump, renuncioCards, trickWinnerIndex, trumpPower } from '../../shared/engine';
import { cardLabel, isEn, suitName, t } from '../i18n';
import { go } from '../App';
import { CardView, SuitIcon } from '../components/CardView';

const DONE_KEY = 'pablo.tutorialDone';
export const tutorialDone = () => localStorage.getItem(DONE_KEY) === '1';

const c = (rank: number, suit: Suit): Card => ({ rank, suit });

interface Quiz {
  /** Cartas para elegir. */
  options: Card[];
  /** ¿Es correcta esta carta? */
  isRight: (card: Card) => boolean;
  /** Explicación tras responder. */
  explain: (card: Card, right: boolean) => string;
  /** Escena que se muestra encima (baza en la mesa, muestra…). */
  scene?: ReactNode;
}

interface Lesson {
  title: string;
  body: ReactNode;
  trump?: Suit;
  quiz?: Quiz;
}

/** Texto en el idioma actual: español o inglés. */
const L = <T,>(es: T, en: T): T => (isEn() ? en : es);

const Muestra = ({ card, trump }: { card: Card; trump: Suit }) => (
  <div className="tut-muestra">
    <CardView card={card} small trump={trump} />
    <span>
      {L('Muestra: manda', 'Turn-up card: trumps are')} <SuitIcon suit={trump} size={16} /> <strong>{suitName(trump)}</strong>
    </span>
  </div>
);

const Trick = ({ plays, trump, label }: { plays: Card[]; trump: Suit; label: string }) => (
  <div className="tut-trick">
    <span className="lbl">{label}</span>
    <div className="row tight">
      {plays.map((card, i) => (
        <div key={cardId(card)} className="tut-play">
          <CardView card={card} small trump={trump} hints />
          <small>{i === 0 ? L('sale', 'leads') : L(`${i + 1}.º`, `#${i + 1}`)}</small>
        </div>
      ))}
    </div>
  </div>
);

function buildLessons(): Lesson[] {
  const t1: Suit = 'copas';
  const trickA = [c(12, 'oros'), c(1, 'oros')];
  const t2: Suit = 'espadas';
  const arrastreLead = c(10, 'espadas');
  const myHandArrastre = [c(12, 'bastos'), c(2, 'espadas'), c(1, 'oros')];
  return [
    {
      title: L('¡Bienvenido al Pablo!', 'Welcome to El Pablo!'),
      body: L(
        <>
          <p>
            Se juega por parejas: <strong>2 contra 2</strong> (o 3 contra 3). Cada jugador tiene <strong>5 cartas</strong> y gana la mano el
            equipo que se lleve <strong>3 bazas</strong>.
          </p>
          <p>En unos minutos aprenderás lo esencial con ejemplos. Puedes saltarte el tutorial cuando quieras.</p>
        </>,
        <>
          <p>
            It is played in teams: <strong>2 vs 2</strong> (or 3 vs 3). Each player gets <strong>5 cards</strong> and the team that takes{' '}
            <strong>3 tricks</strong> wins the hand.
          </p>
          <p>In a few minutes you will learn the essentials with examples. You can skip the tutorial at any time.</p>
        </>,
      ),
    },
    {
      title: L('La muestra manda', 'The turn-up card sets trumps'),
      trump: t1,
      body: (
        <>
          <Muestra card={c(5, t1)} trump={t1} />
          {L(
            <>
              <p>
                Al repartir se descubre una carta: la <strong>muestra</strong>. Su palo es el <strong>triunfo</strong>: cualquier triunfo gana a
                cualquier carta de otro palo.
              </p>
              <p>
                Además hay dos cartas que son <strong>triunfo siempre</strong>, salga la muestra que salga: el <strong>Pablo</strong> (4 de bastos)
                y el <strong>Tuerto</strong> (11 de oros).
              </p>
            </>,
            <>
              <p>
                After dealing, one card is turned face up: the <strong>muestra</strong>. Its suit is <strong>trumps</strong>: any trump beats any
                card of another suit.
              </p>
              <p>
                Two cards are <strong>always trumps</strong>, whatever the turn-up card: the <strong>Pablo</strong> (4 of clubs) and the{' '}
                <strong>Tuerto</strong> (Knight of coins).
              </p>
            </>,
          )}
        </>
      ),
      quiz: {
        scene: <Muestra card={c(5, t1)} trump={t1} />,
        options: [c(12, 'oros'), c(4, 'bastos'), c(12, 'espadas'), c(10, 'oros')],
        isRight: (card) => isTrump(card, t1),
        explain: (card, right) =>
          right
            ? L(`¡Bien! El ${cardLabel(card)} es el Pablo: triunfo siempre.`, `Well done! The ${cardLabel(card)} is the Pablo: always a trump.`)
            : L(
                `El ${cardLabel(card)} no es triunfo: la muestra es de copas, y solo el Pablo y el Tuerto son triunfo siempre.`,
                `The ${cardLabel(card)} is not a trump: trumps are cups, and only the Pablo and the Tuerto are always trumps.`,
              ),
      },
    },
    {
      title: L('El orden de los triunfos', 'The order of trumps'),
      trump: t1,
      body: L(
        <>
          <p>De mayor a menor, los triunfos son:</p>
          <ol className="tut-order">
            <li>
              <strong>Pablo</strong> (4 de bastos)
            </li>
            <li>
              <strong>Andorra</strong> (el 3 del triunfo)
            </li>
            <li>
              <strong>Tuerto</strong> (11 de oros)
            </li>
            <li>
              <strong>Malilla</strong> (el 2 del triunfo)
            </li>
            <li>Rey, Caballo, Sota, As… y después 7, 6, 5 y 4 del triunfo.</li>
          </ol>
          <p className="muted small">Fuera del triunfo es al revés con el 3 y el 2: son las cartas más bajas.</p>
        </>,
        <>
          <p>From highest to lowest, the trumps are:</p>
          <ol className="tut-order">
            <li>
              <strong>Pablo</strong> (4 of clubs)
            </li>
            <li>
              <strong>Andorra</strong> (the 3 of trumps)
            </li>
            <li>
              <strong>Tuerto</strong> (Knight of coins)
            </li>
            <li>
              <strong>Malilla</strong> (the 2 of trumps)
            </li>
            <li>King, Knight, Jack, Ace… then 7, 6, 5 and 4 of trumps.</li>
          </ol>
          <p className="muted small">Outside trumps the 3 and the 2 are the other way round: they are the lowest cards.</p>
        </>,
      ),
      quiz: {
        scene: (
          <>
            <Muestra card={c(5, t1)} trump={t1} />
            <p>{L('¿Cuál de estas cartas es la más fuerte?', 'Which of these cards is the strongest?')}</p>
          </>
        ),
        options: [c(12, t1), c(2, t1), c(11, 'oros'), c(3, t1)],
        isRight: (card) => trumpPower(card, t1) === Math.max(...[c(12, t1), c(2, t1), c(11, 'oros'), c(3, t1)].map((x) => trumpPower(x, t1))),
        explain: (_card, right) =>
          right
            ? L('¡Exacto! La Andorra (3 del triunfo) solo pierde contra el Pablo.', 'Exactly! The Andorra (3 of trumps) only loses to the Pablo.')
            : L(
                'No: la más fuerte es la Andorra, el 3 del triunfo. Solo la supera el Pablo.',
                'No: the strongest is the Andorra, the 3 of trumps. Only the Pablo beats it.',
              ),
      },
    },
    {
      title: L('¿Quién gana la baza?', 'Who wins the trick?'),
      trump: t1,
      body: L(
        <>
          <p>
            Gana la baza el <strong>triunfo más alto</strong>. Si nadie echa triunfo, gana la carta más alta <strong>del palo con el que se
            salió</strong>.
          </p>
          <p>Puedes echar la carta que quieras: no es obligatorio seguir el palo (salvo en el arrastre, que verás ahora).</p>
        </>,
        <>
          <p>
            The <strong>highest trump</strong> wins the trick. If nobody plays a trump, the highest card <strong>of the suit that was led</strong>{' '}
            wins.
          </p>
          <p>You can play any card you like: you do not have to follow suit (except in an arrastre, coming up next).</p>
        </>,
      ),
      quiz: {
        scene: (
          <>
            <Muestra card={c(5, t1)} trump={t1} />
            <Trick plays={trickA} trump={t1} label={L('En la mesa:', 'On the table:')} />
            <p>{L('Te toca. ¿Con qué carta ganas la baza?', 'Your turn. Which card wins the trick?')}</p>
          </>
        ),
        options: [c(2, 'oros'), c(7, 'espadas'), c(4, t1), c(3, 'oros')],
        isRight: (card) => trickWinnerIndex([...trickA, card].map((x, i) => ({ seat: i, card: x })), t1) === 2,
        explain: (card, right) =>
          right
            ? L(
                `¡Sí! Con el ${cardLabel(card)}: aunque sea bajo, es triunfo y gana al Rey de oros.`,
                `Yes! The ${cardLabel(card)}: it is low, but it is a trump and beats the King of coins.`,
              )
            : L(
                `El ${cardLabel(card)} no gana: el Rey de oros es más alto (y el 3 y el 2 son las más bajas fuera del triunfo). Un triunfo, aunque sea pequeño, sí gana.`,
                `The ${cardLabel(card)} does not win: the King of coins is higher (and outside trumps the 3 and 2 are the lowest). Any trump, even a small one, would win.`,
              ),
      },
    },
    {
      title: L('El arrastre', 'The arrastre (trump lead)'),
      trump: t2,
      body: L(
        <>
          <p>
            Si el primero sale con un <strong>triunfo</strong>, es un <strong>arrastre</strong>: todos tienen que echar triunfo si lo tienen, sea
            mayor o menor.
          </p>
          <p>
            El <strong>Pablo</strong> es el único que te puedes guardar. Si tienes triunfo y echas otra cosa, es <strong>renuncio</strong> y tu
            equipo pierde la mano.
          </p>
        </>,
        <>
          <p>
            If the first player leads a <strong>trump</strong>, it is an <strong>arrastre</strong>: everyone must play a trump if they have one,
            higher or lower.
          </p>
          <p>
            The <strong>Pablo</strong> is the only one you may keep. If you have a trump and play something else, it is a{' '}
            <strong>renuncio</strong> (revoke) and your team loses the hand.
          </p>
        </>,
      ),
      quiz: {
        scene: (
          <>
            <Muestra card={c(6, t2)} trump={t2} />
            <Trick plays={[arrastreLead]} trump={t2} label={L('Han salido con:', 'Lead card:')} />
            <p>{L('Estas son tus cartas. ¿Cuál puedes echar sin hacer renuncio?', 'These are your cards. Which one can you play without a revoke?')}</p>
          </>
        ),
        options: myHandArrastre,
        isRight: (card) =>
          !renuncioCards(myHandArrastre, [{ seat: 0, card: arrastreLead }], t2).some((x) => x.suit === card.suit && x.rank === card.rank),
        explain: (card, right) =>
          right
            ? L(
                `¡Bien! Hay arrastre y tienes triunfo: tienes que echar el ${cardLabel(card)}.`,
                `Well done! It is an arrastre and you have a trump: you must play the ${cardLabel(card)}.`,
              )
            : L(
                'Eso sería renuncio: hay arrastre (salieron con triunfo) y tienes el 2 de espadas, que es triunfo. Tienes que echarlo.',
                'That would be a revoke: a trump was led and you have the 2 of swords, which is a trump. You must play it.',
              ),
      },
    },
    {
      title: L('Apostar', 'Betting'),
      body: L(
        <>
          <p>
            Una mano vale <strong>1 punto</strong>. En tu turno, antes de echar carta, puedes <strong>apostar</strong>: si el otro equipo acepta
            («quiero»), la mano vale 1 más; si no la quiere, ganáis lo que valía hasta ese momento.
          </p>
          <p>
            Solo se puede apostar una vez por turno, pero cuando te vuelva a tocar puedes subir otra vez. Usa el <strong>chat</strong> para decidir
            con tu compañero (las cartas salen tachadas: ¡no se puede cantar lo que llevas!).
          </p>
        </>,
        <>
          <p>
            A hand is worth <strong>1 point</strong>. On your turn, before playing a card, you can <strong>bet</strong>: if the other team accepts
            («quiero»), the hand is worth 1 more; if they refuse, your team wins what it was worth until then.
          </p>
          <p>
            You can bet once per turn, and raise again when it is your turn again. Use the <strong>chat</strong> to agree with your partner (card
            names are blanked out: you cannot tell what you hold!).
          </p>
        </>,
      ),
    },
    {
      title: L('Cuernos y Pablos', 'Cuernos and Pablos'),
      body: L(
        <>
          <p>
            El primer equipo que llega a <strong>8 puntos</strong> gana un <strong>cuerno</strong>. Quien gana <strong>dos cuernos</strong> gana la
            partida.
          </p>
          <p>
            Cuando a un equipo le basta una mano para ganar el cuerno, está <strong>al quiero</strong>: ve los triunfos de su compañero y decide si
            juega o se va (y entonces el rival gana 1 punto).
          </p>
          <p>
            Y un truco: si tu equipo lleva 2 bazas y echas una carta que ya nadie puede superar, <strong>ganáis la mano al momento</strong>.
          </p>
        </>,
        <>
          <p>
            The first team to reach <strong>8 points</strong> wins a <strong>cuerno</strong>. The team that wins <strong>two cuernos</strong> wins
            the game.
          </p>
          <p>
            When one more hand is enough for a team to win the cuerno, that team is <strong>al quiero</strong>: they see their partner&apos;s trumps
            and decide whether to play or fold (then the other team gets 1 point).
          </p>
          <p>
            One more trick: if your team has 2 tricks and you play a card nobody can beat any more, <strong>you win the hand right away</strong>.
          </p>
        </>,
      ),
    },
    {
      title: L('¡Listo para jugar!', 'Ready to play!'),
      body: L(
        <>
          <p>Ya sabes lo esencial. Lo mejor para aprender es jugar: empieza contra bots en nivel fácil.</p>
          <p className="muted small">
            Durante la partida, el juego te avisa de qué cartas ganan la baza (✓), de cuándo tu compañero ya la lleva y de los arrastres. Las
            reglas completas están en «Reglas».
          </p>
        </>,
        <>
          <p>You know the essentials. The best way to learn is to play: start against bots on easy level.</p>
          <p className="muted small">
            During the game you will be told which cards win the trick (✓), when your partner is already winning it and when there is an arrastre.
            The full rules are in «Rules».
          </p>
        </>,
      ),
    },
  ];
}

export function TutorialScreen() {
  const lessons = useMemo(buildLessons, []);
  const [i, setI] = useState(0);
  const [answer, setAnswer] = useState<{ card: Card; right: boolean } | null>(null);
  const lesson = lessons[i];
  const last = i === lessons.length - 1;
  const canNext = !lesson.quiz || answer?.right;

  const finish = (to: string) => {
    localStorage.setItem(DONE_KEY, '1');
    if (to === '/practica') localStorage.setItem('pablo.botLevel', 'facil');
    go(to);
  };
  const move = (d: number) => {
    setAnswer(null);
    setI((x) => Math.max(0, Math.min(lessons.length - 1, x + d)));
  };

  return (
    <main className="page narrow tutorial">
      <nav className="topnav">
        <button className="link" onClick={() => finish('/')}>
          ← {t('Salir')}
        </button>
        <span>{t('Aprender a jugar')}</span>
        <span className="muted-light small">
          {i + 1} / {lessons.length}
        </span>
      </nav>
      <div className="tut-progress" aria-hidden="true">
        <div style={{ width: `${((i + 1) / lessons.length) * 100}%` }} />
      </div>

      <section className="panel tut-card" key={i}>
        <h2>{lesson.title}</h2>
        {lesson.body}

        {lesson.quiz && (
          <div className="tut-quiz">
            {lesson.quiz.scene}
            <div className="tut-options">
              {lesson.quiz.options.map((card) => {
                const chosen = answer && answer.card === card;
                return (
                  <div key={cardId(card)} className={`tut-option ${chosen ? (answer.right ? 'ok' : 'ko') : ''}`}>
                    <CardView
                      card={card}
                      trump={lesson.trump}
                      hints
                      playable={!answer?.right}
                      onClick={answer?.right ? undefined : () => setAnswer({ card, right: lesson.quiz!.isRight(card) })}
                    />
                  </div>
                );
              })}
            </div>
            {answer && (
              <p className={`tut-feedback ${answer.right ? 'ok' : 'ko'}`} role="status">
                {answer.right ? '✅ ' : '❌ '}
                {lesson.quiz.explain(answer.card, answer.right)}
                {!answer.right && ` ${t('Prueba otra vez.')}`}
              </p>
            )}
          </div>
        )}

        <div className="row tut-nav">
          {i > 0 && <button onClick={() => move(-1)}>{t('Atrás')}</button>}
          {!last && (
            <button className="primary" disabled={!canNext} onClick={() => move(1)}>
              {lesson.quiz && !answer?.right ? t('Elige una carta') : t('Siguiente')}
            </button>
          )}
          {last && (
            <>
              <button className="primary" onClick={() => finish('/practica')}>
                {t('Jugar contra bots')}
              </button>
              <button onClick={() => finish('/')}>{t('Volver al inicio')}</button>
            </>
          )}
        </div>
      </section>
    </main>
  );
}

/**
 * Cartas de la baraja española dibujadas en SVG propio, al estilo tradicional:
 * palos repetidos según el número, número en las esquinas, "pintas" en el marco
 * (oros sin cortes, copas 1, espadas 2, bastos 3) y figuras (sota, caballo, rey) simplificadas.
 *
 * No reproduce ninguna baraja comercial. Si tienes imágenes con licencia, define
 * VITE_CARD_IMAGES=/cartas y coloca los ficheros en public/cartas/{rank}-{palo}.png
 * (p. ej. 4-bastos.png, 11-oros.png) y un reverso.png. Ver docs/CARTAS.md.
 */
import { Card, Suit, cardName, trumpRole } from '../../shared/engine';

const IMAGE_BASE = (import.meta.env.VITE_CARD_IMAGES as string | undefined)?.replace(/\/$/, '');

export const SUIT_COLOR: Record<Suit, string> = {
  oros: '#c58f00',
  copas: '#c0392b',
  espadas: '#1f5fa8',
  bastos: '#2e7d32',
};

const PINTAS: Record<Suit, number> = { oros: 0, copas: 1, espadas: 2, bastos: 3 };

/** Dibujo de un palo dentro de una caja de 24×24 (se usa como <g>). */
function SuitShape({ suit }: { suit: Suit }) {
  switch (suit) {
    case 'oros':
      return (
        <g>
          <circle cx="12" cy="12" r="10" fill="#f2c230" stroke="#9a6b00" strokeWidth="1.4" />
          <circle cx="12" cy="12" r="6.3" fill="#e6a700" stroke="#9a6b00" strokeWidth="0.8" />
          <circle cx="12" cy="12" r="2.4" fill="#fff1b8" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
            <circle key={a} cx={12 + 8.2 * Math.cos((a * Math.PI) / 180)} cy={12 + 8.2 * Math.sin((a * Math.PI) / 180)} r="0.8" fill="#9a6b00" />
          ))}
        </g>
      );
    case 'copas':
      return (
        <g>
          <path d="M4.5 3h15c0 5.2-3 8.4-7.5 8.4S4.5 8.2 4.5 3z" fill="#c62828" stroke="#7f1414" strokeWidth="0.8" />
          <rect x="5.2" y="4.4" width="13.6" height="1.6" fill="#f2c230" />
          <rect x="11" y="11.2" width="2" height="5.5" fill="#f2c230" stroke="#9a6b00" strokeWidth="0.5" />
          <path d="M6.5 21.5c0-2.8 2.4-4.8 5.5-4.8s5.5 2 5.5 4.8z" fill="#c62828" stroke="#7f1414" strokeWidth="0.8" />
        </g>
      );
    case 'espadas':
      return (
        <g>
          <path d="M12 1l2 2.6v12.2h-4V3.6z" fill="#3d7fd1" stroke="#163f74" strokeWidth="0.7" />
          <line x1="12" y1="3.5" x2="12" y2="15" stroke="#cfe2fb" strokeWidth="0.7" />
          <path d="M5.5 15.4h13a1.2 1.2 0 0 1 0 2.4h-13a1.2 1.2 0 0 1 0-2.4z" fill="#f2c230" stroke="#9a6b00" strokeWidth="0.6" />
          <rect x="10.8" y="17.6" width="2.4" height="3.6" fill="#c62828" />
          <circle cx="12" cy="22" r="1.5" fill="#f2c230" stroke="#9a6b00" strokeWidth="0.5" />
        </g>
      );
    case 'bastos':
      return (
        <g>
          <path d="M9.6 2.3c3.6-1.6 6.3.9 6 3.8L13.7 22h-3.4L8.2 6.2c-.2-1.9.1-3.2 1.4-3.9z" fill="#4c9a3a" stroke="#1f5a1c" strokeWidth="0.8" />
          <path d="M10.4 18h3.6l-.3 4h-3z" fill="#c0392b" />
          <circle cx="9.4" cy="8.5" r="1.2" fill="#d7ef9b" />
          <circle cx="14.4" cy="11.5" r="1.2" fill="#d7ef9b" />
          <circle cx="10" cy="14.5" r="1.1" fill="#d7ef9b" />
        </g>
      );
  }
}

/** Icono de palo suelto (marcador, menús). */
export function SuitIcon({ suit, size = 24 }: { suit: Suit; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="suit-icon">
      <SuitShape suit={suit} />
    </svg>
  );
}

// Posiciones de los palos (centro) en una carta de 100×150, como en la baraja tradicional.
const L = 32,
  R = 68,
  C = 50;
const PIPS: Record<number, [number, number][]> = {
  1: [[C, 75]],
  2: [
    [C, 40],
    [C, 110],
  ],
  3: [
    [C, 34],
    [C, 75],
    [C, 116],
  ],
  4: [
    [L, 42],
    [R, 42],
    [L, 108],
    [R, 108],
  ],
  5: [
    [L, 40],
    [R, 40],
    [C, 75],
    [L, 110],
    [R, 110],
  ],
  6: [
    [L, 36],
    [R, 36],
    [L, 75],
    [R, 75],
    [L, 114],
    [R, 114],
  ],
  7: [
    [L, 32],
    [R, 32],
    [C, 54],
    [L, 76],
    [R, 76],
    [L, 118],
    [R, 118],
  ],
};

function Pips({ card }: { card: Card }) {
  const pos = PIPS[card.rank] ?? [];
  const size = card.rank === 1 ? 60 : card.rank <= 3 ? 34 : 29;
  return (
    <>
      {pos.map(([x, y], i) => (
        <g key={i} transform={`translate(${x - size / 2} ${y - size / 2}) scale(${size / 24})`}>
          <SuitShape suit={card.suit} />
        </g>
      ))}
    </>
  );
}

/** Figuras simplificadas: sota (paje de pie), caballo (jinete) y rey (con corona y manto). */
function Figure({ card }: { card: Card }) {
  const col = SUIT_COLOR[card.suit];
  const skin = '#f3cfa6';
  const pip = (x: number, y: number, s = 18) => (
    <g transform={`translate(${x - s / 2} ${y - s / 2}) scale(${s / 24})`}>
      <SuitShape suit={card.suit} />
    </g>
  );
  if (card.rank === 11) {
    return (
      <g>
        {/* caballo */}
        <path d="M24 92c0-12 10-18 26-18s22 4 26 0l6-12c3 2 4 7 2 12l-4 10c0 10-6 14-12 14H38c-8 0-14-2-14-6z" fill="#8d5a2b" stroke="#4a2c10" strokeWidth="1.5" />
        <rect x="32" y="102" width="5" height="22" fill="#8d5a2b" stroke="#4a2c10" />
        <rect x="64" y="102" width="5" height="22" fill="#8d5a2b" stroke="#4a2c10" />
        <circle cx="80" cy="64" r="2" fill="#222" />
        {/* jinete */}
        <path d="M42 50h16l4 30H38z" fill={col} stroke="#222" strokeWidth="1.2" />
        <circle cx="50" cy="42" r="7" fill={skin} stroke="#222" strokeWidth="1" />
        <path d="M43 37h14l-2-6H45z" fill="#f2c230" stroke="#9a6b00" strokeWidth="0.8" />
        {pip(66, 44, 20)}
      </g>
    );
  }
  const king = card.rank === 12;
  return (
    <g>
      {/* manto / túnica */}
      <path d={king ? 'M30 58h40l8 66H22z' : 'M36 58h28l4 46H32z'} fill={col} stroke="#222" strokeWidth="1.3" />
      <path d={king ? 'M44 58h12v66H44z' : 'M46 58h8v46h-8z'} fill="#f2c230" opacity="0.85" />
      {!king && (
        <>
          <rect x="38" y="104" width="7" height="20" fill="#c62828" stroke="#222" />
          <rect x="55" y="104" width="7" height="20" fill="#c62828" stroke="#222" />
        </>
      )}
      {/* cabeza */}
      <circle cx="50" cy="46" r="10" fill={skin} stroke="#222" strokeWidth="1.2" />
      {king ? (
        <>
          <path d="M53 52c-2 6-4 8-3 8s5-2 7-8z" fill="#ddd" />
          <path d="M39 38l3-12 5 7 3-9 3 9 5-7 3 12z" fill="#f2c230" stroke="#9a6b00" strokeWidth="1" />
        </>
      ) : (
        <path d="M39 42c0-9 22-9 22 0l-2-6H41z" fill="#5d3a1a" />
      )}
      {pip(king ? 70 : 72, king ? 76 : 70, king ? 20 : 22)}
    </g>
  );
}

interface CardProps {
  card?: Card;
  faceDown?: boolean;
  trump?: Suit;
  /** Mostrar etiqueta de Pablo/Tuerto/Andorra/Malilla. */
  hints?: boolean;
  playable?: boolean;
  dimmed?: boolean;
  small?: boolean;
  highlight?: boolean;
  selected?: boolean;
  onClick?: () => void;
}

/** Línea del marco con los cortes ("pintas") que identifican el palo. */
function FrameLine({ y, pintas, col }: { y: number; pintas: number; col: string }) {
  if (pintas === 0) return <line x1="8" x2="92" y1={y} y2={y} stroke={col} strokeWidth="1.6" />;
  const gap = 5;
  const segs = pintas + 1;
  const len = (84 - pintas * gap) / segs;
  return (
    <>
      {Array.from({ length: segs }, (_, i) => (
        <line key={i} x1={8 + i * (len + gap)} x2={8 + i * (len + gap) + len} y1={y} y2={y} stroke={col} strokeWidth="1.6" />
      ))}
    </>
  );
}

export function CardView({ card, faceDown, trump, hints, playable, dimmed, small, highlight, selected, onClick }: CardProps) {
  const cls = ['card', small && 'small', faceDown && 'back', playable && 'playable', dimmed && 'dimmed', highlight && 'highlight', selected && 'selected']
    .filter(Boolean)
    .join(' ');

  if (faceDown || !card) {
    return (
      <div className={cls} aria-label="Carta boca abajo">
        {IMAGE_BASE && <img src={`${IMAGE_BASE}/reverso.png`} alt="" draggable={false} />}
      </div>
    );
  }

  const role = trump ? trumpRole(card, trump) : null;
  const label = cardName(card) + (role && role !== 'Vira' ? ` (${role})` : '');
  const col = SUIT_COLOR[card.suit];
  const Tag = onClick ? 'button' : 'div';

  return (
    <Tag className={cls} style={{ ['--suit' as string]: col }} onClick={onClick} aria-label={label} title={label} type={onClick ? 'button' : undefined}>
      {IMAGE_BASE ? (
        <img src={`${IMAGE_BASE}/${card.rank}-${card.suit}.png`} alt={label} draggable={false} />
      ) : (
        <svg viewBox="0 0 100 150" className="face" aria-hidden="true">
          <rect x="1" y="1" width="98" height="148" rx="8" fill="#fffdf6" />
          <FrameLine y={8} pintas={PINTAS[card.suit]} col={col} />
          <FrameLine y={142} pintas={PINTAS[card.suit]} col={col} />
          <line x1="8" x2="8" y1="8" y2="142" stroke={col} strokeWidth="1.6" />
          <line x1="92" x2="92" y1="8" y2="142" stroke={col} strokeWidth="1.6" />
          <text x="11" y="25" className="idx" fill={col}>
            {card.rank}
          </text>
          <text x="89" y="137" className="idx" fill={col} textAnchor="end">
            {card.rank}
          </text>
          {card.rank >= 10 ? <Figure card={card} /> : <Pips card={card} />}
        </svg>
      )}
      {hints && role && role !== 'Vira' && <span className="role">{role}</span>}
      {hints && role === 'Vira' && <span className="role vira">triunfo</span>}
    </Tag>
  );
}

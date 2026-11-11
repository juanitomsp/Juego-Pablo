import { Card, Suit, cardName, rankShort, trumpRole } from '../../shared/engine';

export const SUIT_COLOR: Record<Suit, string> = {
  oros: '#c58f00',
  copas: '#c0392b',
  espadas: '#1f5fa8',
  bastos: '#2e7d32',
};

/** Iconos propios y sencillos de los cuatro palos (no reproducen ninguna baraja comercial). */
export function SuitIcon({ suit, size = 24 }: { suit: Suit; size?: number }) {
  const fill = SUIT_COLOR[suit];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="suit-icon">
      {suit === 'oros' && (
        <>
          <circle cx="12" cy="12" r="9.5" fill={fill} />
          <circle cx="12" cy="12" r="6" fill="none" stroke="#fff6d5" strokeWidth="1.6" />
          <circle cx="12" cy="12" r="2" fill="#fff6d5" />
        </>
      )}
      {suit === 'copas' && (
        <>
          <path d="M5 3h14c0 5.5-3 8.6-7 8.6S5 8.5 5 3z" fill={fill} />
          <rect x="11" y="11" width="2" height="6" fill={fill} />
          <path d="M7 21c0-2.5 2.2-4 5-4s5 1.5 5 4z" fill={fill} />
        </>
      )}
      {suit === 'espadas' && (
        <>
          <path d="M12 1.5l2.2 3V16h-4.4V4.5z" fill={fill} />
          <rect x="6.5" y="15.5" width="11" height="2.2" rx="1" fill={fill} />
          <rect x="10.9" y="17.5" width="2.2" height="4" fill={fill} />
          <circle cx="12" cy="22" r="1.3" fill={fill} />
        </>
      )}
      {suit === 'bastos' && (
        <>
          <path d="M10.2 2.5c3.2-1.3 5.6.8 5.3 3.4L13.6 22h-3.2L8.6 6.4c-.2-1.8.2-3.2 1.6-3.9z" fill={fill} />
          <circle cx="9.2" cy="9" r="1.1" fill="#a5d6a7" />
          <circle cx="14.6" cy="12.5" r="1.1" fill="#a5d6a7" />
          <circle cx="9.8" cy="16" r="1" fill="#a5d6a7" />
        </>
      )}
    </svg>
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
  onClick?: () => void;
}

export function CardView({ card, faceDown, trump, hints, playable, dimmed, small, highlight, onClick }: CardProps) {
  const cls = ['card', small && 'small', faceDown && 'back', playable && 'playable', dimmed && 'dimmed', highlight && 'highlight']
    .filter(Boolean)
    .join(' ');
  if (faceDown || !card) return <div className={cls} aria-label="Carta boca abajo" />;
  const role = trump ? trumpRole(card, trump) : null;
  const isFigure = card.rank >= 10;
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      className={cls}
      style={{ ['--suit' as string]: SUIT_COLOR[card.suit] }}
      onClick={onClick}
      aria-label={cardName(card) + (role && role !== 'Vira' ? ` (${role})` : '')}
      title={cardName(card) + (role && role !== 'Vira' ? ` · ${role}` : '')}
      type={onClick ? 'button' : undefined}
    >
      <span className="rank tl">{rankShort(card.rank)}</span>
      <span className="center">
        <SuitIcon suit={card.suit} size={small ? 22 : 34} />
        {isFigure && !small && <span className="figure">{card.rank === 10 ? 'Sota' : card.rank === 11 ? 'Caballo' : 'Rey'}</span>}
      </span>
      <span className="rank br">{rankShort(card.rank)}</span>
      {hints && role && role !== 'Vira' && <span className="role">{role}</span>}
      {hints && role === 'Vira' && <span className="role vira">triunfo</span>}
    </Tag>
  );
}

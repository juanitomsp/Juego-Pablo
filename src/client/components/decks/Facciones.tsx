/**
 * Baraja original «Cuatro Facciones» (fantasía medieval sombría), dibujada en SVG propio.
 *
 *  Oros    · La Corte de la Opulencia   — nobles corpulentos, terciopelo carmesí y oro.
 *  Espadas · La Orden del Caballero Blanco — armadura de acero blanco, tabardo de cruzado.
 *  Copas   · La Guardia del Caballero Oscuro — armadura gótica ennegrecida, cálices de hierro.
 *  Bastos  · El Clan Agrícola y Forestal — cuero, pieles de lobo y garrotes de roble.
 *
 * Cada palo se reconoce también por el marco (las «pintas»): oro, acero, hierro negro y madera con cuero.
 * Diseño original del proyecto; ver docs/CARTAS.md.
 */
import type { ReactNode } from 'react';
import type { Card, Suit } from '../../../shared/engine';
import { PIPS, pipSize } from './pips';

// ---------------------------------------------------------------- Degradados compartidos

/** Se monta una sola vez en la página (App). Todas las cartas usan estos degradados. */
export function FaccionesDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="fx-parchment" cx="50%" cy="45%" r="75%">
          <stop offset="0%" stopColor="#f3e8cc" />
          <stop offset="70%" stopColor="#dcc79b" />
          <stop offset="100%" stopColor="#b89a64" />
        </radialGradient>
        <linearGradient id="fx-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff2a8" />
          <stop offset="45%" stopColor="#e0ac1f" />
          <stop offset="100%" stopColor="#8a5a00" />
        </linearGradient>
        <linearGradient id="fx-silver" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="50%" stopColor="#cfd6dd" />
          <stop offset="100%" stopColor="#7d8792" />
        </linearGradient>
        <linearGradient id="fx-iron" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#6e727a" />
          <stop offset="45%" stopColor="#2c2e34" />
          <stop offset="100%" stopColor="#0d0e11" />
        </linearGradient>
        <linearGradient id="fx-wood" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#5a3416" />
          <stop offset="50%" stopColor="#9c6a37" />
          <stop offset="100%" stopColor="#4a2a10" />
        </linearGradient>
        <linearGradient id="fx-velvet" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#a8232a" />
          <stop offset="100%" stopColor="#4d0c10" />
        </linearGradient>
        <linearGradient id="fx-back" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2a1f1a" />
          <stop offset="100%" stopColor="#0f0b09" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// ---------------------------------------------------------------- Facciones

interface Faction {
  frame: string; // color/degradado del marco
  frameInner: string;
  cloth: string; // ropa principal
  clothDark: string;
  trim: string; // ribetes
  metal: string; // armadura / coronas
  skin: string;
  hair: string;
  horse: string;
  horseDark: string;
  bulk: number; // corpulencia
}

const F: Record<Suit, Faction> = {
  oros: {
    frame: 'url(#fx-gold)',
    frameInner: '#7a4f00',
    cloth: 'url(#fx-velvet)',
    clothDark: '#4d0c10',
    trim: '#e0ac1f',
    metal: 'url(#fx-gold)',
    skin: '#e2b48a',
    hair: '#3b2412',
    horse: '#b98c3a',
    horseDark: '#6e4f16',
    bulk: 1.32,
  },
  espadas: {
    frame: 'url(#fx-silver)',
    frameInner: '#5d6873',
    cloth: '#eef0f2',
    clothDark: '#9aa4ad',
    trim: '#2f4f8f',
    metal: 'url(#fx-silver)',
    skin: '#eec6a0',
    hair: '#6b5a45',
    horse: '#f1eee6',
    horseDark: '#a9a49a',
    bulk: 1,
  },
  copas: {
    frame: 'url(#fx-iron)',
    frameInner: '#8f9298',
    cloth: 'url(#fx-iron)',
    clothDark: '#0d0e11',
    trim: '#9da1a8',
    metal: 'url(#fx-iron)',
    skin: '#c9a184',
    hair: '#151515',
    horse: '#24242a',
    horseDark: '#050506',
    bulk: 1.05,
  },
  bastos: {
    frame: 'url(#fx-wood)',
    frameInner: '#3a2210',
    cloth: '#7a4a26',
    clothDark: '#4e2d14',
    trim: '#8d8d86',
    metal: '#6c6f73',
    skin: '#c48a5a',
    hair: '#4a2c14',
    horse: '#7b5230',
    horseDark: '#3f2711',
    bulk: 1.22,
  },
};

// ---------------------------------------------------------------- Emblemas (caja 24×24)

export function Emblem({ suit }: { suit: Suit }) {
  switch (suit) {
    case 'oros': // Doblón de oro con efigie de corona
      return (
        <g>
          <circle cx="12" cy="12" r="10.5" fill="url(#fx-gold)" stroke="#5c3b00" strokeWidth="1.1" />
          <circle cx="12" cy="12" r="7.6" fill="none" stroke="#7a4f00" strokeWidth="0.8" />
          {Array.from({ length: 16 }, (_, i) => {
            const a = (i * Math.PI) / 8;
            return <circle key={i} cx={12 + 9.1 * Math.cos(a)} cy={12 + 9.1 * Math.sin(a)} r="0.55" fill="#6b4500" />;
          })}
          <path d="M7.6 14.6V10l2.2 2 2.2-3.4 2.2 3.4 2.2-2v4.6z" fill="#8a5a00" />
          <rect x="7.6" y="14.6" width="8.8" height="1.4" fill="#6b4500" />
        </g>
      );
    case 'espadas': // Espada larga de acero blanco
      return (
        <g>
          <path d="M12 0.6l1.9 2.6v13.4h-3.8V3.2z" fill="url(#fx-silver)" stroke="#4d5660" strokeWidth="0.6" />
          <line x1="12" y1="3" x2="12" y2="16" stroke="#8b96a1" strokeWidth="0.6" />
          <path d="M4.5 16.2h15l-1.2 1.9h-12.6z" fill="url(#fx-silver)" stroke="#4d5660" strokeWidth="0.5" />
          <rect x="10.9" y="18" width="2.2" height="3.8" fill="#4a3020" />
          <circle cx="12" cy="22.6" r="1.4" fill="url(#fx-silver)" stroke="#4d5660" strokeWidth="0.4" />
        </g>
      );
    case 'copas': // Cáliz de hierro negro con gema de ónice
      return (
        <g>
          <path d="M4 2.5h16c0 6-3.6 9.3-8 9.3S4 8.5 4 2.5z" fill="url(#fx-iron)" stroke="#b9bdc4" strokeWidth="0.7" />
          <path d="M4.5 3.6h15" stroke="#c8ccd2" strokeWidth="0.9" />
          <ellipse cx="12" cy="7.2" rx="1.8" ry="2.1" fill="#0a0a0c" stroke="#9da1a8" strokeWidth="0.5" />
          <circle cx="11.4" cy="6.5" r="0.5" fill="#fff" opacity="0.7" />
          <path d="M11 11.5h2l.4 5h-2.8z" fill="url(#fx-iron)" stroke="#9da1a8" strokeWidth="0.4" />
          <path d="M6 22c0-3 2.7-5.3 6-5.3s6 2.3 6 5.3z" fill="url(#fx-iron)" stroke="#b9bdc4" strokeWidth="0.7" />
        </g>
      );
    case 'bastos': // Garrote de roble nudoso con herrajes y un brote
      return (
        <g>
          <path d="M9.3 1.8c3.8-1.6 7 1 6.6 4.2L13.9 22.4h-3.6L8.1 6.2C7.9 4.2 8 2.6 9.3 1.8z" fill="url(#fx-wood)" stroke="#2e1a08" strokeWidth="0.8" />
          <path d="M8.6 8.2l6.6.6M9.4 15.2l5 .4" stroke="#5f6266" strokeWidth="1.6" />
          <circle cx="9.6" cy="11.6" r="1" fill="#3a2210" />
          <circle cx="14.1" cy="4.6" r="0.9" fill="#3a2210" />
          <path d="M15.3 4.2c2.6-1.8 4.6-1 5.2.6-2 .8-3.6.6-5.2-.6z" fill="#5e8f2f" stroke="#2f4f14" strokeWidth="0.4" />
        </g>
      );
  }
}

const place = (x: number, y: number, size: number, child: ReactNode, rotate = 0) => (
  <g transform={`translate(${x} ${y}) rotate(${rotate}) translate(${-size / 2} ${-size / 2}) scale(${size / 24})`}>{child}</g>
);

// ---------------------------------------------------------------- Marco (las «pintas»)

function Frame({ suit }: { suit: Suit }) {
  const f = F[suit];
  return (
    <g>
      <rect x="1" y="1" width="98" height="148" rx="7" fill="url(#fx-parchment)" />
      <rect x="3.5" y="3.5" width="93" height="143" rx="5.5" fill="none" stroke={f.frame} strokeWidth="4" />
      <rect x="7" y="7" width="86" height="136" rx="3" fill="none" stroke={f.frameInner} strokeWidth="0.7" />
      {suit === 'oros' &&
        [
          [7, 7],
          [93, 7],
          [7, 143],
          [93, 143],
        ].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="2.4" fill="url(#fx-gold)" stroke="#5c3b00" strokeWidth="0.5" />)}
      {suit === 'espadas' && (
        <>
          <path d="M44 3.5l6 4 6-4M44 146.5l6-4 6 4" fill="none" stroke="#5d6873" strokeWidth="1" />
          <path d="M3.5 70l4 5-4 5M96.5 70l-4 5 4 5" fill="none" stroke="#5d6873" strokeWidth="1" />
        </>
      )}
      {suit === 'copas' && (
        <>
          <path d="M7 24Q50 4 93 24" fill="none" stroke="#2c2e34" strokeWidth="1.2" />
          <path d="M7 126Q50 146 93 126" fill="none" stroke="#2c2e34" strokeWidth="1.2" />
          {[18, 50, 82].map((x) => (
            <path key={x} d={`M${x - 2} 3.5l2 -2.5 2 2.5`} fill="#2c2e34" />
          ))}
        </>
      )}
      {suit === 'bastos' && (
        <rect x="9.5" y="9.5" width="81" height="131" rx="2.5" fill="none" stroke="#6e4521" strokeWidth="0.9" strokeDasharray="3 2" />
      )}
    </g>
  );
}

function Index({ rank, suit }: { rank: number; suit: Suit }) {
  const plate = (x: number, y: number) => (
    <g>
      <rect x={x} y={y} width="17" height="15" rx="2.5" fill="#1b1410" opacity="0.82" stroke={F[suit].frame} strokeWidth="1" />
      <text x={x + 8.5} y={y + 11.6} textAnchor="middle" className="idx fx-idx" fill="#fbf3dc">
        {rank}
      </text>
    </g>
  );
  return (
    <>
      {plate(9, 126)}
      {plate(74, 9)}
    </>
  );
}

// ---------------------------------------------------------------- Cabezas y tocados

type Headgear = 'crownGold' | 'crownSilver' | 'crownSpiked' | 'crownIron' | 'capVelvet' | 'helmOpen' | 'helmClosed' | 'hair';

function Head({ x, y, r, f, gear, beard }: { x: number; y: number; r: number; f: Faction; gear: Headgear; beard?: boolean }) {
  const s = r / 9; // las coordenadas del tocado están pensadas para r = 9 centrado en (0,0)
  if (gear === 'helmClosed') {
    return (
      <g transform={`translate(${x} ${y}) scale(${s})`}>
        <path d="M-9.5 3V-4Q-9.5 -12 0 -12.5Q9.5 -12 9.5 -4V3Q9.5 10 0 11Q-9.5 10 -9.5 3z" fill="url(#fx-iron)" stroke="#9da1a8" strokeWidth="0.8" />
        <path d="M-7 -1.5H7" stroke="#000" strokeWidth="2" />
        <path d="M0 -12.5V10" stroke="#9da1a8" strokeWidth="0.6" />
        {[-3, 0, 3].map((d) => (
          <circle key={d} cx={d + 3} cy="5" r="0.6" fill="#000" />
        ))}
        <path d="M0 -12.5l-1.6 -5 1.6 -2 1.6 2z" fill="#4a0d14" />
      </g>
    );
  }
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {gear === 'hair' && <path d="M-9.5 -1Q-10 -12 0 -12Q10 -12 9.5 -1L7 -5Q0 -9 -7 -5z" fill={f.hair} />}
      <circle cx="0" cy="0" r="9" fill={f.skin} stroke="#3b2414" strokeWidth="0.6" />
      {/* cejas y ojos: gesto adusto */}
      <path d="M-5.5 -2.6l3.4 .8M5.5 -2.6l-3.4 .8" stroke="#2a1a0e" strokeWidth="0.9" />
      <circle cx="-3.4" cy="-0.6" r="0.9" fill="#1d130b" />
      <circle cx="3.4" cy="-0.6" r="0.9" fill="#1d130b" />
      <path d="M-2.4 4.2h4.8" stroke="#6b3b22" strokeWidth="0.8" />
      {beard && <path d="M-8.4 1.6Q-8 11 0 12.5Q8 11 8.4 1.6Q6 6 3 5.5Q0 7.5 -3 5.5Q-6 6 -8.4 1.6z" fill={f.hair} />}
      {gear === 'crownGold' && (
        <g>
          <path d="M-9 -7V-15l3.5 4 3-7 2.5 6 2.5-6 3 7 3.5-4v8z" fill="url(#fx-gold)" stroke="#5c3b00" strokeWidth="0.6" />
          <circle cx="0" cy="-9.5" r="1.1" fill="#b3122a" />
          <circle cx="-5" cy="-9" r="0.8" fill="#1e5aa8" />
          <circle cx="5" cy="-9" r="0.8" fill="#1e5aa8" />
        </g>
      )}
      {gear === 'crownSilver' && (
        <g>
          <path d="M-9.5 -6.5Q-10 -14 0 -14.5Q10 -14 9.5 -6.5z" fill="url(#fx-silver)" stroke="#4d5660" strokeWidth="0.6" />
          <path d="M-8 -13l2 -4 2 3 2 -5 2 5 2 -3 2 4" fill="url(#fx-silver)" stroke="#4d5660" strokeWidth="0.6" />
          <path d="M-1 -11h2v5h-2z M-3 -9h6v1.6h-6z" fill="#2f4f8f" />
        </g>
      )}
      {gear === 'crownSpiked' && (
        <g>
          <path d="M-10 -6.5V-13l2.5 -8 2.2 7.5 2.8 -11 2.5 11 2.5 -11 2.8 11 2.2 -7.5 2.5 8v6.5z" fill="url(#fx-iron)" stroke="#9da1a8" strokeWidth="0.6" />
          {[-7.5, -2.5, 2.5, 7.5].map((d, i) => (
            <circle key={i} cx={d} cy={i % 3 === 0 ? -21 : -24} r="0.8" fill="#c8ccd2" />
          ))}
        </g>
      )}
      {gear === 'crownIron' && (
        <g>
          <rect x="-9.5" y="-11" width="19" height="4" fill="#6c6f73" stroke="#2e3033" strokeWidth="0.5" />
          {[-6, 0, 6].map((d) => (
            <circle key={d} cx={d} cy="-9" r="0.9" fill="#2e3033" />
          ))}
          <path d="M-9 -11c-2 -3 -1 -5 1 -6 1 2 0 4 -1 6zM9 -11c2 -3 1 -5 -1 -6 -1 2 0 4 1 6z" fill="#5e8f2f" />
        </g>
      )}
      {gear === 'capVelvet' && (
        <g>
          <ellipse cx="0" cy="-8.5" rx="11" ry="4.5" fill="url(#fx-velvet)" />
          <rect x="-9" y="-8" width="18" height="2" fill="#e0ac1f" />
          <path d="M5 -11c6 -6 10 -5 11 -3 -4 0 -7 1 -11 3z" fill="#f3efe6" stroke="#9b958a" strokeWidth="0.4" />
        </g>
      )}
      {gear === 'helmOpen' && (
        <g>
          <path d="M-10 0Q-10 -13 0 -13Q10 -13 10 0L8 0Q8 -9.5 0 -9.5Q-8 -9.5 -8 0z" fill="url(#fx-silver)" stroke="#4d5660" strokeWidth="0.6" />
          <rect x="-1" y="-9.5" width="2" height="9" fill="url(#fx-silver)" stroke="#4d5660" strokeWidth="0.4" />
        </g>
      )}
    </g>
  );
}

// ---------------------------------------------------------------- Figuras de pie (Sota y Rey)

function StandingFigure({ suit, king }: { suit: Suit; king: boolean }) {
  const f = F[suit];
  const W = 30 * f.bulk; // hombros
  const w = 23 * f.bulk; // cintura
  const sx = 50 - W / 2;
  const ex = 50 + W / 2;
  const cape =
    suit === 'copas'
      ? `M${sx - 3} 58 L${sx - 11} 136 l5 -5 4 6 5 -6 4 5 5 -5 6 6 5 -6 4 5 5 -5 6 6 4 -6 L${ex + 3} 58z`
      : `M${sx - 3} 58 L${sx - 10} 136 L${ex + 10} 136 L${ex + 3} 58z`;
  const capeFill = suit === 'oros' ? '#f0e6cf' : suit === 'espadas' ? '#f6f3ea' : suit === 'copas' ? '#3a1020' : '#8d8d86';
  const gear: Headgear =
    suit === 'oros'
      ? king
        ? 'crownGold'
        : 'capVelvet'
      : suit === 'espadas'
        ? king
          ? 'crownSilver'
          : 'helmOpen'
        : suit === 'copas'
          ? king
            ? 'crownSpiked'
            : 'helmClosed'
          : king
            ? 'crownIron'
            : 'hair';

  return (
    <g>
      {king && <path d={cape} fill={capeFill} stroke="#2a1a10" strokeWidth="0.7" />}
      {/* piernas y botas */}
      <rect x="41" y="118" width="7" height="16" fill={f.clothDark} />
      <rect x="52" y="118" width="7" height="16" fill={f.clothDark} />
      <rect x="40" y="130" width="9" height="6" rx="1.5" fill="#2a1a10" />
      <rect x="51" y="130" width="9" height="6" rx="1.5" fill="#2a1a10" />
      {/* túnica / faldón */}
      <path d={`M${50 - w / 2} 98 L${50 - w / 2 - 5} 124 L${50 + w / 2 + 5} 124 L${50 + w / 2} 98z`} fill={f.cloth} stroke="#1f140c" strokeWidth="0.7" />
      {/* torso */}
      <path d={`M${sx} 58 L${ex} 58 L${50 + w / 2} 100 L${50 - w / 2} 100z`} fill={f.cloth} stroke="#1f140c" strokeWidth="0.7" />
      {suit === 'oros' && <path d={`M50 60 L${50 + 6} 79 L50 98 L${50 - 6} 79z`} fill="none" stroke="#e0ac1f" strokeWidth="1.2" />}
      {suit === 'espadas' && (
        <g>
          <path d="M43 62h14v34h-14z" fill="#fbfbf8" stroke="#9aa4ad" strokeWidth="0.5" />
          <path d="M48.5 65h3v26h-3zM44 74h12v3h-12z" fill="#2f4f8f" />
        </g>
      )}
      {suit === 'copas' && (
        <g stroke="#9da1a8" strokeWidth="0.6" fill="none">
          <path d={`M${sx + 3} 68H${ex - 3}M${sx + 4} 78H${ex - 4}M${sx + 5} 88H${ex - 5}`} />
          <path d="M50 60V98" />
        </g>
      )}
      {suit === 'bastos' && (
        <g fill="#8d8d86">
          {Array.from({ length: 18 }, (_, i) => (
            <circle key={i} cx={42 + (i % 6) * 3.2} cy={82 + Math.floor(i / 6) * 3.4} r="0.9" />
          ))}
        </g>
      )}
      {/* cinturón */}
      <rect x={50 - w / 2} y="97" width={w} height="4" fill={suit === 'bastos' ? '#3a2210' : f.metal} stroke="#1f140c" strokeWidth="0.4" />
      {/* brazos */}
      <path d={`M${sx} 59 l-6 30 l5 2 l6 -26z`} fill={f.cloth} stroke="#1f140c" strokeWidth="0.6" />
      <path d={`M${ex} 59 l6 30 l-5 2 l-6 -26z`} fill={f.cloth} stroke="#1f140c" strokeWidth="0.6" />
      <circle cx={sx - 3.5} cy="91" r="3" fill={f.skin} />
      <circle cx={ex + 3.5} cy="91" r="3" fill={f.skin} />
      {/* cuello de piel (Oros) / piel de lobo (Bastos) / hombreras */}
      {suit === 'oros' && <ellipse cx="50" cy="59" rx={W / 2 + 2} ry="5" fill="#ece0c4" stroke="#8a7a5a" strokeWidth="0.6" />}
      {suit === 'bastos' && <path d={`M${sx - 2} 62 l4 -6 4 4 4 -5 4 5 4 -5 4 5 4 -5 4 4 4 -4 2 8z`} fill="#8d8d86" stroke="#4d4d48" strokeWidth="0.5" />}
      {(suit === 'espadas' || suit === 'copas') && (
        <>
          <ellipse cx={sx + 1} cy="60" rx="6" ry="4" fill={f.metal} stroke="#1f140c" strokeWidth="0.5" />
          <ellipse cx={ex - 1} cy="60" rx="6" ry="4" fill={f.metal} stroke="#1f140c" strokeWidth="0.5" />
        </>
      )}
      <rect x="47" y="51" width="6" height="7" fill={f.skin} />
      <Head x={50} y={44} r={9} f={f} gear={gear} beard={suit === 'bastos' || (suit === 'oros' && king)} />
      {/* objeto de la facción */}
      {suit === 'oros' && place(ex + 6, 86, king ? 20 : 17, <Emblem suit="oros" />)}
      {suit === 'copas' && place(ex + 6, 84, king ? 20 : 17, <Emblem suit="copas" />)}
      {suit === 'espadas' && place(ex + 5, king ? 70 : 78, king ? 44 : 38, <Emblem suit="espadas" />, king ? 0 : 8)}
      {suit === 'bastos' && place(ex + 3, 70, king ? 46 : 40, <Emblem suit="bastos" />, -28)}
    </g>
  );
}

// ---------------------------------------------------------------- Caballo (jinete montado)

function Mounted({ suit }: { suit: Suit }) {
  const f = F[suit];
  const gear: Headgear = suit === 'oros' ? 'crownGold' : suit === 'espadas' ? 'helmOpen' : suit === 'copas' ? 'helmClosed' : 'hair';
  return (
    <g>
      {/* cola */}
      <path d="M26 92c-8 4-9 18-5 26 2-8 4-14 8-20z" fill={f.horseDark} />
      {/* patas */}
      {[30, 38, 60, 68].map((x, i) => (
        <g key={x}>
          <rect x={x} y="100" width="5.5" height="30" fill={i % 2 ? f.horse : f.horseDark} stroke="#140c06" strokeWidth="0.5" />
          <rect x={x - 0.8} y="128" width="7" height="4" rx="1" fill={suit === 'bastos' ? '#d8cdb8' : '#1a120c'} />
        </g>
      ))}
      {/* cuerpo */}
      <ellipse cx="49" cy="96" rx="26" ry="13" fill={f.horse} stroke="#140c06" strokeWidth="0.7" />
      {/* cuello, cabeza, crin */}
      <path d="M64 91L72 68L80 71L74 99z" fill={f.horse} stroke="#140c06" strokeWidth="0.7" />
      <path d="M72 66L89 72L87 79L75 77z" fill={f.horse} stroke="#140c06" strokeWidth="0.7" />
      <path d="M72 66l2 -5 3 5" fill={f.horse} stroke="#140c06" strokeWidth="0.6" />
      <circle cx="80" cy="71.5" r="1" fill="#000" />
      <path d="M71 69c-3 6-4 14-7 22l3 1c3-8 5-15 7-22z" fill={f.horseDark} />
      {/* bardas y gualdrapas */}
      {suit === 'oros' && <path d="M27 96Q49 118 73 96L71 110Q49 124 29 110z" fill="url(#fx-velvet)" stroke="#e0ac1f" strokeWidth="1.2" />}
      {suit === 'espadas' && (
        <g>
          <path d="M27 96Q49 118 73 96L71 110Q49 124 29 110z" fill="#f8f7f2" stroke="#9aa4ad" strokeWidth="0.8" />
          <path d="M47 101h4v14h-4zM43 106h12v3.5h-12z" fill="#2f4f8f" />
          <path d="M74 69L88 73L87 77L76 75z" fill="url(#fx-silver)" />
        </g>
      )}
      {suit === 'copas' && (
        <g>
          <path d="M27 96Q49 118 73 96L71 110Q49 124 29 110z" fill="url(#fx-iron)" stroke="#9da1a8" strokeWidth="0.7" />
          {[34, 44, 54, 64].map((x) => (
            <path key={x} d={`M${x} 112l2 5 2 -5`} fill="#9da1a8" />
          ))}
          <path d="M74 69L88 73L87 77L76 75z" fill="url(#fx-iron)" />
        </g>
      )}
      {suit === 'bastos' && <path d="M38 85h24l-2 9h-20z" fill="#5b3618" stroke="#2a1708" strokeWidth="0.6" />}
      {/* jinete */}
      <rect x="46" y="84" width="7" height="20" fill={f.clothDark} stroke="#140c06" strokeWidth="0.5" />
      <path d="M43 60H57L56 88H44z" fill={f.cloth} stroke="#140c06" strokeWidth="0.6" />
      {suit === 'espadas' && <path d="M48.5 63h3v20h-3zM45 69h10v3h-10z" fill="#2f4f8f" />}
      {suit === 'bastos' && <path d="M42 63l3 -5 3 4 3 -4 3 4 3 -4 2 5z" fill="#8d8d86" />}
      <path d="M56 62l9 -10 3 3 -9 11z" fill={f.cloth} stroke="#140c06" strokeWidth="0.5" />
      <Head x={50} y={52} r={7} f={f} gear={gear} beard={suit === 'bastos'} />
      {suit === 'espadas'
        ? place(70, 36, 34, <Emblem suit="espadas" />, 30)
        : suit === 'bastos'
          ? place(70, 40, 34, <Emblem suit="bastos" />, 25)
          : place(70, 46, 18, <Emblem suit={suit} />)}
    </g>
  );
}

// ---------------------------------------------------------------- Cara y dorso

export function FaccionesFace({ card }: { card: Card }) {
  const { suit, rank } = card;
  let body: ReactNode;
  if (rank === 12 || rank === 10) {
    body = <StandingFigure suit={suit} king={rank === 12} />;
  } else if (rank === 11) {
    body = <Mounted suit={suit} />;
  } else {
    const size = pipSize(rank);
    body = (
      <>
        {rank === 1 && (
          <path
            d="M24 128V64Q24 34 50 26Q76 34 76 64V128z"
            fill="rgba(40,26,14,0.10)"
            stroke={F[suit].frame}
            strokeWidth="1.6"
          />
        )}
        {(PIPS[rank] ?? []).map(([x, y], i) => (
          <g key={i}>{place(x, y, size, <Emblem suit={suit} />)}</g>
        ))}
      </>
    );
  }
  return (
    <svg viewBox="0 0 100 150" className="face" aria-hidden="true">
      <Frame suit={suit} />
      {body}
      <Index rank={rank} suit={suit} />
    </svg>
  );
}

export function FaccionesBack() {
  return (
    <svg viewBox="0 0 100 150" className="face" aria-hidden="true">
      <rect x="1" y="1" width="98" height="148" rx="7" fill="url(#fx-back)" />
      <rect x="5" y="5" width="90" height="140" rx="4" fill="none" stroke="url(#fx-gold)" strokeWidth="2" />
      <rect x="9" y="9" width="82" height="132" rx="2" fill="none" stroke="#6b4a1a" strokeWidth="0.6" strokeDasharray="2 2" />
      <path d="M50 22L82 75L50 128L18 75z" fill="none" stroke="#6b4a1a" strokeWidth="0.8" />
      {place(50, 46, 20, <Emblem suit="oros" />)}
      {place(72, 75, 20, <Emblem suit="espadas" />)}
      {place(50, 104, 20, <Emblem suit="copas" />)}
      {place(28, 75, 20, <Emblem suit="bastos" />)}
      <circle cx="50" cy="75" r="6" fill="url(#fx-gold)" stroke="#5c3b00" strokeWidth="0.6" />
    </svg>
  );
}

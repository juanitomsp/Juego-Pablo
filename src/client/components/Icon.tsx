/** Iconos propios del juego (trazos sencillos de 24×24, color heredado). Sustituyen a los emojis. */
const PATHS: Record<string, string> = {
  online: 'M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2 20c0-3 2.7-5 6-5s6 2 6 5M14.5 15.2c.5-.1 1-.2 1.5-.2 3.3 0 6 2 6 5',
  bot: 'M12 3v3M7 8h10a3 3 0 0 1 3 3v5a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-5a3 3 0 0 1 3-3Zm2 5h.01M15 13h.01M9.5 16h5',
  cards: 'M5 6.5 12.2 4a1.5 1.5 0 0 1 1.9.9l3.6 10.3a1.5 1.5 0 0 1-.9 1.9L9.6 19.6a1.5 1.5 0 0 1-1.9-.9L4.1 8.4a1.5 1.5 0 0 1 .9-1.9ZM17 5.5l1.6.6a1.5 1.5 0 0 1 .9 1.9L17 15',
  book: 'M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15ZM4 20.5A2.5 2.5 0 0 0 6.5 23H20M8 7h8',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  learn: 'M2 9l10-5 10 5-10 5L2 9Zm4 2v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5M22 9v6',
  chat: 'M4 5h16v10H9l-5 4V5Z',
  history: 'M3 12a9 9 0 1 0 3-6.7M3 4v4h4M12 7v5l3 2',
  ranking: 'M4 14h4v6H4zM10 9h4v11h-4zM16 4h4v16h-4z',
  close: 'M6 6l12 12M18 6 6 18',
  sound: 'M4 9h4l5-4v14l-5-4H4V9Zm12.5-.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12',
  mute: 'M4 9h4l5-4v14l-5-4H4V9Zm13 1 5 5m0-5-5 5',
  help: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm-2.5-13a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14m0 3h.01',
  exit: 'M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 17l-5-5 5-5M5 12h11',
  share: 'M16 6l-4-4-4 4M12 2v13M5 11v9h14v-9',
  copy: 'M8 8h11v13H8zM5 16H4V3h11v1',
  check: 'M4 12l5 5L20 6',
  live: 'M3 12h4l3-8 4 16 3-8h4',
  crown: 'M3 8l4 4 5-7 5 7 4-4-2 11H5L3 8Z',
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  globe: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM2 12h20M12 2c2.5 2.7 4 6.2 4 10s-1.5 7.3-4 10c-2.5-2.7-4-6.2-4-10s1.5-7.3 4-10Z',
  lock: 'M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4',
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, label }: { name: IconName; size?: number; label?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="icon"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

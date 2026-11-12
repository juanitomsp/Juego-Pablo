/**
 * Idiomas del juego: español (por defecto) e inglés.
 *
 * Los textos se escriben en español en el propio código y se pasan por t(): si el idioma es inglés,
 * se busca su traducción en i18n.en.ts (si falta alguna, sale en español). Las variables van entre llaves:
 * t('Turno de {name}.', { name }). El idioma se guarda en este dispositivo; si no se ha elegido,
 * se usa el del móvil (español si está en español; si no, inglés).
 */
import type { Card, Suit } from '../shared/engine';
import { cardName } from '../shared/engine';
import { EN } from './i18n.en';

export type Lang = 'es' | 'en';
const KEY = 'pablo.lang';

function detect(): Lang {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'es' || v === 'en') return v;
    return (navigator.language || 'es').toLowerCase().startsWith('es') ? 'es' : 'en';
  } catch {
    return 'es';
  }
}

const current: Lang = typeof window === 'undefined' ? 'es' : detect();
if (typeof document !== 'undefined') document.documentElement.lang = current;

export const lang = (): Lang => current;
export const isEn = () => current === 'en';

/** Cambia el idioma y recarga la página para aplicarlo en todas partes. */
export function setLang(l: Lang) {
  localStorage.setItem(KEY, l);
  window.location.reload();
}

export function t(es: string, vars?: Record<string, string | number>): string {
  let s = current === 'en' ? (EN[es] ?? es) : es;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

/** Mensajes que llegan del servidor (en español): exactos o con números dentro. */
export function tServer(msg: string | null | undefined): string {
  if (!msg) return '';
  if (current !== 'en') return msg;
  if (EN[msg]) return EN[msg];
  let m = msg.match(/^Reporte enviado\. Si lo reportan (\d+) jugadores más, será expulsado\./);
  if (m) return `Report sent. If ${m[1]} more players report them, they will be removed. Meanwhile, they are muted for you.`;
  m = msg.match(/^(.+) ha sido expulsado de la mesa\.$/);
  if (m) return `${m[1]} has been removed from the table.`;
  return msg;
}

const SUIT_EN: Record<Suit, string> = { oros: 'coins', copas: 'cups', espadas: 'swords', bastos: 'clubs' };
const RANK_EN: Record<number, string> = { 1: 'Ace', 10: 'Jack', 11: 'Knight', 12: 'King' };

/** Nombre del palo en el idioma actual. */
export const suitName = (s: Suit) => (current === 'en' ? SUIT_EN[s] : s);

/** Nombre de la carta en el idioma actual («Rey de oros» / «King of coins»). */
export function cardLabel(c: Card): string {
  if (current !== 'en') return cardName(c);
  return `${RANK_EN[c.rank] ?? c.rank} of ${SUIT_EN[c.suit]}`;
}

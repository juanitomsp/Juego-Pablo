/**
 * Chat de la mesa: lo leen todos los jugadores, pero se tachan las palabras que dicen qué cartas llevas.
 *   «tengo el 3 de basto»  →  «tengo el **** de *****»
 * Se aplica en el servidor (no se puede saltar desde el cliente). Ver docs/REGLAS.md §7.
 */

export const CHAT_MAX_LENGTH = 140;

/** Palabras que revelan cartas (sin tildes, en minúsculas). */
const CARD_WORDS = new Set([
  // números y figuras
  'as', 'ases', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce',
  'sota', 'sotas', 'caballo', 'caballos', 'rey', 'reyes', 'figura', 'figuras',
  // palos
  'oro', 'oros', 'copa', 'copas', 'espada', 'espadas', 'basto', 'bastos', 'palo', 'palos',
  // cartas con nombre y triunfos
  'pablo', 'paulo', 'tuerto', 'andorra', 'jandorra', 'malilla', 'mijilla', 'triunfo', 'triunfos', 'vira', 'viras',
]);

const strip = (w: string) =>
  w
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/** Una palabra se tacha si es una palabra de cartas o si contiene algún número. */
function isCardWord(word: string): boolean {
  const w = strip(word);
  if (/\d/.test(w)) return true;
  if (CARD_WORDS.has(w)) return true;
  // Variantes con letras repetidas para saltarse el filtro ("bastooo", "reeey").
  return CARD_WORDS.has(w.replace(/(.)\1+/g, '$1'));
}

const stars = (word: string) => '*'.repeat(Math.max(4, word.length));

/** Limpia el texto: quita caracteres de control y tacha las referencias a cartas. */
export function censorChat(raw: string): string {
  const text = String(raw ?? '')
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, CHAT_MAX_LENGTH);
  // Palabras = secuencias de letras (con tildes) o números; lo demás se conserva.
  return text.replace(/[\p{L}\p{N}]+/gu, (w) => (isCardWord(w) ? stars(w) : w));
}

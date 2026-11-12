/**
 * Chat de la mesa: lo leen todos los jugadores.
 *  - Se tachan las palabras que dicen qué cartas llevas: «tengo el 3 de basto» → «tengo el **** de *****».
 *  - Los insultos no se envían: el servidor avisa al que lo escribe y, a la tercera, lo echa de la sala.
 * Se aplica en el servidor (no se puede saltar desde el cliente). Ver docs/REGLAS.md §7.
 */

export const CHAT_MAX_LENGTH = 140;
/** Avisos por insultar antes de ser expulsado de la sala. */
export const INSULT_STRIKES_TO_KICK = 3;

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

/** Insultos: palabras completas (sin tildes). */
const INSULT_WORDS = new Set([
  'idiota', 'idiotas', 'tonto', 'tonta', 'tontos', 'tontas', 'estupido', 'estupida', 'estupidos', 'estupidas',
  'cretino', 'cretina', 'puta', 'putas', 'puto', 'putos', 'hdp', 'zorra', 'zorras', 'capullo', 'capulla', 'capullos',
  'marica', 'maricas', 'maricon', 'maricona', 'maricones', 'mongolo', 'mongola', 'mongolos', 'inutil', 'inutiles',
  'pendejo', 'pendeja', 'cabron', 'cabrona', 'cabrones', 'malparido', 'malparida', 'bastardo', 'bastarda',
  'payaso', 'payasa', 'cerdo', 'cerda', 'asqueroso', 'asquerosa', 'basura', 'mierdas', 'tarado', 'tarada', 'zopenco',
]);
/** Insultos: comienzos de palabra (cubren derivados como «gilipollas», «imbéciles», «subnormales»…). */
const INSULT_STEMS = ['gilipoll', 'imbecil', 'subnormal', 'retrasad', 'hijoput', 'hijaput', 'mamon', 'cabronaz', 'putill', 'mariconaz'];
/** Insultos de varias palabras (texto normalizado sin espacios dobles). */
const INSULT_PHRASES = ['hijo de puta', 'hija de puta', 'hijos de puta', 'me cago en tu', 'me cago en vuestra', 'tu puta madre'];

const strip = (w: string) =>
  w
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/** Normaliza trucos para saltarse el filtro: «1d1ot4» → «idiota», «puuuta» → «puta». */
function deobfuscate(w: string): string {
  return strip(w)
    .replace(/[0@4]/g, (c) => (c === '0' ? 'o' : 'a'))
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/5|\$/g, 's')
    .replace(/7/g, 't')
    .replace(/(.)\1+/g, '$1');
}

/** Una palabra se tacha si es una palabra de cartas o si contiene algún número. */
function isCardWord(word: string): boolean {
  const w = strip(word);
  if (/\d/.test(w)) return true;
  if (CARD_WORDS.has(w)) return true;
  return CARD_WORDS.has(w.replace(/(.)\1+/g, '$1'));
}

function isInsultWord(word: string): boolean {
  // También sin números pegados: «Idiota99».
  const variants = [strip(word), deobfuscate(word), strip(word).replace(/[0-9]+/g, '')];
  return variants.some(
    (w) => INSULT_WORDS.has(w) || INSULT_WORDS.has(w.replace(/(.)\1+/g, '$1')) || INSULT_STEMS.some((s) => w.startsWith(s)),
  );
}

/** ¿El texto contiene algún insulto? */
export function containsInsult(raw: string): boolean {
  const text = strip(String(raw ?? ''));
  const words = text.match(/[\p{L}\p{N}@$]+/gu) ?? [];
  if (words.some(isInsultWord)) return true;
  const joined = ' ' + words.map(deobfuscate).join(' ') + ' ';
  return INSULT_PHRASES.some((p) => joined.includes(` ${p} `) || joined.includes(` ${p}`));
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

/** Aviso que recibe quien intenta insultar (solo lo ve él). */
export function insultWarning(strikes: number): string {
  if (strikes >= INSULT_STRIKES_TO_KICK) return 'Has sido expulsado de la partida por insultar.';
  if (strikes === INSULT_STRIKES_TO_KICK - 1)
    return 'No se puede insultar: tu mensaje no se ha enviado. Último aviso: si vuelves a insultar, serás expulsado de la partida.';
  return 'No se puede insultar: tu mensaje no se ha enviado. Si sigues insultando, serás expulsado de la partida.';
}

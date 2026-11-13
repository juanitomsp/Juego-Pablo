/**
 * Chat de la mesa: lo leen todos los jugadores.
 *  - Se puede hablar de cartas libremente (como en la mesa de verdad, se oye todo el mundo).
 *  - Se puede decir de todo, insultos de broma incluidos: no se filtra ni se expulsa a nadie por lo que escribe.
 *    Quien moleste se puede silenciar o reportar. Ver docs/REGLAS.md §7.
 * La lista de insultos solo se usa para los apodos, que se ven en la lista de mesas públicas.
 */

export const CHAT_MAX_LENGTH = 140;

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

/** Limpia el texto: quita caracteres de control, junta espacios y lo recorta. */
export function cleanChat(raw: string): string {
  return String(raw ?? '')
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, CHAT_MAX_LENGTH);
}

/**
 * Sonidos del juego, generados en el momento con Web Audio (sin ficheros de audio: nada con derechos).
 * Se pueden desactivar; la preferencia se guarda en el dispositivo.
 */
const KEY = 'pablo.sound';
let ctx: AudioContext | null = null;

export const soundOn = () => localStorage.getItem(KEY) !== '0';
export const setSoundOn = (on: boolean) => localStorage.setItem(KEY, on ? '1' : '0');

function audio(): AudioContext | null {
  if (!soundOn()) return null;
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Ruido corto filtrado: el «chas» de una carta sobre el tapete. */
function card(a: AudioContext, delay = 0) {
  const len = 0.07;
  const buf = a.createBuffer(1, Math.floor(a.sampleRate * len), a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 3;
  const src = a.createBufferSource();
  src.buffer = buf;
  const filter = a.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 2400;
  filter.Q.value = 0.7;
  const gain = a.createGain();
  gain.gain.value = 0.35;
  src.connect(filter).connect(gain).connect(a.destination);
  src.start(a.currentTime + delay);
}

/** Notas suaves (campanilla) para avisos y victorias. */
function notes(a: AudioContext, freqs: number[], step = 0.11, volume = 0.12) {
  freqs.forEach((f, i) => {
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = 'triangle';
    o.frequency.value = f;
    const t = a.currentTime + i * step;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(volume, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    o.connect(g).connect(a.destination);
    o.start(t);
    o.stop(t + 0.4);
  });
}

export type SoundName = 'card' | 'deal' | 'trick' | 'turn' | 'bet' | 'win' | 'lose';

export function play(name: SoundName) {
  const a = audio();
  if (!a) return;
  switch (name) {
    case 'card':
      return card(a);
    case 'deal':
      for (let i = 0; i < 5; i++) card(a, i * 0.07);
      return;
    case 'trick':
      return notes(a, [660, 880], 0.08, 0.08);
    case 'turn':
      return notes(a, [740], 0.1, 0.06);
    case 'bet':
      return notes(a, [523, 659, 784], 0.07, 0.09);
    case 'win':
      return notes(a, [523, 659, 784, 1047], 0.12, 0.12);
    case 'lose':
      return notes(a, [392, 330, 262], 0.14, 0.09);
  }
}

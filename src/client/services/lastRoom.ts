/**
 * Última partida online en la que estabas sentado, para ofrecer «Volver a tu partida» en la portada
 * si se cierra la app o se pierde la conexión. Solo se guarda el código de la sala, en este dispositivo.
 */
import { getPlayerId } from './identity';
import { getSocket } from './controller';

const KEY = 'pablo.lastRoom';
const MAX_AGE = 1000 * 60 * 60 * 3;

export function setLastRoom(code: string) {
  localStorage.setItem(KEY, JSON.stringify({ code, at: Date.now() }));
}

export function clearLastRoom() {
  localStorage.removeItem(KEY);
}

export function getLastRoom(): string | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { code?: string; at?: number } | null;
    if (!v?.code || !v.at || Date.now() - v.at > MAX_AGE) return null;
    return v.code;
  } catch {
    return null;
  }
}

/** Pregunta al servidor si sigues teniendo asiento en esa partida (y si sigue en juego). */
export function checkLastRoom(): Promise<string | null> {
  const code = getLastRoom();
  if (!code) return Promise.resolve(null);
  const socket = getSocket();
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), 5000);
    const ask = () =>
      socket.emit('room:mine', { code, playerId: getPlayerId() }, (r) => {
        clearTimeout(t);
        if (r.ok && r.active) resolve(code);
        else {
          if (r.ok) clearLastRoom();
          resolve(null);
        }
      });
    if (socket.connected) ask();
    else socket.once('connect', ask);
  });
}

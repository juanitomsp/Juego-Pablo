/**
 * Avisa al servidor, de forma anónima, de las partidas contra bots (que se juegan en el propio móvil),
 * para que cuenten en las estadísticas de uso de la beta. Solo se envía el identificador aleatorio del
 * dispositivo y el tipo de aviso; el servidor guarda únicamente totales. Si no hay conexión, no pasa nada.
 */
import { getPlayerId } from './identity';

const SERVER = ((import.meta.env.VITE_SERVER_URL as string | undefined) || '').replace(/\/$/, '');

export function pingPractice(event: 'start' | 'hand' | 'end') {
  try {
    void fetch(`${SERVER}/api/uso/practica`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ playerId: getPlayerId(), event }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Sin conexión: no se cuenta.
  }
}

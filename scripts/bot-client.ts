/**
 * Cliente de prueba: se conecta a una sala como si fuera un jugador humano y juega con la lógica del bot.
 * Útil para probar partidas online sin tener varias personas.
 *
 *   npx tsx scripts/bot-client.ts CODIGO [nombre] [url]
 */
import { io } from 'socket.io-client';
import { chooseBotAction } from '../src/shared/engine';
import type { RoomState } from '../src/shared/protocol';

const [code, name = 'Cliente de prueba', url = 'http://localhost:3001'] = process.argv.slice(2);
if (!code) {
  console.error('Uso: npx tsx scripts/bot-client.ts CODIGO [nombre] [url]');
  process.exit(1);
}

const playerId = `test-${name.replace(/\W/g, '')}-${Math.random().toString(36).slice(2, 10)}`;
const s = io(url, { transports: ['websocket'] });
let senas = 0;
let busy = false;

s.on('connect', () => s.emit('room:join', { code, name, playerId }, (r) => console.log('join', JSON.stringify(r))));
s.on('sena', (m) => {
  senas++;
  console.log('seña recibida', JSON.stringify(m));
});
s.on('state', (st: RoomState) => {
  const v = st.view;
  if (!v) return console.log('en la sala, asiento', st.room.yourSeat);
  if (v.phase === 'finished') {
    console.log('FIN. Gana el equipo', v.winner, '· pablos', v.pablos.join('-'), '· señas recibidas', senas);
    process.exit(0);
  }
  if (busy) return;
  const a = chooseBotAction(v);
  if (!a) return;
  busy = true;
  setTimeout(() => {
    s.emit('game:action', a, (r) => {
      busy = false;
      if (!r.ok) console.log('rechazada', a.type, r.error);
    });
  }, 300);
});

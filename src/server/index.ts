/**
 * Punto de entrada del servidor.
 *
 * Variables de entorno (ver .env.example y docs/SEGURIDAD.md):
 *   PORT          Puerto (por defecto 3001). `npm run dev` usa --port 3001.
 *   CORS_ORIGIN   Orígenes permitidos si el cliente está en otro dominio (p. ej. Vercel), separados por comas.
 *                 Las apps de iPhone y Android (capacitor://localhost y https://localhost) se permiten siempre.
 *   TRUST_PROXY   1 si el servidor está detrás de un proxy (nginx, Caddy, Render...) para leer la IP real.
 *   MAX_ROOMS     Máximo de salas simultáneas (por defecto 500).
 *   ADMIN_TOKEN   Contraseña del panel de control (#/admin). Sin ella, el panel está desactivado.
 *   USAGE_FILE    Fichero de estadísticas de uso anónimas (por defecto data/uso.json).
 *   HOST          Interfaz de escucha. 127.0.0.1 = solo accesible a través del proxy (Caddy, Tailscale).
 *                 Por defecto, todas (necesario para jugar en la WiFi de casa con `npm run jugar`).
 */
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createGameServer } from './app';

const portArg = process.argv.indexOf('--port');
const PORT = Number(portArg > 0 ? process.argv[portArg + 1] : (process.env.PORT ?? 3001));
const HOST = process.env.HOST || undefined;

const here = dirname(fileURLToPath(import.meta.url));
const clientDir = [join(here, '../client'), join(process.cwd(), 'dist/client')].find((d) => existsSync(join(d, 'index.html')));

const server = createGameServer({
  clientDir,
  allowedOrigins: [
    ...(process.env.CORS_ORIGIN ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    // Apps de iPhone (Capacitor) y Android. Un navegador no puede hacerse pasar por estos orígenes.
    'capacitor://localhost',
    'https://localhost',
  ],
  trustProxy: process.env.TRUST_PROXY === '1' || process.env.TRUST_PROXY === 'true',
  maxRooms: process.env.MAX_ROOMS ? Number(process.env.MAX_ROOMS) : undefined,
  adminToken: process.env.ADMIN_TOKEN || undefined,
  usageFile: process.env.USAGE_FILE || join(process.cwd(), 'data', 'uso.json'),
});

process.on('unhandledRejection', (e) => console.error('Promesa rechazada sin capturar:', e));

server.http.listen(PORT, HOST, () => {
  console.log(`Servidor del Pablo escuchando en http://${HOST ?? 'localhost'}:${PORT}`);
  // Direcciones para entrar desde otros dispositivos de la misma red WiFi (móviles).
  const lan = Object.values(networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => `http://${i!.address}:${PORT}`);
  if (clientDir && lan.length && !HOST) console.log(`Desde los móviles en la misma WiFi: ${lan.join('  o  ')}`);
});

const shutdown = () => {
  console.log('Cerrando servidor…');
  void server.close().finally(() => process.exit(0));
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

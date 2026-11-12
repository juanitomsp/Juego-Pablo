/**
 * Servidor del panel: una web aparte del juego con las métricas y el uso.
 *
 * Escucha SOLO en 127.0.0.1 (ADMIN_PORT, por defecto 3010): desde internet no se puede llegar.
 * Para verlo desde tus dispositivos, el script de instalación lo publica solo en tu red de Tailscale
 * (`tailscale serve`, nunca con Funnel). Ver docs/PANEL_SERVIDOR.md.
 */
import express from 'express';
import { createServer, Server as HttpServer } from 'node:http';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Metrics } from './metrics';
import type { Usage } from './usage';

export function createAdminServer(opts: { metrics: Metrics; usage: Usage; adminDir?: string }): HttpServer {
  const app = express();
  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    next();
  });
  app.get('/api/metrics', (req, res) => {
    res.json({ ...opts.metrics.report(req.query.range === '7d' ? '7d' : '24h'), usage: opts.usage.report() });
  });
  if (opts.adminDir && existsSync(join(opts.adminDir, 'index.html'))) {
    app.use(express.static(opts.adminDir, { index: 'index.html', dotfiles: 'ignore' }));
  } else {
    app.get('/', (_req, res) => res.type('text').send('Panel no compilado: ejecuta «npm run build».'));
  }
  return createServer(app);
}

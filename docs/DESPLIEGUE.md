# Despliegue

El juego tiene dos partes:

1. **Cliente**: ficheros estáticos (`dist/client`) — se pueden alojar en cualquier sitio.
2. **Servidor de juego**: un proceso Node **siempre encendido** con WebSockets (Socket.IO) que guarda las salas en memoria.

## ¿Se puede desplegar en Vercel?

**Solo la parte del cliente.** Vercel ejecuta el backend como funciones *serverless* que se apagan tras cada petición y **no admiten conexiones WebSocket persistentes**, así que el servidor de partidas online no puede vivir ahí. Lo mismo pasa con Netlify o Cloudflare Pages.

Opciones:

| Opción | Cómo | Cuándo |
|---|---|---|
| **A. Todo junto en Render / Railway / Fly.io** (recomendada) | Un solo servicio Node: `npm run build` + `npm start` | Lo más simple. Un dominio, sin CORS |
| **B. Vercel (cliente) + Render/Railway/Fly (servidor)** | Cliente en Vercel con `VITE_SERVER_URL`, servidor aparte con `CORS_ORIGIN` | Si quieres el cliente en Vercel por su CDN o dominio |
| **C. Docker** en tu propio VPS | `docker build` + `docker run` | Control total |

La práctica contra bots, el marcador en vivo, las reglas y las estadísticas funcionan aunque el cliente esté solo (sin servidor); lo único que necesita el servidor es el juego online.

### A. Render (todo junto)

1. Sube el repositorio a GitHub.
2. En <https://render.com>: **New → Web Service** → elige el repositorio.
3. Runtime **Node**. Build command: `npm ci && npm run build`. Start command: `npm start`.
4. Variables de entorno (si usas cuentas): `VITE_FIREBASE_*`. Render da `PORT` automáticamente.
5. Health check path: `/api/health`.

Nota: el plan gratuito de Render **duerme** el servicio tras 15 min sin tráfico (la primera visita tarda ~1 min) y al dormirse se pierden las salas. Para jugar en serio, usa un plan de pago básico.

Railway y Fly.io funcionan igual (Fly puede usar el `Dockerfile` directamente: `fly launch`).

### B. Vercel + servidor aparte

1. Despliega el servidor como en la opción A (Render, etc.) y apunta su URL, p. ej. `https://pablo-server.onrender.com`. Añade la variable `CORS_ORIGIN=https://tu-juego.vercel.app`.
2. En Vercel: importa el repositorio con:
   - Framework: **Vite**
   - Build command: `npx vite build`
   - Output directory: `dist/client`
   - Variables: `VITE_SERVER_URL=https://pablo-server.onrender.com` (y las `VITE_FIREBASE_*` si usas cuentas)
3. Añade el dominio de Vercel en *Authorized domains* de Firebase Authentication.

### C. Docker

```bash
docker build -t pablo .
```

```bash
docker run -p 3001:3001 pablo
```

Con cuentas, pasa las variables al compilar: `docker build --build-arg VITE_FIREBASE_API_KEY=... -t pablo .`

## Producción: comprobaciones

- `npm test` y `npm run typecheck` en verde.
- HTTPS (todas las plataformas anteriores lo dan por defecto).
- Una sola instancia del servidor (las salas están en memoria; ver `ARQUITECTURA.md`).

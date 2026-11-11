# Despliegue

El juego tiene dos partes:

1. **Cliente:** las páginas que se descargan al navegador (`dist/client`). Son ficheros estáticos y se pueden alojar en cualquier sitio, incluido Vercel.
2. **Servidor de juego:** un programa Node **siempre encendido** que mantiene las salas y las conexiones en tiempo real (WebSocket).

## ¿Por qué no todo en Vercel?

Vercel ejecuta el código de servidor como funciones que se encienden para cada petición y se apagan enseguida. **No pueden mantener conexiones WebSocket abiertas ni recordar las salas**, así que el juego online no puede vivir ahí. En Vercel solo puede ir el cliente. Lo mismo pasa con Netlify o Cloudflare Pages.

**Render**, **Railway** o **Fly.io** sí ejecutan un servidor Node permanente, y tu propio servidor (VPS) también.

| Opción | Cliente | Servidor | Dificultad |
|---|---|---|---|
| **A. Todo en Render** | Render | Render | La más fácil |
| **B. Todo en tu servidor** | Tu servidor | Tu servidor | Media |
| **C. Vercel + tu servidor** | Vercel | Tu servidor | Media-alta |
| **D. Docker** | Donde quieras | Donde quieras | Media |

La práctica contra bots, el marcador en vivo, las reglas y las estadísticas funcionan aunque el servidor esté caído; solo el juego online lo necesita.

---

## A. Todo en Render

Render es una plataforma como Vercel (conectas GitHub y despliega sola en cada `git push`), pero mantiene tu servidor encendido.

1. Sube el código a GitHub.
2. Entra en <https://render.com> con tu cuenta de GitHub → **New +** → **Web Service** → elige el repositorio.
3. Configura:
   - **Branch:** `main` (o la que uses)
   - **Runtime:** Node
   - **Build Command:** `npm ci && npm run build`
   - **Start Command:** `npm start`
   - **Instance Type:** Free para probar, Starter (unos 7 $/mes) para jugar en serio
4. **Environment** → añade:
   - `TRUST_PROXY` = `1` (Render pone un proxy delante)
   - `NODE_VERSION` = `22`
   - Si usas cuentas: las `VITE_FIREBASE_*`
5. **Advanced → Health Check Path:** `/api/health`
6. **Create Web Service.** En unos minutos tendrás `https://tu-juego.onrender.com`, ya con https.

Para tener tu propio dominio: *Settings → Custom Domains*.

En el plan gratuito, el servicio se duerme tras 15 minutos sin visitas: el primero en entrar espera cerca de un minuto, y se pierden las salas abiertas.

## B. Todo en tu servidor (VPS con Linux)

Necesitas un dominio (o subdominio) apuntando a la IP del servidor, por ejemplo `pablo.tudominio.es`.

```bash
# 1. Node 22 y el código
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo useradd --system --create-home pablo
sudo -u pablo git clone https://github.com/TU_USUARIO/TU_REPO.git /home/pablo/app
cd /home/pablo/app && sudo -u pablo npm ci && sudo -u pablo npm run build
```

**2. Servicio que arranca solo** (`/etc/systemd/system/pablo.service`):

```ini
[Unit]
Description=El Pablo
After=network.target

[Service]
User=pablo
WorkingDirectory=/home/pablo/app
Environment=NODE_ENV=production
Environment=PORT=3001
Environment=TRUST_PROXY=1
ExecStart=/usr/bin/node dist/server/index.js
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now pablo
```

**3. HTTPS con Caddy** (consigue y renueva el certificado solo). Fichero `/etc/caddy/Caddyfile`:

```
pablo.tudominio.es {
    reverse_proxy 127.0.0.1:3001
}
```

```bash
sudo apt install -y caddy && sudo systemctl reload caddy
```

**4. Firewall:** abre solo SSH, 80 y 443:

```bash
sudo ufw allow OpenSSH && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw enable
```

Para actualizar: `git pull && npm ci && npm run build && sudo systemctl restart pablo`.

## C. Vercel (cliente) + tu servidor (juego)

1. Monta el servidor como en la **opción B**, con su dominio y https (por ejemplo `api.tudominio.es`). Añade en el servicio:
   ```ini
   Environment=CORS_ORIGIN=https://tu-juego.vercel.app
   ```
   Si tienes dominio propio en Vercel, pon también ese, separado por comas.
2. En Vercel → **Add New → Project** → importa el repositorio. El fichero `vercel.json` ya configura la compilación y las cabeceras de seguridad.
3. **Environment Variables** en Vercel:
   - `VITE_SERVER_URL` = `https://api.tudominio.es`
   - Las `VITE_FIREBASE_*`, si usas cuentas
4. **Deploy.**

**El servidor tiene que tener https.** Una página de Vercel (https) no puede conectarse a un servidor `http://` o `ws://`: el navegador lo bloquea.

Si usas cuentas, añade el dominio de Vercel en Firebase → *Authentication → Settings → Authorized domains*.

## D. Docker

```bash
docker build -t pablo .
```

```bash
docker run -d --restart unless-stopped -p 127.0.0.1:3001:3001 -e TRUST_PROXY=1 pablo
```

Delante, un proxy con https (Caddy, como en la opción B). Con cuentas, las variables `VITE_*` se pasan al compilar: `docker build --build-arg VITE_FIREBASE_API_KEY=... -t pablo .`

## Variables de entorno

| Variable | Dónde | Para qué |
|---|---|---|
| `PORT` | servidor | Puerto (3001 por defecto; Render lo pone solo) |
| `TRUST_PROXY` | servidor | `1` si hay un proxy delante (Render, Caddy, nginx). **No** lo pongas sin proxy |
| `CORS_ORIGIN` | servidor | Dominios del cliente si está en otro sitio (Vercel) |
| `MAX_ROOMS` | servidor | Salas simultáneas como máximo (500) |
| `VITE_SERVER_URL` | compilación del cliente | URL del servidor si el cliente va aparte |
| `VITE_FIREBASE_*` | compilación del cliente | Cuentas de Google (opcional) |
| `VITE_CARD_IMAGES` | compilación del cliente | Imágenes propias de cartas (opcional) |

Antes de publicar, revisa la lista de [SEGURIDAD.md](SEGURIDAD.md).

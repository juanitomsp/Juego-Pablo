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

### Instalación automática (recomendada)

El script `scripts/instalar-servidor.sh` hace todos los pasos de abajo de una vez: Node, el juego, el servicio, https con Caddy y el firewall. Se puede volver a ejecutar sin problema.

1. Crea un registro **A** en tu dominio apuntando a la IP del servidor.
2. 💻 Entra en el servidor:
   ```bash
   ssh tu_usuario@IP_DEL_SERVIDOR
   ```
3. 🖥️ Pega esto, cambiando solo el dominio:
   ```bash
   curl -fsSL https://raw.githubusercontent.com/juanitomsp/Juego-Pablo/juego-pablo/scripts/instalar-servidor.sh -o instalar.sh && sudo DOMINIO=pablo.tudominio.es bash instalar.sh
   ```

Para actualizar después: `sudo bash /home/pablo/app/scripts/actualizar-servidor.sh`.

Si ya tienes **nginx o apache** usando los puertos 80/443, el script se detiene sin tocar nada. En ese caso, configura en ellos un proxy hacia `127.0.0.1:3001` (con soporte de WebSocket) y sigue los pasos manuales sin Caddy.

### Instalación manual, paso a paso

Se usan **dos terminales distintas**:

- 💻 **Tu ordenador** (PowerShell, o la terminal de VS Code, en la carpeta del proyecto): solo para subir el código a GitHub.
- 🖥️ **El servidor**: entras desde tu ordenador con `ssh` y, a partir de ahí, todo lo que escribes se ejecuta **en el servidor**.

### Paso 0 · Antes de empezar

- **Dominio:** en el panel de tu dominio, crea un registro **A** con el subdominio (p. ej. `pablo`) apuntando a la IP del servidor. Puede tardar unos minutos en funcionar.
- 💻 **Sube el código a GitHub.** El juego está en la rama `juego-pablo`: o la fusionas con `main` o la clonas indicando `-b juego-pablo`.
  ```bash
  git push -u origin juego-pablo
  ```
  Si el repositorio es **privado**, el servidor necesitará permiso para descargarlo (una *deploy key* de GitHub o un token). Con uno público no hace falta.

### Paso 1 · Entrar en el servidor

💻 En tu ordenador:

```bash
ssh tu_usuario@IP_DEL_SERVIDOR
```

El prompt cambiará a algo como `tu_usuario@servidor:~$`. Desde aquí, **todo es en el servidor** 🖥️.

### Paso 2 · Instalar Node 22 y el juego

🖥️ Servidor (un comando cada vez):

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
```

```bash
sudo apt-get install -y nodejs git
```

```bash
sudo useradd --system --create-home pablo
```

```bash
sudo -u pablo git clone -b juego-pablo https://github.com/TU_USUARIO/TU_REPO.git /home/pablo/app
```

```bash
cd /home/pablo/app && sudo -u pablo npm ci && sudo -u pablo npm run build
```

El usuario `pablo` es un usuario sin privilegios, solo para ejecutar el juego: si alguien encontrara un fallo, no tendría acceso al resto del servidor.

### Paso 3 · Que el juego arranque solo

🖥️ Servidor. Crea el fichero del servicio con el editor `nano`:

```bash
sudo nano /etc/systemd/system/pablo.service
```

Pega esto dentro (clic derecho o `Ctrl+Shift+V` en la mayoría de terminales):

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

Guarda con `Ctrl+O`, `Enter`, y sal con `Ctrl+X`. Luego:

```bash
sudo systemctl daemon-reload
```

```bash
sudo systemctl enable --now pablo
```

Comprueba que está en marcha (sal con `q`):

```bash
sudo systemctl status pablo
```

Debe poner `active (running)`.

### Paso 4 · HTTPS con Caddy

🖥️ Servidor. Primero instala Caddy:

```bash
sudo apt-get install -y caddy
```

> En Ubuntu 24.04 y Debian 12 viene en los repositorios. En versiones anteriores, sigue las instrucciones de <https://caddyserver.com/docs/install#debian-ubuntu-raspbian>.

Después, sustituye su configuración:

```bash
sudo nano /etc/caddy/Caddyfile
```

Borra lo que haya y deja solo esto, con **tu** dominio:

```
pablo.tudominio.es {
    reverse_proxy 127.0.0.1:3001
}
```

Guarda (`Ctrl+O`, `Enter`, `Ctrl+X`) y recarga:

```bash
sudo systemctl reload caddy
```

Caddy pide el certificado https automáticamente la primera vez que alguien entra.

### Paso 5 · Firewall

🖥️ Servidor. **Primero** se permite SSH, para no quedarte fuera:

```bash
sudo ufw allow OpenSSH
```

```bash
sudo ufw allow 80
```

```bash
sudo ufw allow 443
```

```bash
sudo ufw enable
```

Si tu proveedor (Hetzner, OVH, AWS…) tiene además un firewall en su panel web, abre ahí también los puertos 80 y 443.

### Paso 6 · Probar

En el navegador del móvil o del ordenador: `https://pablo.tudominio.es`.

Si no carga, mira el registro del juego en el servidor (sal con `Ctrl+C`):

```bash
sudo journalctl -u pablo -f
```

### Actualizar a una versión nueva

1. 💻 En tu ordenador, sube los cambios: `git push`.
2. 🖥️ En el servidor (tras entrar con `ssh`):
   ```bash
   cd /home/pablo/app && sudo -u pablo git pull && sudo -u pablo npm ci && sudo -u pablo npm run build && sudo systemctl restart pablo
   ```

Al reiniciar se cierran las salas abiertas: hazlo cuando nadie esté jugando.

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

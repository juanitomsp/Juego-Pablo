#!/usr/bin/env bash
# =============================================================================
#  Instalación de El Pablo en un servidor Ubuntu / Debian.
#
#  Dos modos:
#
#  A) Con dominio propio (https con Caddy, puertos 80/443 abiertos a internet):
#       sudo DOMINIO=pablo.tudominio.es bash instalar-servidor.sh
#
#  B) Sin dominio, con Tailscale Funnel (servidor en casa, sin abrir puertos del router):
#       sudo bash instalar-servidor.sh
#     El juego queda en https://NOMBRE-DEL-EQUIPO.TU-TAILNET.ts.net
#
#  Variables opcionales:
#    REPO=https://github.com/juanitomsp/Juego-Pablo.git   Repositorio a descargar
#    RAMA=juego-pablo                                       Rama
#    PUERTO=3001                                            Puerto interno de Node
#    CORS_ORIGIN=https://tu-juego.vercel.app                Web en otro dominio (Vercel) que puede conectarse
#    FIREWALL=si|no                                         Activar ufw (por defecto: si con dominio, no con Tailscale)
#
#  Se puede ejecutar varias veces: actualiza lo que ya exista.
#  Ver docs/DESPLIEGUE.md (opción B).
# =============================================================================
set -euo pipefail

DOMINIO="${DOMINIO:-}"
REPO="${REPO:-https://github.com/juanitomsp/Juego-Pablo.git}"
RAMA="${RAMA:-juego-pablo}"
PUERTO="${PUERTO:-3001}"
CORS_ORIGIN="${CORS_ORIGIN:-}"
USUARIO="pablo"
DIR="/home/$USUARIO/app"

verde() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }
aviso() { printf '\033[1;33m[!] %s\033[0m\n' "$*"; }
error() { printf '\033[1;31m[x] %s\033[0m\n' "$*" >&2; exit 1; }

# ----------------------------------------------------------------- Comprobaciones
[ "$(id -u)" -eq 0 ] || error "Ejecútalo con sudo:  sudo DOMINIO=tu.dominio.es bash $0"
command -v apt-get >/dev/null || error "Este script es para Ubuntu o Debian (necesita apt-get)."

if [ -n "$DOMINIO" ]; then
  MODO=caddy
  [[ "$DOMINIO" =~ ^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]] || error "El dominio '$DOMINIO' no parece válido (sin https:// ni barras)."
elif command -v tailscale >/dev/null && tailscale status >/dev/null 2>&1; then
  MODO=tailscale
else
  error "Indica un dominio (sudo DOMINIO=pablo.tudominio.es bash $0) o instala y conecta Tailscale para usar Funnel."
fi
FIREWALL="${FIREWALL:-$([ "$MODO" = caddy ] && echo si || echo no)}"
echo "Modo de publicación: $MODO"
if [ -n "$CORS_ORIGIN" ]; then
  for o in ${CORS_ORIGIN//,/ }; do
    [[ "$o" =~ ^https://[a-zA-Z0-9.-]+(:[0-9]+)?$ ]] || error "CORS_ORIGIN '$o' no es válido: debe ser https://dominio, sin barra final."
  done
  echo "Webs externas permitidas: $CORS_ORIGIN"
fi

if [ "$MODO" = caddy ]; then
# Si otro programa (nginx, apache...) ya usa los puertos 80/443, Caddy no podría arrancar.
OCUPADOS="$(ss -tlnpH '( sport = :80 or sport = :443 )' 2>/dev/null | grep -v caddy || true)"
if [ -n "$OCUPADOS" ]; then
  echo "$OCUPADOS"
  error "Los puertos 80/443 ya los usa otro programa (arriba). Este script usa Caddy; si ya tienes nginx o apache, configura allí un proxy a 127.0.0.1:$PUERTO (ver docs/DESPLIEGUE.md) en lugar de usar este script."
fi

# Aviso si el dominio no apunta todavía a este servidor (no detiene la instalación).
IP_PUBLICA="$(curl -fsS4 --max-time 5 https://api.ipify.org 2>/dev/null || true)"
IP_DOMINIO="$(getent ahostsv4 "$DOMINIO" 2>/dev/null | awk 'NR==1{print $1}' || true)"
if [ -n "$IP_PUBLICA" ] && [ "$IP_PUBLICA" != "$IP_DOMINIO" ]; then
  aviso "El dominio $DOMINIO apunta a '${IP_DOMINIO:-nada}', pero este servidor es $IP_PUBLICA."
  aviso "Crea un registro A en tu proveedor de dominio. Sin eso, https no funcionará (puedes seguir y se arreglará solo cuando apunte)."
fi
fi

# ----------------------------------------------------------------- Paquetes
verde "Instalando paquetes del sistema"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl ca-certificates gnupg git debian-keyring debian-archive-keyring apt-transport-https

NODE_MAYOR="$(node -v 2>/dev/null | sed -E 's/^v([0-9]+).*/\1/' || echo 0)"
if [ "${NODE_MAYOR:-0}" -lt 20 ]; then
  verde "Instalando Node.js 22"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
echo "Node $(node -v)"

if [ "$MODO" = caddy ] && ! command -v caddy >/dev/null; then
  verde "Instalando Caddy (servidor web con https automático)"
  if ! apt-cache policy caddy 2>/dev/null | grep -q 'Candidate: [0-9]'; then
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
    apt-get update -y
  fi
  apt-get install -y caddy
fi

# ----------------------------------------------------------------- Código
verde "Descargando el juego ($REPO, rama $RAMA)"
id "$USUARIO" >/dev/null 2>&1 || useradd --system --create-home --shell /usr/sbin/nologin "$USUARIO"
if [ -d "$DIR/.git" ]; then
  sudo -u "$USUARIO" git -C "$DIR" fetch --quiet origin "$RAMA"
  sudo -u "$USUARIO" git -C "$DIR" checkout --quiet "$RAMA"
  sudo -u "$USUARIO" git -C "$DIR" reset --hard --quiet "origin/$RAMA"
else
  sudo -u "$USUARIO" git clone --quiet -b "$RAMA" "$REPO" "$DIR" ||
    error "No se pudo descargar el repositorio. ¿Es público y existe la rama '$RAMA'?"
fi

verde "Instalando dependencias y compilando (puede tardar un par de minutos)"
cd "$DIR"
sudo -u "$USUARIO" npm ci --no-audit --no-fund
sudo -u "$USUARIO" npm run build

# ----------------------------------------------------------------- Contraseña del panel de control
# Se genera una vez y se guarda solo para root. El panel está en https://TU-DIRECCIÓN/#/admin
install -d -m 700 /etc/pablo
if [ ! -s /etc/pablo/admin-token ]; then
  head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n' > /etc/pablo/admin-token
  chmod 600 /etc/pablo/admin-token
fi
printf 'ADMIN_TOKEN=%s\n' "$(cat /etc/pablo/admin-token)" > /etc/pablo/pablo.env
chmod 600 /etc/pablo/pablo.env

# ----------------------------------------------------------------- Servicio
verde "Configurando el servicio para que arranque solo"
cat > /etc/systemd/system/pablo.service <<EOF
[Unit]
Description=El Pablo (juego de naipes)
After=network.target

[Service]
User=$USUARIO
WorkingDirectory=$DIR
Environment=NODE_ENV=production
Environment=PORT=$PUERTO
Environment=TRUST_PROXY=1
# Contraseña del panel de control (ADMIN_TOKEN)
EnvironmentFile=/etc/pablo/pablo.env
# Solo accesible a través del proxy (Caddy o Tailscale), nunca directamente desde fuera.
Environment=HOST=127.0.0.1
$( [ -n "$CORS_ORIGIN" ] && echo "Environment=CORS_ORIGIN=$CORS_ORIGIN" || true )
ExecStart=$(command -v node) dist/server/index.js
Restart=always
RestartSec=3
# Endurecimiento: el proceso no puede tocar el resto del sistema.
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=$DIR

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable pablo >/dev/null 2>&1
systemctl restart pablo

# ----------------------------------------------------------------- Publicación
if [ "$MODO" = caddy ]; then
verde "Configurando https para $DOMINIO"
CADDYFILE=/etc/caddy/Caddyfile
BLOQUE="$DOMINIO {
	encode gzip
	reverse_proxy 127.0.0.1:$PUERTO
}"
if [ -f "$CADDYFILE" ] && grep -q "^$DOMINIO" "$CADDYFILE"; then
  echo "El Caddyfile ya tiene $DOMINIO; no se toca."
elif [ ! -f "$CADDYFILE" ] || grep -qE '^:80' "$CADDYFILE"; then
  # Es la configuración de ejemplo que trae Caddy: se sustituye (guardando copia).
  [ -f "$CADDYFILE" ] && cp "$CADDYFILE" "$CADDYFILE.original"
  printf '%s\n' "$BLOQUE" > "$CADDYFILE"
else
  # Ya hay otros sitios configurados: se añade el nuestro al final sin borrar nada.
  cp "$CADDYFILE" "$CADDYFILE.antes-de-pablo"
  printf '\n%s\n' "$BLOQUE" >> "$CADDYFILE"
fi
caddy validate --config "$CADDYFILE" --adapter caddyfile >/dev/null || error "La configuración de Caddy no es válida. Revisa $CADDYFILE"
systemctl enable caddy >/dev/null 2>&1
systemctl reload caddy 2>/dev/null || systemctl restart caddy
URL="https://$DOMINIO"
else
  verde "Publicando con Tailscale Funnel"
  NOMBRE="$(tailscale status --json | python3 -c 'import sys, json; print(json.load(sys.stdin)["Self"]["DNSName"].rstrip("."))')"
  URL="https://$NOMBRE"
  echo "Si es la primera vez, Tailscale puede mostrar un enlace para activar Funnel en tu cuenta:"
  echo "ábrelo en el navegador, actívalo y el script continuará solo."
  if ! tailscale funnel --bg "$PUERTO"; then
    aviso "No se pudo activar Funnel. Entra en https://login.tailscale.com/admin/dns y activa 'HTTPS Certificates',"
    aviso "luego en https://login.tailscale.com/admin/acls permite Funnel para este equipo, y vuelve a ejecutar este script."
    exit 1
  fi
  tailscale funnel status || true
fi

# ----------------------------------------------------------------- Firewall
if [ "$FIREWALL" = "si" ]; then
  verde "Configurando el firewall"
  apt-get install -y ufw >/dev/null
  # Se permite SSH en el puerto que esté usando de verdad (para no quedarte fuera).
  for p in $(ss -tlnpH 2>/dev/null | awk '/sshd/ {n=split($4,a,":"); print a[n]}' | sort -u); do ufw allow "$p/tcp" >/dev/null; done
  ufw allow OpenSSH >/dev/null
  ufw allow 80/tcp >/dev/null
  ufw allow 443/tcp >/dev/null
  if ufw status | grep -q inactive; then
    ufw --force enable
    aviso "Firewall activado: solo quedan abiertos SSH, 80 y 443. Si tenías otros servicios públicos, ábrelos con:  sudo ufw allow PUERTO"
  fi
  ufw status
fi

# ----------------------------------------------------------------- Comprobación
verde "Comprobando que el juego responde"
for i in $(seq 1 15); do
  if curl -fsS "http://127.0.0.1:$PUERTO/api/health" >/dev/null 2>&1; then OK=1; break; fi
  sleep 1
done
[ "${OK:-0}" = 1 ] || error "El juego no arranca. Mira el registro con:  sudo journalctl -u pablo -n 50"

verde "¡Listo!"
echo "  Abre:        $URL"
echo "  Estado:      sudo systemctl status pablo"
echo "  Registro:    sudo journalctl -u pablo -f"
echo "  Actualizar:  sudo bash $DIR/scripts/actualizar-servidor.sh"
echo "  Panel:       $URL/#/admin   (contraseña: sudo cat /etc/pablo/admin-token)"
if [ "$MODO" = caddy ]; then
  echo
  echo "  Si tu proveedor (Hetzner, OVH, AWS, Oracle...) tiene un firewall en su panel web,"
  echo "  abre allí también los puertos 80 y 443."
else
  echo
  echo "  La primera visita puede tardar unos segundos mientras Tailscale genera el certificado https."
fi

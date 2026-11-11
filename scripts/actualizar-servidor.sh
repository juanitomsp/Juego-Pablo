#!/usr/bin/env bash
# =============================================================================
#  Actualiza El Pablo en el servidor a la última versión de GitHub.
#
#  Uso (en el servidor):   sudo bash /home/pablo/app/scripts/actualizar-servidor.sh
#
#  Ojo: al reiniciar se cierran las salas abiertas. Hazlo cuando nadie juegue.
# =============================================================================
set -euo pipefail

USUARIO="pablo"
DIR="/home/$USUARIO/app"

[ "$(id -u)" -eq 0 ] || { echo "Ejecútalo con sudo: sudo bash $0"; exit 1; }
[ -d "$DIR/.git" ] || { echo "No encuentro el juego en $DIR. Instálalo primero con instalar-servidor.sh"; exit 1; }

cd "$DIR"
RAMA="$(sudo -u "$USUARIO" git rev-parse --abbrev-ref HEAD)"
ANTES="$(sudo -u "$USUARIO" git rev-parse --short HEAD)"

echo "==> Descargando cambios de la rama $RAMA"
sudo -u "$USUARIO" git fetch --quiet origin "$RAMA"
sudo -u "$USUARIO" git reset --hard --quiet "origin/$RAMA"
DESPUES="$(sudo -u "$USUARIO" git rev-parse --short HEAD)"

if [ "$ANTES" = "$DESPUES" ] && [ "${1:-}" != "--forzar" ]; then
  echo "Ya estabas en la última versión ($DESPUES). Para recompilar igualmente: sudo bash $0 --forzar"
  exit 0
fi

echo "==> Compilando ($ANTES -> $DESPUES)"
sudo -u "$USUARIO" npm ci --no-audit --no-fund
sudo -u "$USUARIO" npm run build

echo "==> Reiniciando el juego"
systemctl restart pablo
sleep 2
if curl -fsS http://127.0.0.1:3001/api/health >/dev/null 2>&1; then
  echo "¡Actualizado y funcionando! Versión $DESPUES"
else
  echo "El juego no responde. Mira: sudo journalctl -u pablo -n 50"
  exit 1
fi

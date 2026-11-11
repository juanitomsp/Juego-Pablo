# Panel del servidor

Página para saber si el servidor va holgado o hay que pasarse a uno más grande: **`https://TU-SERVIDOR/#/admin`** (también funciona dentro de las apps).

## Acceso

- Pide la **contraseña del panel** (`ADMIN_TOKEN`). El script de instalación la genera sola. Para verla, en el servidor:
  ```bash
  sudo cat /etc/pablo/admin-token
  ```
- La contraseña se guarda solo en el dispositivo desde el que entras. Botón «Salir» para olvidarla.
- Si el servidor no tiene `ADMIN_TOKEN`, el panel está desactivado. Los intentos con contraseña incorrecta se limitan a 10 seguidos por dirección IP (después, 1 por minuto).
- **Servidor ya instalado antes de esta versión:** vuelve a ejecutar el script de instalación (`sudo bash instalar.sh`, como la primera vez) para que cree la contraseña. Con el de actualizar no basta.

## Qué muestra

| Dato | Qué significa |
|---|---|
| **Estado** (✅ Bien / ⚠️ Vigilar / ⛔ Ampliar) | Resumen y motivos, a partir de los picos de la última hora |
| Jugadores conectados | Ahora y pico de las últimas 24 h |
| Jugando ahora | Personas en partidas en curso y salas abiertas |
| Memoria en uso | % de la RAM del servidor ocupada (sin contar la caché que el sistema libera) y cuánto usa el juego |
| CPU | Carga media del último minuto respecto a los núcleos |
| Retardo | Cuánto se retrasa el servidor al atender mensajes. Por encima de 80 ms se notan tirones |
| Capacidad estimada | Cuántos jugadores a la vez cabrían con la memoria libre, según lo que gasta cada uno |

Gráficas de las últimas 24 h o 7 días (máximo de cada tramo) y tabla con los datos. Se guarda una muestra por minuto, en memoria: **al reiniciar el servidor se pierde el historial**.

## Cuándo ampliar

| Estado | Memoria | CPU | Retardo | Qué hacer |
|---|---|---|---|---|
| ⚠️ Vigilar | ≥ 70 % | ≥ 65 % | ≥ 80 ms | Mira opciones y precios |
| ⛔ Ampliar | ≥ 85 % | ≥ 85 % | ≥ 200 ms | Pasa a un servidor con el doble de RAM |

Y antes de llegar ahí: si la **capacidad estimada** se acerca a vuestro **pico de jugadores**, amplía.

Con 1 GB de RAM, el sistema operativo y Tailscale ya ocupan una parte. El juego gasta poco por jugador (del orden de 0,5–1 MB), así que el límite real suele marcarlo la memoria del sistema. Por eso conviene mirar la «Memoria en uso» y no solo lo que usa el juego.

## Para ampliar

1. Contrata un servidor con más RAM (por ejemplo, un VPS de 2–4 GB).
2. Instala con el script (`docs/DESPLIEGUE.md`), con dominio propio o con Tailscale.
3. Si cambia la dirección, actualiza `VITE_SERVER_URL` y vuelve a compilar las apps (`docs/APPS_MOVILES.md`).

## Para programadores

- Métricas: `src/server/metrics.ts`. Ruta protegida `GET /api/admin/metrics?range=24h|7d` con `Authorization: Bearer <ADMIN_TOKEN>`.
- Pantalla: `src/client/screens/AdminScreen.tsx`.

# Panel del servidor

Web **aparte del juego** para ver la carga del servidor y cuánta gente juega. **Solo puedes entrar tú.**

## Cómo entrar

- El servidor la abre **solo en la propia máquina** (`127.0.0.1:3010`): desde internet no se puede llegar.
- El script de instalación la publica **solo en tu red de Tailscale** (`tailscale serve`, nunca con Funnel). Ábrela desde un dispositivo tuyo con Tailscale:
  **`https://servidor.taile44b8a.ts.net:8443`**
- No necesita contraseña: para cualquiera que no esté en tu Tailscale, esa dirección no existe.
- Sin Tailscale (servidor con dominio), usa un túnel SSH desde tu ordenador: `ssh -L 3010:127.0.0.1:3010 TU_SERVIDOR` y abre `http://localhost:3010`.
- Para dejar de publicarla: `sudo tailscale serve --https=8443 off`.

## Coste estimado al mes

Calcula lo que cuesta la luz de tener el servidor encendido las 24 h:

- **Consumo medio** = consumo en reposo + (consumo a tope − reposo) × CPU media que usa el juego.
- **Total al mes** = consumo medio × 730 h × precio de la luz + otros gastos (dominio, etc.).
- **Lo que añade el juego**: solo la parte que gasta de más por estar jugando gente. Si el ordenador ya lo tenías encendido igualmente, este es tu coste real.

Los valores por defecto son los de la torre del servidor (HP Slimline con Core i3): unos 12 W en reposo, calculados a partir del consumo del procesador medido en Ubuntu (~1 W con 6 personas jugando), 60 W a tope y la luz a 0,15 €/kWh (precio típico en España). Ajústalos con «Ajustar consumo y precio»: el precio viene en tu factura y los vatios reales se miden con un enchufe medidor de consumo. Se guardan solo en el navegador desde el que abres el panel. No incluye la parte fija de la factura (potencia contratada).

## Uso del juego (beta)

Arriba del panel verás cuánta gente juega de verdad. Sirve para decidir si merece la pena publicar en las tiendas o dar más pasos.

| Dato | Qué significa |
|---|---|
| Jugadores este mes | Jugadores distintos que han entrado en alguna sala (aproximado) |
| Partidas este mes | Partidas online empezadas, y cuántas se terminaron |
| Manos este mes | Manos repartidas |
| Partidas contra bots este mes | Partidas de práctica empezadas (las avisa el juego de forma anónima si hay conexión), terminadas y manos |
| Entradas en salas | Veces que alguien entra en una sala (incluye reconexiones) |
| Reportes este mes | Veces que un jugador ha reportado a otro, y expulsiones por reportes |

Debajo, gráficas de jugadores por mes y por día (últimos 30 días) y una tabla por meses.

**Es anónimo:** en el servidor solo se guardan totales, en `data/uso.json` (sin nombres, identificadores ni IP). Para contar jugadores distintos se usa en memoria una huella cifrada con una clave al azar que nunca se guarda; al reiniciar el servidor se olvida. Por eso, si se reinicia a mitad de mes, alguien puede contarse dos veces. Las partidas de práctica jugadas sin conexión no se cuentan. De los reportes solo se guarda el total: nunca quién reportó a quién.

## Carga del servidor


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
- Web del panel: carpeta `admin/` (se compila a `dist/admin`; en desarrollo, `npm run dev:admin`).

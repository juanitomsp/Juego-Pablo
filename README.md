# El Pablo · juego de naipes

Versión digital del **Pablo (Paulo)**, juego de naipes tradicional de Andalucía oriental (Níjar, Mairena del Alcor).

- **Online con amigos:** salas con código o enlace, 4 o 6 jugadores, huecos rellenables con bots, sorteo de equipos por reyes, señas privadas al compañero, reconexión.
- **Práctica contra bots:** funciona en el navegador, sin servidor.
- **Marcador en vivo:** para jugar con baraja física y llevar en el móvil puntos, cuernos, Pablos, valor de la mano y quién es mano.
- **Reglas y orden de triunfos** dentro del juego.
- **Estadísticas:** en el navegador sin cuenta; opcionalmente en la nube con cuenta de Google (Firebase).

## Puesta en marcha

Requisitos: Node.js 20 o superior.

```bash
npm install
```

```bash
npm run dev
```

Abre <http://localhost:5173>. Arranca a la vez el servidor de juego (puerto 3001) y el cliente (Vite, puerto 5173).

| Comando | Qué hace |
|---|---|
| `npm run dev` | Desarrollo con recarga automática |
| `npm test` | Tests del motor de reglas (Vitest) |
| `npm run typecheck` | Comprobación de tipos |
| `npm run build` | Compila cliente (`dist/client`) y servidor (`dist/server`) |
| `npm start` | Producción: un único proceso Node sirve el juego en `PORT` (3001) |
| `npx tsx scripts/bot-client.ts CODIGO` | Mete un «jugador» automático en una sala online, para probar |

## Documentación

| Documento | Contenido |
|---|---|
| [docs/REGLAS.md](docs/REGLAS.md) | Reglas tal como las aplica el juego y decisiones de interpretación (también se ve dentro del juego) |
| [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md) | Estructura del código, motor de reglas, servidor, cliente, bots |
| [docs/PROTOCOLO.md](docs/PROTOCOLO.md) | Mensajes entre cliente y servidor (Socket.IO) |
| [docs/CUENTAS_Y_DATOS.md](docs/CUENTAS_Y_DATOS.md) | Qué datos se guardan, dónde, y cómo activar las cuentas de Google |
| [docs/DESPLIEGUE.md](docs/DESPLIEGUE.md) | Cómo publicarlo (Render, Railway, Fly.io, Docker, Vercel) |
| [docs/PUBLICACION.md](docs/PUBLICACION.md) | Lista de comprobación legal y de producto antes de publicar |
| [docs/PRIVACIDAD.md](docs/PRIVACIDAD.md) | Plantilla de política de privacidad (también dentro del juego) |

## Estructura

```
src/shared/engine/   Motor de reglas puro (cartas, mano, partida, vista por jugador, bots, sorteo)
src/shared/table.ts  Partida en marcha con bots y temporizadores (servidor y práctica local)
src/shared/protocol.ts  Tipos de los mensajes cliente/servidor
src/server/          Servidor Express + Socket.IO, salas en memoria
src/client/          Aplicación React (pantallas, mesa, servicios)
tests/               Tests del motor
docs/                Documentación
scripts/             Herramientas de desarrollo
```

## Licencias

El texto de las reglas deriva del artículo «Paulo (juego de naipes)» de Wikipedia (CC BY-SA 4.0); ver el pie de `docs/REGLAS.md`. Los dibujos de los palos son propios. La licencia del código está pendiente de decidir (ver `docs/PUBLICACION.md`).

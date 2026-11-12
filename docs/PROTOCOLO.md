# Protocolo cliente ↔ servidor

Transporte: **Socket.IO** en la misma URL que el juego (o `VITE_SERVER_URL`). Los tipos exactos están en `src/shared/protocol.ts`.

Todos los mensajes del cliente que esperan respuesta usan *ack*: `{ ok: true, ... }` o `{ ok: false, error: "mensaje en español" }`.

## Cliente → servidor

| Evento | Datos | Quién | Efecto |
|---|---|---|---|
| `room:create` | `{ name, playerId, config, isPublic? }` | cualquiera | Crea sala (privada por defecto) y entra como anfitrión. Ack: `{ code }` |
| `room:join` | `{ code, name, playerId, watch? }` | cualquiera | Entra (o vuelve) a una sala. Se sienta en el primer hueco si la partida no ha empezado (salvo con `watch: true`); si ya empezó y no tenía asiento, entra como espectador |
| `room:visibility` | `{ isPublic }` | anfitrión | Hace la sala pública (sale en la lista) o privada (solo con código) |
| `room:leave` | — | miembro | Sale de la sala (libera el asiento si no ha empezado) |
| `room:sit` | `{ seat }` | miembro | Cambia de asiento (antes de empezar) |
| `room:addBot` | `{ seat }` | anfitrión | Pone un bot en un hueco |
| `room:clearSeat` | `{ seat }` | anfitrión | Vacía un asiento |
| `room:config` | `Partial<GameConfig>` | anfitrión | Cambia opciones (valores saneados y acotados) |
| `room:drawTeams` | — | anfitrión | Sorteo de equipos por reyes |
| `room:start` | — | anfitrión | Empieza la partida (todos los asientos ocupados) |
| `room:replaceWithBot` | `{ seat }` | anfitrión | Sustituye a un jugador desconectado por un bot |
| `game:action` | `Action` | jugador | `deal`, `play {card}`, `bet`, `accept`, `reject`, `quiero {play}` |
| `game:quick` | `{ index }` | jugador | Frase rápida predefinida |
| `game:chat` | `{ text }` | jugador (los espectadores no pueden escribir) | Mensaje libre para toda la mesa (máx. 140 caracteres, 1 por segundo). El servidor tacha las palabras que nombran cartas (`src/shared/chat.ts`) y lo reenvía como `quick` |
| `game:rematch` | — | jugador | Nueva partida con la misma mesa al terminar |

## Servidor → cliente

| Evento | Datos | Cuándo |
|---|---|---|
| `state` | `{ room: RoomInfo, view: PlayerView \| null }` | Tras cualquier cambio. Cada jugador recibe **su** vista |
| `quick` | `{ from, text, at }` | A toda la sala (frases rápidas y chat ya censurado) |

## Espectadores y partidas públicas

- Un **espectador** es un miembro de la sala sin asiento. Recibe la vista con `you: null`: ve la mesa, las bazas y el marcador, pero **ninguna carta en mano** de nadie. No puede jugar ni escribir en el chat (sí lo lee).
- `RoomInfo.spectators` es el número de espectadores conectados (el ojo 👁 de la mesa) y `RoomInfo.isPublic` indica si la sala es pública.
- `GET /api/salas` devuelve `{ rooms: PublicRoom[] }`: las salas públicas con alguien conectado y sin terminar (código, 4/6 jugadores, asientos ocupados, empezada, espectadores y marcador). **No incluye apodos.** Limitado por IP.
- Rutas del cliente: `#/publicas` (lista), `#/sala/CÓDIGO` (jugar) y `#/ver/CÓDIGO` (entrar solo a mirar).

## Seguridad

- El servidor es la **autoridad**: valida cada acción con el motor. Un cliente modificado no puede jugar cartas ilegales ni ver cartas ajenas (no se le envían).
- Todo lo que llega del cliente se valida y se reconstruye (`src/server/security.ts`) antes de usarlo; los campos desconocidos se descartan.
- Apodos y nombres de equipo: máximo 20 caracteres, sin caracteres de control ni `<>`.
- `playerId` debe ser un identificador alfanumérico de 8–64 caracteres. Funciona como «token» del asiento: no se comparte con otros clientes.
- Códigos de sala: 6 caracteres. Límites de frecuencia por conexión y por IP. Detalles en [SEGURIDAD.md](SEGURIDAD.md).

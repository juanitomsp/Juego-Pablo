# Protocolo cliente ↔ servidor

Transporte: **Socket.IO** en la misma URL que el juego (o `VITE_SERVER_URL`). Los tipos exactos están en `src/shared/protocol.ts`.

Todos los mensajes del cliente que esperan respuesta usan *ack*: `{ ok: true, ... }` o `{ ok: false, error: "mensaje en español" }`.

## Cliente → servidor

| Evento | Datos | Quién | Efecto |
|---|---|---|---|
| `room:create` | `{ name, playerId, config }` | cualquiera | Crea sala y entra como anfitrión. Ack: `{ code }` |
| `room:join` | `{ code, name, playerId }` | cualquiera | Entra (o vuelve) a una sala. Se sienta en el primer hueco si la partida no ha empezado; si ya empezó y no tenía asiento, mira |
| `room:leave` | — | miembro | Sale de la sala (libera el asiento si no ha empezado) |
| `room:sit` | `{ seat }` | miembro | Cambia de asiento (antes de empezar) |
| `room:addBot` | `{ seat }` | anfitrión | Pone un bot en un hueco |
| `room:clearSeat` | `{ seat }` | anfitrión | Vacía un asiento |
| `room:config` | `Partial<GameConfig>` | anfitrión | Cambia opciones (valores saneados y acotados) |
| `room:drawTeams` | — | anfitrión | Sorteo de equipos por reyes |
| `room:start` | — | anfitrión | Empieza la partida (todos los asientos ocupados) |
| `room:replaceWithBot` | `{ seat }` | anfitrión | Sustituye a un jugador desconectado por un bot |
| `game:action` | `Action` | jugador | `deal`, `requestCarteta`, `play {card}`, `bet`, `accept`, `reject`, `fold`, `quiero {play}` |
| `game:sena` | `{ sena }` | jugador | Seña a los compañeros |
| `game:quick` | `{ index }` | jugador | Frase rápida predefinida |
| `game:chat` | `{ text }` | jugador | Mensaje libre para toda la mesa (máx. 140 caracteres, 1 por segundo). El servidor tacha las palabras que nombran cartas (`src/shared/chat.ts`) y lo reenvía como `quick` |
| `game:rematch` | — | jugador | Nueva partida con la misma mesa al terminar |

## Servidor → cliente

| Evento | Datos | Cuándo |
|---|---|---|
| `state` | `{ room: RoomInfo, view: PlayerView \| null }` | Tras cualquier cambio. Cada jugador recibe **su** vista |
| `sena` | `{ from, sena, at }` | Solo a los compañeros del que hace la seña |
| `quick` | `{ from, text, at }` | A toda la sala (frases rápidas y chat ya censurado) |

## Seguridad

- El servidor es la **autoridad**: valida cada acción con el motor. Un cliente modificado no puede jugar cartas ilegales ni ver cartas ajenas (no se le envían).
- Todo lo que llega del cliente se valida y se reconstruye (`src/server/security.ts`) antes de usarlo; los campos desconocidos se descartan.
- Apodos y nombres de equipo: máximo 20 caracteres, sin caracteres de control ni `<>`.
- `playerId` debe ser un identificador alfanumérico de 8–64 caracteres. Funciona como «token» del asiento: no se comparte con otros clientes.
- Códigos de sala: 6 caracteres. Límites de frecuencia por conexión y por IP. Detalles en [SEGURIDAD.md](SEGURIDAD.md).

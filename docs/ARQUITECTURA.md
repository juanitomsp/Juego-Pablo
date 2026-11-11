# Arquitectura

## Visión general

```
┌────────────── Navegador (React) ──────────────┐        ┌──────── Servidor Node ────────┐
│ Pantallas ─ Table ─ Controller                │        │ Express (sirve dist/client)    │
│                     ├─ OnlineController ──────┼─ WS ──▶│ Socket.IO ─ RoomManager ─ Room │
│                     └─ LocalController        │        │                       └ GameTable
│                          └ GameTable (local)  │        │                            └ motor
│ Servicios: identity, stats, firebase ─────────┼──▶ Firebase Auth + Firestore (opcional)
└───────────────────────────────────────────────┘        └────────────────────────────────┘
```

Todo es **TypeScript**. El mismo motor de reglas (`src/shared/engine`) se usa en el servidor (partidas online, autoridad) y en el navegador (práctica sin conexión).

## Motor de reglas (`src/shared/engine`)

Funciones **puras y deterministas** (el azar entra por un parámetro `rng`, así los tests son reproducibles).

| Fichero | Responsabilidad |
|---|---|
| `cards.ts` | Baraja según jugadores, triunfos, fuerza de cartas, ganador de baza, cartas legales (asistir) |
| `types.ts` | `GameConfig`, `Action`, equipos (`teamOf`: asiento par = equipo 0), señas, frases rápidas |
| `hand.ts` | Una mano: reparto (incluida la retención a 6), bazas, apuestas, irse, decisión al quiero |
| `match.ts` | Partida: puntos → cuernos → Pablos, rotación del mano, quiero, historial, eventos. `applyAction()` y `advance()` |
| `view.ts` | `getView(match, asiento)`: lo que puede ver un jugador (oculta cartas ajenas y el mazo) |
| `bot.ts` | Jugador automático que decide **solo con su vista** (no hace trampas) |
| `teams.ts` | Sorteo de equipos por reyes |

Flujo de estados de la partida (`MatchState.phase`):

```
deal ──(el mano reparte)──▶ hand ──(fin de la mano)──▶ handEnd ──advance()──▶ deal
                                                                   └──▶ finished (alguien llega a los Pablos)
```

Dentro de una mano (`HandState.phase`): `quiero` (si hay un equipo al quiero) → `playing` ⇄ `bet` (apuesta pendiente) → `done`.

`applyAction` clona el estado (`structuredClone`) y lanza `RuleError` con un mensaje en español si la acción no es válida. Así el servidor nunca queda en un estado incoherente.

## GameTable (`src/shared/table.ts`)

Envuelve un `MatchState` con:

- **Bots:** tras cada cambio, programa la acción del bot que deba actuar (`setTimeout`), con pausas para que se vea la baza.
- **Decisiones de equipo:** si un equipo tiene un humano, los bots de ese equipo no aceptan/rechazan apuestas ni deciden el quiero por él.
- **Señas de bots:** al recibir cartas, cada bot hace una seña a su equipo con su mejor triunfo.
- Paso automático de `handEnd` a la siguiente mano.

## Servidor (`src/server`)

- `index.ts`: arranque (lee variables de entorno).
- `app.ts`: `createGameServer()`: Express + Socket.IO, cabeceras de seguridad, límites de frecuencia, validación de mensajes. Sirve el cliente compilado y `/api/health`.
- `security.ts`: validadores, limitadores y comprobación de origen (ver `SEGURIDAD.md`).
- `rooms.ts`: `RoomManager` y `Room`. Salas **en memoria** con código de 5 caracteres. Se borran tras 15 min vacías o 3 h sin actividad.
- Identificación: cada navegador genera un `playerId` aleatorio (localStorage). Con él se recupera el asiento al reconectar. Nunca se envía a otros jugadores.
- Tras cada cambio, cada miembro recibe **su propia vista** (`state`). Las señas solo se envían a los compañeros.
- El anfitrión puede sustituir por un bot a un jugador desconectado.

> Limitación conocida: al reiniciar el servidor se pierden las partidas en curso, y no se puede escalar a varias instancias sin un almacén compartido (p. ej. Redis + adaptador de Socket.IO). Ver la hoja de ruta en `PUBLICACION.md`.

## Cliente (`src/client`)

- `App.tsx`: router por hash (`#/sala/CODIGO`, `#/practica`, `#/vivo`, `#/reglas`, `#/estadisticas`, `#/privacidad`). El hash permite alojar el cliente en cualquier hosting estático.
- `services/controller.ts`: interfaz `Controller` con dos implementaciones, `OnlineController` (Socket.IO) y `LocalController` (GameTable en el navegador). La mesa no sabe cuál usa.
- `components/Table.tsx`: la mesa (marcador, asientos, baza, mano propia, acciones, señas, frases, historial, orden de triunfos).
- `components/CardView.tsx`: cartas y palos dibujados en SVG propio.
- `screens/`: Inicio, Sala, Práctica, Marcador en vivo, Estadísticas, páginas de documentación.
- `services/stats.ts` y `services/firebase.ts`: estadísticas (ver `CUENTAS_Y_DATOS.md`).
- Las reglas y la privacidad dentro del juego se cargan de `docs/*.md` (`?raw` de Vite): **una sola fuente de verdad**.

## Bots

Heurísticas sencillas (`bot.ts`):

- **Salir:** con 3+ triunfos y uno muy alto, avarea de grande; si no, un rey de otro palo o la carta más baja.
- **Asistir:** si el compañero va ganando con una carta fuerte, echa la más baja; si no, gana con la carta más barata que pueda.
- **Apostar:** con mano fuerte (fuerza > 0,6) o si el rival está al quiero; algún farol ocasional.
- **Responder apuestas:** según la fuerza de su mano y las bazas que lleve su equipo.

## Tests

`tests/engine.test.ts` cubre baraja, orden de cartas, carta libre, arrastre y renuncio (incluidos el Pablo y el Tuerto), reparto a 4 y 6, apuestas, irse, quiero y quiero forzoso, cuernos y Pablos, chat censurado, que la vista no filtre cartas ajenas, sorteo por reyes, y **partidas completas entre bots** a 4 y 6 jugadores con varias semillas.

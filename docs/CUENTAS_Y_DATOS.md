# Cuentas y datos

## Resumen: qué se guarda y dónde

| Dato | Dónde | Quién lo ve | Cuánto dura |
|---|---|---|---|
| Identificador aleatorio del navegador (`pablo.playerId`) | localStorage del navegador | Solo el servidor durante la partida | Hasta que se borre |
| Apodo (`pablo.name`) | localStorage + memoria del servidor mientras dura la sala | Jugadores de tu mesa | Sala: hasta 3 h de inactividad |
| Estado de la partida online | **Memoria** del servidor (sin base de datos) | Cada jugador ve solo su parte | Se borra al cerrar la sala o reiniciar el servidor |
| Resumen de partidas terminadas (`pablo.matches`) | localStorage | Solo tú | Hasta que lo borres |
| Marcador en vivo (`pablo.live`) | localStorage | Solo tú | Hasta que lo borres |
| Cuenta de Google *(opcional)* | Firebase Authentication (Google) | Tú y el administrador del proyecto Firebase | Hasta que borres la cuenta |
| Resumen de partidas *(con cuenta)* | Cloud Firestore: `users/{uid}/matches/{id}` | Solo tú (reglas de `firestore.rules`) | Hasta que borres la cuenta |

**No hay base de datos propia** ni se guardan emails en el juego. El servidor de juego no escribe nada en disco.

## Por qué Firebase

Querías poder registrar a los jugadores sin gestionar tú los datos. Con Firebase:

- **Google** gestiona contraseñas, inicio de sesión, seguridad y almacenamiento (es el *encargado del tratamiento*).
- Tú sigues siendo el **responsable del tratamiento** a efectos del RGPD: necesitas política de privacidad, atender solicitudes de borrado, etc. El juego ya lo facilita: botones de *Descargar mis datos* y *Borrar mi cuenta y mis datos*.
- Se aplica **minimización**: solo se guardan números de cada partida, nunca nombres de otros jugadores.
- El plan gratuito (Spark) sobra para empezar.

## Cómo activar las cuentas de Google

1. Entra en <https://console.firebase.google.com> y crea un proyecto (puedes desactivar Google Analytics).
2. **Authentication → Sign-in method → Google → Habilitar.** Pon un email de asistencia.
3. **Authentication → Settings → Authorized domains:** añade el dominio donde publiques el juego (p. ej. `tu-juego.onrender.com`). `localhost` ya viene.
4. **Firestore Database → Crear base de datos** en modo producción, ubicación **europe-west** (p. ej. `eur3` o `europe-southwest1`, Madrid).
5. **Reglas:** copia el contenido de [`firestore.rules`](../firestore.rules) en *Firestore → Reglas* y publica (o usa `firebase deploy --only firestore:rules` con Firebase CLI).
6. **Configuración del proyecto → Tus apps → Web (`</>`)**: registra una app y copia `apiKey`, `authDomain`, `projectId` y `appId`.
7. Crea un fichero `.env` (a partir de `.env.example`) con:
   ```
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=...
   VITE_FIREBASE_PROJECT_ID=...
   VITE_FIREBASE_APP_ID=...
   ```
   En producción, pon esas mismas variables en tu hosting **antes de compilar** (Vite las incrusta en el build).
8. Reinicia `npm run dev`. En *Estadísticas* aparecerá **Entrar con Google**.

> La configuración web de Firebase no es un secreto: puede estar en el navegador. Lo que protege los datos son las **reglas de Firestore**.

## Modelo de datos en Firestore

```
users/{uid}/matches/{matchId}
  id: string          // igual que matchId
  date: string        // ISO 8601
  mode: 'online' | 'practica' | 'vivo'
  players: 4 | 6
  won: boolean | null
  pablos: [mios, rivales]
  hands, handsWon, tricksWon, betsMade, betsWon, cartetas: number
```

## Limitación: las estadísticas las escribe el cliente

Ahora mismo, cada jugador guarda sus propias estadísticas desde el navegador. Un usuario con conocimientos podría falsear **sus propios** números (no los de otros). Para rankings públicos habría que hacer que el **servidor** las escriba con `firebase-admin`, verificando el *ID token* del jugador al entrar en la sala. Está en la hoja de ruta (`PUBLICACION.md`).

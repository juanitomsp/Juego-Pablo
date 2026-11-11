# Apps de iPhone y Android

Las apps son el mismo juego web empaquetado con **Capacitor** (carpetas `ios/` y `android/`). Todo lo que se cambia en el juego llega a las apps al volver a compilarlas.

## Qué tienen las apps además de la web

| Función | Cómo funciona | Código |
|---|---|---|
| **Anuncio al entrar** | Formato «anuncio de apertura» de AdMob: el único que Google permite mostrar al abrir la app. Sale sobre la pantalla de carga y, si tarda más de 4 s, se entra sin anuncio. No sale la primera vez tras instalar (lo recomienda Google) ni al volver a la app en mitad de una partida. Al volver tras más de 30 min fuera, sale otra vez | `src/client/native/startup.ts`, `ads.ts`; plugin nativo `AppOpenAdPlugin` (Android: `android/app/src/main/java/es/elpablo/juego/AppOpenAdPlugin.java`; iPhone: `ios/App/App/AppDelegate.swift`) |
| **Consentimiento de anuncios** | Formulario de Google (UMP) en Europa; en iPhone, además, el permiso de seguimiento (ATT). Botón «Privacidad de los anuncios» en Estadísticas | `src/client/native/ads.ts` |
| **Cuentas** | Entrar con **Google** (iPhone y Android) y **Apple** (iPhone; Apple lo exige si se ofrece Google). Ventana nativa; la sesión se pasa a Firebase | `src/client/services/firebase.ts` |
| **Botón atrás de Android** | Navega dentro del juego; en la portada, cierra la app | `startup.ts` |

En la web no se muestra ningún anuncio.

## Compilar

### Sin instalar nada (GitHub)

Cada `git push` a `main` o `juego-pablo` lanza **GitHub → Actions → «Apps móviles»**:

- **Android:** genera `el-pablo-android-prueba` (un `.apk` que se instala directamente en el móvil) y, si están los secretos de la clave de firma, `el-pablo-android-google-play` (el `.aab` para subir a Google Play).
- **iPhone:** comprueba que la app compila. Para instalarla o publicarla hace falta firmarla con una cuenta de Apple Developer (ver abajo).

Los ficheros se descargan en la ejecución, apartado **Artifacts**.

### En tu ordenador

```bash
npm run build:app
```

Construye el juego, lo copia a `android/` e `ios/` y aplica la configuración nativa. Después:

- Android: `npm run app:android` (abre Android Studio).
- iPhone: `npm run app:ios` (solo en un Mac con Xcode).

## Configuración

| Qué | Dónde | Por defecto |
|---|---|---|
| Servidor de partidas | `VITE_SERVER_URL` en `.env.app` o en las *Variables* de GitHub | `https://servidor.taile44b8a.ts.net` |
| ID de la app en AdMob | `ADMOB_APP_ID_ANDROID` / `ADMOB_APP_ID_IOS` (variables de GitHub) | IDs de **prueba** de Google |
| Bloque del anuncio de apertura | `VITE_ADMOB_APP_OPEN_ANDROID` / `VITE_ADMOB_APP_OPEN_IOS` | Bloques de **prueba** de Google |
| Firebase (cuentas) | `VITE_FIREBASE_*` + secretos `GOOGLE_SERVICES_JSON` (Android) y `GOOGLE_SERVICE_INFO_PLIST` (iPhone) | Sin cuentas |
| Identificador de la app | `appId` en `capacitor.config.json` | `es.elpablo.juego` (**no se puede cambiar una vez publicada**) |

> Mientras se usan los IDs de prueba, los anuncios dicen «Test Ad» y no generan dinero. **No pongas los IDs reales hasta tener la app en la tienda**: pulsar tus propios anuncios reales puede hacer que AdMob cierre tu cuenta.

El servidor ya acepta conexiones de las apps (`capacitor://localhost` y `https://localhost`).

## Lo que tienes que hacer tú

Esto no lo puedo hacer yo: son cuentas a tu nombre, pagos, datos personales o firmas.

### 1. Firebase (cuentas de jugadores)

1. Sigue `docs/CUENTAS_Y_DATOS.md` para crear el proyecto y activar **Google** como proveedor.
2. Activa también **Apple**: *Authentication → Sign-in method → Apple*.
3. *Configuración del proyecto → Tus apps*: añade una app **Android** con el paquete `es.elpablo.juego` y la huella **SHA-1** de tu clave de firma (y la de Google Play App Signing). Descarga `google-services.json`.
4. Añade una app **iOS** con el *bundle ID* `es.elpablo.juego`. Descarga `GoogleService-Info.plist`.
5. En GitHub → *Settings → Secrets and variables → Actions*:
   - Secretos: `GOOGLE_SERVICES_JSON` (contenido de `google-services.json`) y `GOOGLE_SERVICE_INFO_PLIST` (contenido del `.plist`).
   - Variables: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`.

### 2. AdMob (anuncios)

1. Crea una cuenta en <https://admob.google.com> y enlaza tu cuenta bancaria y fiscal.
2. Añade dos apps (Android e iOS) y en cada una un bloque de anuncios de tipo **«Anuncio de apertura de aplicación»**.
3. *Privacidad y mensajes*: crea un mensaje de **RGPD** (Europa) y, para iPhone, un mensaje **IDFA** (explicativo previo al permiso de seguimiento).
4. Cuando la app esté publicada, pon en las variables de GitHub: `ADMOB_APP_ID_ANDROID`, `ADMOB_APP_ID_IOS`, `VITE_ADMOB_APP_OPEN_ANDROID`, `VITE_ADMOB_APP_OPEN_IOS`.
5. En AdMob, vincula cada app con su ficha de la tienda y publica el archivo `app-ads.txt` en tu dominio.

### 3. Google Play

1. Cuenta de desarrollador: <https://play.google.com/console> (25 $, pago único, verificación de identidad).
2. **Clave de firma** (una vez, y guárdala muy bien: sin ella no podrás actualizar la app). En tu ordenador:
   ```bash
   keytool -genkey -v -keystore el-pablo-subida.jks -keyalg RSA -keysize 2048 -validity 10000 -alias subida
   ```
   Te pedirá una contraseña que eliges tú. Después, en GitHub → *Secrets*: `ANDROID_KEYSTORE_BASE64` (el fichero en base64: `certutil -encode el-pablo-subida.jks clave.txt` y copia el contenido sin las líneas BEGIN/END), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` (`subida`) y `ANDROID_KEY_PASSWORD`.
3. Crea la app en Play Console, activa **Play App Signing** y sube el `.aab` que genera GitHub.
4. **Prueba cerrada obligatoria** (cuentas personales nuevas): al menos **12 testers durante 14 días** seguidos antes de poder publicar.
5. Rellena la ficha con los textos de `docs/TIENDAS.md`.

### 4. App Store (iPhone)

1. **Apple Developer Program**: 99 $/año, <https://developer.apple.com/programs/>.
2. Firmar y subir la app requiere un Mac con Xcode **o** un servicio de compilación en la nube. Sin Mac, lo más sencillo es **Codemagic** (<https://codemagic.io>, tiene plan gratuito): conecta el repositorio, elige «Capacitor», conecta tu cuenta de Apple (App Store Connect API key) y publica en **TestFlight**.
3. En <https://developer.apple.com/account>: crea el *App ID* `es.elpablo.juego` con la capacidad **Sign in with Apple**.
4. En App Store Connect: crea la app, rellena la ficha y las «etiquetas de privacidad» con `docs/TIENDAS.md`, y prueba con **TestFlight** antes de enviarla a revisión.

### 5. Servidor para el público

Para la app publicada, el servidor debe estar siempre disponible. `torre` vale mientras aguante; vigílalo con el panel (`docs/PANEL_SERVIDOR.md`). Si cambias de servidor, actualiza `VITE_SERVER_URL` y vuelve a compilar las apps.

### 6. Legal

- Completa los `[corchetes]` de `docs/PRIVACIDAD.md` (nombre, NIF, email) y publícala en una dirección web (por ejemplo, `https://TU-SERVIDOR/#/privacidad`).
- Consulta con una **gestoría** cómo declarar los ingresos por anuncios (posible alta de autónomo).
- Comprueba en la **OEPM** que «El Pablo» no está registrado como marca de juegos o apps.

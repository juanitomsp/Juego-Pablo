# Apps de iPhone y Android

Las apps son el mismo juego web empaquetado con **Capacitor** (carpetas `ios/` y `android/`). Todo lo que se cambia en el juego llega a las apps al volver a compilarlas.

Son **gratis, sin anuncios, sin compras y sin cuentas**. Así no hay que tratar datos personales ni rellenar formularios complicados (ver `docs/TIENDAS.md`).

## Compilar

### Sin instalar nada (GitHub)

Cada `git push` a `main` o `juego-pablo` lanza **GitHub → Actions → «Apps móviles»**:

- **Android:** genera `el-pablo-android-prueba`, un `.apk` que se instala directamente en el móvil. Si están los secretos de la clave de firma, genera también `el-pablo-android-google-play`, el `.aab` para subir a Google Play.
- **iPhone:** comprueba que la app compila. Para instalarla en un iPhone o publicarla hay que firmarla (ver abajo).

Los ficheros se descargan en la ejecución, en el apartado **Artifacts**.

### En tu ordenador

```bash
npm run build:app
```

Después, `npm run app:android` (Android Studio) o `npm run app:ios` (solo en un Mac con Xcode).

## Configuración

| Qué | Dónde | Por defecto |
|---|---|---|
| Servidor de partidas | `VITE_SERVER_URL` en `.env.app` o en las *Variables* de GitHub | `https://servidor.taile44b8a.ts.net` |
| Identificador de la app | `appId` en `capacitor.config.json` | `es.elpablo.juego` (**no se puede cambiar una vez publicada**) |

El servidor ya acepta conexiones de las apps (`capacitor://localhost` y `https://localhost`).

## Lo que tienes que hacer tú

### Fase 1 · Beta (ahora, sin gastar nada)

1. **Probar la app de Android:** descarga el `.apk` de GitHub (*Actions* → última ejecución → *Artifacts*) e instálalo en tu móvil. Android te pedirá permitir «instalar apps de origen desconocido».
2. **Repartirla entre amigos:** comparte el `.apk` o, mejor, el enlace de la web (`https://servidor.taile44b8a.ts.net`), que en iPhone se puede añadir a la pantalla de inicio y funciona casi como una app.
3. **Mirar el panel** (`/#/admin`, ver `docs/PANEL_SERVIDOR.md`): cuántos jugadores distintos al mes y cuántas partidas. Con eso decides si merece la pena dar el siguiente paso.

### Fase 2 · Publicar en las tiendas (cuando veas que la gente juega)

**Google Play** (25 $, pago único):

1. Crea la cuenta de desarrollador en <https://play.google.com/console> (verificación de identidad).
2. Crea la **clave de firma** una sola vez, en tu ordenador, y **guárdala muy bien**: sin ella no podrás actualizar nunca la app.
   ```bash
   keytool -genkey -v -keystore el-pablo-subida.jks -keyalg RSA -keysize 2048 -validity 10000 -alias subida
   ```
   En GitHub → *Settings → Secrets and variables → Actions → Secrets*, crea `ANDROID_KEYSTORE_BASE64` (el fichero en base64: `certutil -encode el-pablo-subida.jks clave.txt` y copia el contenido sin las líneas BEGIN/END), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` (`subida`) y `ANDROID_KEY_PASSWORD`.
3. Crea la app, activa **Play App Signing** y sube el `.aab` que genera GitHub.
4. **Prueba cerrada obligatoria** para cuentas personales nuevas: **12 testers durante 14 días** antes de poder publicar.
5. Rellena la ficha con `docs/TIENDAS.md`.

**App Store** (99 $ al año):

1. Date de alta en <https://developer.apple.com/programs/>.
2. Sin Mac, firma y sube la app con **Codemagic** (<https://codemagic.io>, tiene plan gratuito): conecta el repositorio, elige «Capacitor», conecta tu cuenta de Apple y publica en **TestFlight** para probarla.
3. Rellena la ficha y la privacidad («Datos no recopilados») con `docs/TIENDAS.md` y envíala a revisión.

**Antes de publicar:** completa los `[corchetes]` de `docs/PRIVACIDAD.md` (tu nombre y un email de contacto).

### Servidor

Para la app publicada, el servidor debe estar siempre encendido. `torre` vale mientras aguante; vigílalo con el panel. Si cambias de servidor, actualiza `VITE_SERVER_URL` y vuelve a compilar las apps.

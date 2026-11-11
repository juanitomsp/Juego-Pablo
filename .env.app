# Variables para compilar las apps de iPhone y Android (npm run build:app).
# No contiene secretos: todo esto acaba dentro de la app y cualquiera podría verlo.

# Servidor de partidas online al que se conecta la app.
VITE_SERVER_URL=https://servidor.taile44b8a.ts.net

# Anuncios: identificadores de bloque de AdMob del anuncio de apertura.
# Vacíos = anuncios de PRUEBA de Google (no dan dinero). Pon aquí los tuyos al publicar.
VITE_ADMOB_APP_OPEN_ANDROID=
VITE_ADMOB_APP_OPEN_IOS=

# Cuentas (Firebase): los mismos valores que en .env (ver docs/CUENTAS_Y_DATOS.md).
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_APP_ID=

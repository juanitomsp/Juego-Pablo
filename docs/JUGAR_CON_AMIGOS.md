# Jugar con amigos desde el móvil

Hay dos formas. Elige según dónde estéis.

## Opción 1 · Estáis juntos, en la misma WiFi (la más rápida, para probar)

Tu ordenador hace de servidor y los móviles se conectan a él por la WiFi de casa.

1. En el ordenador, en la carpeta del proyecto:
   ```bash
   npm install
   ```
   ```bash
   npm run jugar
   ```
   Compila el juego y lo arranca. En la consola verás algo así:
   ```
   Servidor del Pablo escuchando en http://localhost:3001
   Desde los móviles en la misma WiFi: http://192.168.1.35:3001
   ```
   Si aparecen varias direcciones (por VPN o máquinas virtuales), la buena es la de tu WiFi: en Windows, ejecuta `ipconfig` y mira la «Dirección IPv4» del adaptador **Wi-Fi**. Si no estás seguro, prueba una a una desde el móvil.
2. La primera vez, Windows puede preguntar si permites a **Node.js** acceder a la red: marca **Redes privadas** y acepta.
3. Conecta todos los móviles **a la misma WiFi** que el ordenador y abre en el navegador la dirección `http://192.168.x.x:3001` que salió en la consola.
4. Uno de vosotros escribe su apodo y pulsa **Crear sala** (4 jugadores). Pulsa **Compartir** o **Copiar enlace** y mándalo por WhatsApp a los otros tres.
5. Los demás abren el enlace, ponen su apodo y se sientan solos.
6. El anfitrión puede pulsar **Sortear equipos por reyes** y luego **Empezar partida**.

El ordenador tiene que quedarse encendido y con la consola abierta mientras jugáis.

Si los móviles no cargan la página:

- Comprueba que están en la misma WiFi (no en datos móviles ni en una red de invitados).
- Revisa el cortafuegos de Windows: *Panel de control → Firewall → Permitir una aplicación* → Node.js con **Privada** marcado.
- Algunas redes (universidades, oficinas) bloquean la conexión entre dispositivos; ahí usa la opción 2.

## Opción 2 · Cada uno en su casa (publicarlo en internet)

Necesitas subir el juego a un servidor. Lo más sencillo y gratis para probar es **Render**:

1. Sube el repositorio a GitHub:
   ```bash
   git push -u origin juego-pablo
   ```
2. Entra en <https://render.com> con tu cuenta de GitHub → **New → Web Service** → elige el repositorio y la rama.
3. Configura:
   - **Build command:** `npm ci && npm run build`
   - **Start command:** `npm start`
   - **Health check path:** `/api/health`
   - Plan **Free**.
4. Al terminar te da una dirección tipo `https://el-pablo.onrender.com`. Mándala a tus amigos y creáis la sala igual que en la opción 1.

En el plan gratuito, el servidor «se duerme» tras 15 minutos sin uso: el primero que entre esperará cerca de un minuto. Si se duerme a mitad de partida (no debería, mientras jugáis hay tráfico), la sala se pierde.

Más detalles y otras plataformas en [DESPLIEGUE.md](DESPLIEGUE.md).

## Mirar una partida y partidas públicas

- **Mirar:** entra con el código de una partida que ya ha empezado y te quedas como espectador (o usa el enlace `#/ver/CÓDIGO` para mirar aunque haya sitio). No ves las cartas de nadie. En la mesa, el ojo 👁 dice cuántas personas están mirando.
- **Salas privadas:** son las de siempre, solo entra quien tenga el código.
- **Partidas públicas:** desde la portada, «Partidas públicas». Ahí ves las mesas que buscan jugadores y las que se están jugando para mirarlas. El anfitrión puede cambiar su sala entre privada y pública en la sala de espera.

## Instalarlo como app en el móvil

Con la página abierta:

- **Android (Chrome):** menú ⋮ → **Añadir a pantalla de inicio** (o «Instalar aplicación»).
- **iPhone (Safari):** botón Compartir → **Añadir a pantalla de inicio**.

Se abre a pantalla completa, con su icono.

## Consejos para la partida

- **Para jugar una carta, tócala dos veces:** el primer toque la levanta y el segundo la juega, así no se escapan cartas por error.
- El móvil vibra cuando te toca. Si la página está abierta en https, además no se apaga la pantalla.
- Si a alguien se le cierra el navegador, que vuelva a abrir el mismo enlace **en el mismo móvil y navegador**: recupera su sitio.
- Si alguien se va del todo, el anfitrión verá **Sustituir por un bot**.
- 💬 **Chat:** lo lee toda la mesa; las palabras que nombran cartas salen tachadas.
- 🃏 **Orden** muestra el orden de los triunfos con la muestra actual, por si alguien no se acuerda.

## Qué conviene apuntar durante la prueba

Para mejorar el juego, apuntad:

- Reglas que no coinciden con como jugáis (revisad los recuadros 📌 de [REGLAS.md](REGLAS.md)).
- Botones o textos que no se entienden.
- Cualquier cosa que se vea mal en algún móvil (indicad modelo y navegador).

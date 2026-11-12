# Seguridad

Resumen de cómo está protegido el juego, qué se ha comprobado y qué queda por hacer.

## Qué se protege

| Riesgo | Medida | Dónde |
|---|---|---|
| **Hacer trampas** (ver cartas ajenas, jugar cartas ilegales, actuar fuera de turno) | El servidor es la autoridad: valida cada acción con el motor de reglas y a cada jugador solo le envía **su** vista. El mazo y las manos ajenas nunca salen del servidor | `src/shared/engine/view.ts`, `src/server/rooms.ts` |
| **Predecir el reparto** | El servidor baraja con azar criptográfico (`crypto.getRandomValues`), no con `Math.random` | `secureRng` en `rooms.ts` |
| **Tumbar el servidor con mensajes raros** | Cada mensaje se valida y se reconstruye antes de usarlo (`parseAction`, `parseConfigPatch`…); todos los manejadores capturan errores; mensajes de más de 16 KB se rechazan | `src/server/security.ts`, `src/server/app.ts` |
| **Inundar el servidor** (DoS) | Límite de mensajes por conexión (ráfaga 40, 15/s; desconexión si se abusa), conexiones por IP (30), salas por IP (10 seguidas, luego 2/min), salas totales (500), personas por sala (12) | `app.ts` |
| **Adivinar códigos de sala** | Códigos de 6 caracteres aleatorios criptográficos (~10⁹ combinaciones) y límite de 20 intentos fallidos por IP (luego 10/min) | `rooms.ts`, `app.ts` |
| **Suplantar a otro jugador** | El asiento se recupera con un identificador aleatorio que solo conoce su navegador; nunca se envía a otros jugadores | `rooms.ts` (`stateFor`) |
| **Webs ajenas conectándose al servidor** | Solo se aceptan conexiones del propio dominio o de `CORS_ORIGIN` | `originAllowed` |
| **Inyección de código (XSS)** | React escapa todo el texto; los apodos se limitan a 20 caracteres sin `<>` ni caracteres de control; no hay chat libre; CSP estricta | `sanitizeName`, cabeceras |
| **Clickjacking, sniffing, filtrado de URL** | Cabeceras `Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS con https; se oculta `X-Powered-By` | `securityHeaders`, `vercel.json` |
| **Secretos en el repositorio** | `.env` está en `.gitignore` | `.gitignore` |

## Pruebas automáticas

`npm test` ejecuta, además de las reglas del juego, `tests/server.test.ts`, que arranca un servidor real y comprueba:

- Que no se cae con mensajes malformados, sin respuesta o con tipos inesperados.
- Las cabeceras de seguridad.
- El rechazo de conexiones desde dominios no permitidos.
- Los límites de salas por IP, de intentos de adivinar códigos, de salas totales, de mensajes por segundo y de personas por sala.
- Que **ningún mensaje** enviado a los clientes contiene las manos ajenas, el mazo ni identificadores de otros jugadores, y que un espectador no puede jugar.

## Dependencias

`npm audit` avisa de vulnerabilidades en:

- **`vitest` / `tinypool`**: herramientas de **test**, no van a producción. La versión corregida (vitest 4) necesita Node ≥ 20.12; con Node 22 LTS se puede actualizar.

Recomendación: instala **Node 22 LTS**, actualiza `vitest` y revisa `npm audit --omit=dev` antes de cada despliegue.

## Lo que NO cubre (todavía)

- **Ataques DDoS de red** (millones de peticiones desde muchas IP): eso se para antes de llegar a Node, con el proveedor (Cloudflare, el firewall del hosting…).
- **Una sola instancia y en memoria:** reiniciar el servidor borra las salas en curso.
- **Filtro de insultos:** es una lista de palabras; alguien con ingenio puede saltársela. Quien insulta tres veces es expulsado de la sala, y cada jugador puede silenciar a otro.
- **Auditoría externa:** esto es una revisión del propio código, no una auditoría profesional.

## Lista para el despliegue

- [ ] Servir **siempre por https** (y wss). Sin https, la CSP con HSTS no aplica y los móviles no permiten ni Compartir ni mantener la pantalla encendida.
- [ ] Si el servidor está detrás de un proxy (nginx, Caddy, Render, Railway…): `TRUST_PROXY=1`. **No lo actives si no hay proxy**, o cualquiera podría falsear su IP para saltarse los límites.
- [ ] Si el cliente va en otro dominio (Vercel): `CORS_ORIGIN=https://tu-dominio.vercel.app` en el servidor.
- [ ] Abrir en el firewall solo los puertos 80/443 (y SSH). El puerto de Node (3001) solo hacia el proxy local.
- [ ] Que Node escuche solo en local (`HOST=127.0.0.1`), para que nadie se salte el proxy. El script de instalación ya lo hace.
- [ ] Ejecutar Node con un usuario sin privilegios y reiniciarlo automáticamente (systemd, pm2 o Docker con `--restart unless-stopped`).
- [ ] Actualizaciones del sistema operativo y de Node al día.
- [ ] `npm audit --omit=dev` sin avisos nuevos.

## Si encuentras un fallo de seguridad

Apúntalo con los pasos para reproducirlo y no lo publiques hasta corregirlo. Cuando el juego sea público, añade un email de contacto para avisos de seguridad (por ejemplo, en un fichero `SECURITY.md`).

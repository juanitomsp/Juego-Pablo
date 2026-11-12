# Antes de publicar

Lista de comprobación para pasar de «funciona» a «publicado». No es asesoramiento legal: para la parte de privacidad, consulta a un profesional.

## Legal y privacidad

- [ ] Completar `docs/PRIVACIDAD.md` (responsable, email de contacto, fecha) y que lo revise alguien con conocimientos de RGPD/LOPDGDD.
- [ ] Añadir un **aviso legal** (LSSI: titular, contacto) si el sitio tiene carácter comercial o publicidad.
- [ ] Cookies: solo se usa almacenamiento técnico necesario (localStorage), que no requiere banner. **Si algún día añades anuncios, analítica o cuentas, necesitarás consentimiento y más papeleo.**
- [ ] Edad: la cuenta es para mayores de 14 años (ya indicado en la política).
- [ ] Texto de las reglas: mantener la atribución CC BY-SA 4.0 a Wikipedia (ya está en `REGLAS.md`).
- [ ] Elegir **licencia del código** (p. ej. MIT si quieres que sea abierto, o «todos los derechos reservados»).
- [ ] Nombre y marca: comprobar en la OEPM que «El Pablo» u otro nombre comercial no está registrado en tu categoría.
- [ ] No usar ilustraciones de barajas comerciales (Fournier, Heraclio...) sin licencia. Las del juego son dibujos propios.

## Producto

- [ ] Probar partidas reales a 4 y a 6 con gente que juegue al Pablo y revisar las «📌 Decisiones» de `REGLAS.md`.
- [ ] Revisar textos en móvil (la mesa está pensada para pantallas desde 360 px).
- [ ] Iconos y manifiesto PWA para poder «instalar» el juego en el móvil.
- [ ] Página de contacto / reporte de errores.

## Hoja de ruta técnica

1. **Rankings**: requerirían cuentas de usuario (y, con ellas, tratar datos personales). Por ahora, descartado.
2. **Persistencia de salas** (Redis) para sobrevivir a reinicios y escalar a varias instancias (`@socket.io/redis-adapter`).
3. **Temporizador de turno** opcional y expulsión por inactividad.
4. Bots más listos (contar triunfos jugados, leer el chat).
5. Variante de **Lanjarón** (maíces gordos/chicos, Toro) como opción de sala.
6. Moderación de apodos si el juego se hace público (lista de palabras o revisión).
7. Tests de extremo a extremo del flujo online (Playwright).

# Política de privacidad

> ⚠️ **Plantilla.** Antes de publicar el juego, completa los datos marcados entre `[corchetes]` y haz que la revise un profesional. Ver `docs/PUBLICACION.md`.

**Última actualización:** [fecha]

## Quién es el responsable

Responsable del tratamiento: **[nombre o razón social]**, con contacto en **[email de contacto]**.

## Jugar sin cuenta

Puedes jugar sin registrarte. En ese caso:

- Elegimos un **identificador aleatorio** y guardamos el **apodo** que escribas, solo en tu navegador (almacenamiento local), para que puedas volver a tu asiento si se corta la conexión.
- Tus **estadísticas** (partidas jugadas, ganadas, bazas, apuestas) se guardan **solo en tu navegador**. No nos llegan.
- Durante una partida online, el servidor conoce tu apodo y tu identificador aleatorio **solo mientras dura la sala** (en memoria, sin base de datos). Los demás jugadores de tu mesa ven tu apodo.
- No usamos cookies de publicidad ni de analítica.

Puedes borrar todo esto desde **Estadísticas → Borrar datos de este navegador**.

## Jugar con cuenta de Google (opcional)

Si decides **Entrar con Google**, el inicio de sesión lo gestiona **Google Firebase Authentication** y tus estadísticas se guardan en **Google Cloud Firestore**. Google actúa como **encargado del tratamiento** por cuenta nuestra.

| Dato | Para qué | Dónde |
|---|---|---|
| Identificador de usuario de Firebase | Saber qué partidas son tuyas | Firebase Authentication |
| Email, nombre y foto de tu cuenta de Google | Los gestiona Firebase para el inicio de sesión. **El juego no los copia** a su base de datos. | Firebase Authentication |
| Resumen numérico de cada partida (fecha, modo, resultado, bazas, apuestas) | Mostrarte tus estadísticas en cualquier dispositivo | Cloud Firestore |

**No** guardamos los nombres de los demás jugadores ni el contenido de las partidas.

- **Base legal:** tu consentimiento, que das al pulsar «Entrar con Google» tras leer esta política (art. 6.1.a RGPD). Puedes retirarlo cuando quieras borrando tu cuenta.
- **Conservación:** mientras mantengas la cuenta. Al borrarla, se eliminan tus partidas y tu usuario.
- **Transferencias internacionales:** Google puede tratar datos fuera del Espacio Económico Europeo con las garantías del [Anexo de Tratamiento de Datos de Google Cloud](https://cloud.google.com/terms/data-processing-addendum) (cláusulas contractuales tipo / Marco de Privacidad de Datos UE-EE. UU.).

## Tus derechos

Puedes acceder, rectificar, suprimir, oponerte, limitar el tratamiento y portar tus datos:

- **Descargar tus datos:** Estadísticas → «Descargar mis datos (JSON)».
- **Borrar tu cuenta y tus datos:** Estadísticas → «Borrar mi cuenta y mis datos».
- Para cualquier otra solicitud: **[email de contacto]**.

Si crees que no hemos tratado bien tus datos, puedes reclamar ante la **Agencia Española de Protección de Datos** ([www.aepd.es](https://www.aepd.es)).

## Menores

El inicio de sesión con cuenta está dirigido a mayores de **14 años** (edad de consentimiento digital en España). Los menores pueden jugar sin cuenta.

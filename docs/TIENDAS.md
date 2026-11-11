# Fichas de las tiendas

Textos y respuestas listos para copiar en **Google Play Console** y **App Store Connect**. Revisa lo que está entre `[corchetes]`.

## Datos básicos

| Campo | Valor |
|---|---|
| Nombre | El Pablo – Juego de cartas |
| Nombre corto (iPhone, bajo el icono) | El Pablo |
| Categoría | Juegos → Cartas |
| Idioma principal | Español (España) |
| Identificador | `es.elpablo.juego` |
| Política de privacidad | `https://[tu-servidor]/#/privacidad` |
| Borrado de cuenta (Google Play) | `https://[tu-servidor]/#/borrar-cuenta` |
| Contacto | `[email de contacto]` |
| Precio | Gratis, con anuncios |

## Descripción corta (Google Play, máx. 80 caracteres)

> El Pablo, el juego de cartas andaluz: juega online con amigos o contra bots.

## Subtítulo (App Store, máx. 30 caracteres)

> Juego de cartas andaluz

## Descripción larga

> **El Pablo** (o Paulo) es el juego de cartas tradicional de Níjar y Mairena del Alcor, ahora en tu móvil.
>
> Juega por parejas, 2 contra 2 (o 3 contra 3), con la baraja española de toda la vida: el Pablo, el Tuerto, la Andorra y la Malilla mandan en cada mano.
>
> • **Online con tus amigos:** crea una sala, comparte el enlace y jugad desde donde estéis.
> • **Contra bots:** practica cuando quieras, también sin conexión.
> • **Marcador en vivo:** si jugáis con baraja de verdad, lleva los puntos en el móvil.
> • **Apuestas y quiero:** sube la apuesta en tu turno y decide con tu compañero por el chat de la mesa (las cartas no se pueden «cantar»: salen tachadas).
> • **Arrastre y renuncio,** como en la mesa del bar.
> • **Ayudas** para aprender: te avisa de qué cartas ganan la baza y de cuándo tu compañero ya la lleva.
> • **Estadísticas** de tus partidas, en el móvil o en tu cuenta de Google o Apple.
>
> Partidas a cuernos de 8 puntos: gana el equipo que consiga dos.
>
> Ilustraciones de la baraja: «Naipes Libres», de Basquetteur (Wikimedia Commons), CC BY-SA 3.0.

## Palabras clave (App Store, máx. 100 caracteres)

> pablo,paulo,cartas,baraja española,naipes,parejas,andalucía,mus,tute,brisca,online,amigos

## Capturas

Hacen falta capturas del móvil (Google Play: mínimo 2; App Store: 6,7" y 6,5"). Sugerencias: la mesa con la muestra en el centro, la sala con el código para compartir, el chat con cartas tachadas, la baraja y las estadísticas. Puedo generarlas con el navegador en tamaño móvil cuando el servidor definitivo esté listo.

## Clasificación por edades

**Google Play (IARC):**

- Violencia, sexo, lenguaje, drogas: **No**.
- ¿Juegos de azar simulados o apuestas? Contesta según la definición del cuestionario: **no hay dinero real ni premios**; las «apuestas» son puntos del propio juego (como en el mus o el truco). Si el cuestionario pregunta específicamente por «apuestas con moneda virtual», responde **No** (no hay moneda ni compras).
- ¿Los usuarios pueden interactuar? **Sí** (chat de la mesa con mensajes de texto entre jugadores).
- Resultado esperado: **PEGI 3–7 / Para todos**, posiblemente con la nota «Los usuarios interactúan».

**App Store:**

- Todo **Ninguno**, salvo *Simulated Gambling*: **Ninguno** (no es un juego de casino). Resultado esperado: **4+** o **9+**.
- Contenido generado por usuarios: chat de texto con filtro de cartas. Apple puede pedir **mecanismo para denunciar o bloquear**; si lo pide, se añade.

## Google Play – Seguridad de los datos

| Pregunta | Respuesta |
|---|---|
| ¿Recoge o comparte datos? | **Sí** |
| ¿Datos cifrados en tránsito? | **Sí** (https) |
| ¿Se puede pedir el borrado? | **Sí** (en la app y en `/#/borrar-cuenta`) |
| **Información personal → Correo electrónico** | Recogido, **no compartido**. Opcional. Finalidad: gestión de la cuenta. *(Solo si el usuario entra con Google/Apple.)* |
| **Información personal → ID de usuario** | Recogido, no compartido. Opcional. Finalidad: gestión de la cuenta, funcionalidad. |
| **Actividad en apps → Otras acciones (resultados de partidas)** | Recogido, no compartido. Opcional. Finalidad: funcionalidad (estadísticas). |
| **Identificadores de dispositivo → ID de publicidad** | Recogido y **compartido** (AdMob). Finalidad: publicidad, análisis. |
| **Información de apps y rendimiento → Diagnóstico** | Recogido y compartido (AdMob, SDK). Finalidad: publicidad. |
| **Ubicación aproximada** (por la IP) | Recogido y compartido (AdMob). Finalidad: publicidad. |

Además: *¿Usa el ID de publicidad?* **Sí** (anuncios). Público objetivo: **mayores de 13 años** (no dirigida a niños).

## App Store – Privacidad de la app («etiquetas de privacidad»)

| Tipo de dato | ¿Vinculado al usuario? | ¿Para seguimiento? | Finalidades |
|---|---|---|---|
| Correo electrónico (solo con cuenta) | Sí | No | Funcionalidad de la app |
| ID de usuario (solo con cuenta) | Sí | No | Funcionalidad de la app |
| Datos de juego (resultados) | Sí | No | Funcionalidad de la app |
| Identificador de dispositivo (IDFA) | No | **Sí** (si el usuario lo permite) | Publicidad de terceros |
| Datos de publicidad / interacción con anuncios | No | Sí | Publicidad de terceros |
| Ubicación aproximada | No | Sí | Publicidad de terceros |
| Datos de diagnóstico | No | No | Publicidad de terceros |

La app pide el permiso **App Tracking Transparency** antes de usar el IDFA.

## Revisión de Apple – Notas para el revisor

> El juego se puede probar sin cuenta: pulse «Practicar» para jugar contra bots. Para el modo online, «Crear sala» y añada bots en los asientos libres con «+ Bot». Las cuentas son opcionales (Estadísticas → Iniciar sesión con Apple o Google) y se pueden borrar desde la propia app. La app muestra un anuncio de apertura de AdMob al entrar (no en el primer arranque).

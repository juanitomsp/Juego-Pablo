# Las cartas

El juego trae **tres barajas**. Se elige en **Ver la baraja** (`#/baraja`). La elección se guarda en el navegador de cada jugador, así que cada uno puede ver la que prefiera.

## Baraja «Tradicional» (por defecto)

Ilustraciones clásicas de la baraja española, tomadas de la baraja libre **«Naipes Libres»**:

- **Obra:** [Baraja española completa.png](https://commons.wikimedia.org/wiki/File:Baraja_espa%C3%B1ola_completa.png)
- **Autor:** Basquetteur (Wikimedia Commons), con elementos de otros autores que cita la propia página.
- **Licencia:** [Creative Commons Reconocimiento-CompartirIgual 3.0 (CC BY-SA 3.0)](https://creativecommons.org/licenses/by-sa/3.0/deed.es)
- **Cambios:** la imagen original se ha dividido en una imagen por carta (sin los 8 y 9) y un dorso, en `public/cartas/tradicional/`. Esas imágenes recortadas se distribuyen con la misma licencia CC BY-SA 3.0 (ver `public/cartas/tradicional/LEEME.txt`).

Qué exige la licencia y cómo se cumple:

- **Reconocimiento:** el autor y la licencia aparecen en la página de la baraja, al pie de la portada y en este documento.
- **Compartir igual:** las imágenes de las cartas (no el código del juego) se mantienen bajo CC BY-SA 3.0.

Encima de cada carta, el juego pone el **número grande** en las esquinas, para que se lea bien en el móvil.

## Baraja «Cuatro Facciones»

Diseño original del proyecto, de fantasía medieval sombría (`src/client/components/decks/Facciones.tsx`). Cada palo es una facción humana:

| Palo | Facción | Figuras | Emblema | Marco (pinta) |
|---|---|---|---|---|
| Oros | La Corte de la Opulencia | Nobles corpulentos, terciopelo carmesí, cuello de piel, corona de oro | Doblón con corona | Oro con remaches |
| Espadas | La Orden del Caballero Blanco | Armadura de acero blanco, tabardo con cruz azul, corona de plata | Espada larga | Acero con muescas |
| Copas | La Guardia del Caballero Oscuro | Armadura gótica negra, yelmo cerrado, corona de púas, capa desgarrada | Cáliz de hierro con ónice | Hierro negro con arcos góticos |
| Bastos | El Clan Agrícola y Forestal | Hombres barbudos con cuero, piel de lobo y cota de malla | Garrote de roble con herrajes y brote | Madera con costura de cuero |

- **Sota (10):** de pie; gorro de terciopelo, yelmo abierto, yelmo cerrado o pelo al aire según la facción.
- **Caballo (11):** jinete sobre un caballo del color de su facción (dorado, blanco, negro o de tiro) con su gualdrapa.
- **Rey (12):** con capa, corona propia y el emblema de su palo.
- **As (1):** emblema grande bajo un arco.
- **Dorso:** fondo oscuro con los cuatro emblemas.
- Números en las dos esquinas superiores, sobre una placa oscura para leerlos bien en el móvil.

Es una interpretación vectorial (formas planas con degradados), no una ilustración pictórica. Para una versión realista, un ilustrador puede seguir esta misma guía y sus imágenes se cargan como se explica abajo.

**Nombre:** internamente se llama «Cuatro Facciones». Evita «El Caballero Oscuro» como nombre comercial, porque coincide con el título en español de una película conocida.


## Baraja «Clásica»

Dibujo sencillo en SVG propio (`src/client/components/CardView.tsx`) al estilo de la baraja española tradicional:

- Números del 1 al 7 con los palos repetidos según su valor, y 10 (sota), 11 (caballo) y 12 (rey) como figuras simplificadas.
- Número en las esquinas superior izquierda e inferior derecha.
- **Pintas**: cortes en la línea del marco que identifican el palo (oros 0, copas 1, espadas 2, bastos 3).

Son dibujos originales y se pueden publicar sin problemas de derechos. La página `#/baraja` del juego muestra la baraja completa.

## Usar otras imágenes

Las barajas comerciales (por ejemplo, el diseño clásico de Heraclio Fournier) tienen **derechos de autor y marca**. Para publicar el juego con esas ilustraciones necesitas **permiso del titular**. Para uso privado entre amigos el riesgo es menor, pero no subas esas imágenes a un repositorio público.

Si tienes imágenes con licencia (o las dibujas tú):

1. Crea la carpeta `public/cartas/`.
2. Pon una imagen por carta con el nombre `{número}-{palo}.png`, todo en minúsculas:
   - `1-oros.png` … `7-oros.png`, `10-oros.png`, `11-oros.png`, `12-oros.png`
   - lo mismo para `copas`, `espadas` y `bastos`
   - y `reverso.png` para el dorso.

   Son 40 imágenes más el dorso; las cartas 8 y 9 no se usan.
3. Añade en `.env`:
   ```
   VITE_CARD_IMAGES=/cartas
   ```
4. Reinicia `npm run dev` (o vuelve a compilar con `npm run build`).

Proporción recomendada: 2:3 (por ejemplo, 200×300 px). Las etiquetas de ayuda (Pablo, Tuerto, Andorra, Melilla) se siguen mostrando encima.

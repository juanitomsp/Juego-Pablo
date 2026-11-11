# Las cartas

## Dibujos por defecto

Las cartas se dibujan en SVG propio (`src/client/components/CardView.tsx`) al estilo de la baraja española tradicional:

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

Proporción recomendada: 2:3 (por ejemplo, 200×300 px). Las etiquetas de ayuda (Pablo, Tuerto, Andorra, Malilla) se siguen mostrando encima.

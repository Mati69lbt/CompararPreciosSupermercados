# Normalización de productos VTEX (Vea, ChangoMás, Día)

## Objetivo del módulo

Este documento describe cómo se consumen los datos crudos de las APIs VTEX (Vea/Cencosud, ChangoMás, Día) y cómo se transforman al modelo común de producto usado por la UI, para poder comparar precios entre supermercados. Sirve como base de discusión antes de refactorizar `mapearProducto<Tienda>.js`.

## Flujo de datos y mapeo

1. `Products<Tienda>.jsx` pagina el fetch (`/api-<tienda>?ft=<busqueda>&_from=&_to=`) contra el proxy de Vite y junta las páginas en un array crudo.
2. `mapearProducto<Tienda>.js` recorre ese array y extrae, por cada item VTEX:
   - `nombre`: `item.productName` (o `productTitle` / `items[0].nameComplete` como fallback).
   - `marca`: `item.brand`.
   - `precio`: `item.items[0].sellers[0].commertialOffer.Price` (o `ListPrice` si no hay `Price`).
   - `imagenProducto`: `item.items[0].images[0].imageUrl`.
   - `categoria`: segundo segmento de `item.categories[0]`.
   - `promocion`: primer `Teasers[].<Name>k__BackingField`, o `'En oferta'` si `Price < ListPrice`.
3. `logoTienda` se inyecta después, en el componente, desde `SUPERMARKET_LOGOS`.
4. El resultado final se filtra con `.filter(p => p.precio > 0)` para descartar ítems sin oferta comercial.

### Extracción de contenido/medida (RegEx sobre el nombre)

Cada mapeador define su propia `extraerContenidoDeTexto(texto)`, duplicada archivo por archivo:

```js
const regex = /(\d+(?:[\.,]\d+)?)\s*(l|lt|lts|litro|litros|ml|cc|g|gr|grs|gramos|kg|kilo|kilos|u|unid|unidades)\b/i;
```

- Toma el **primer** número seguido de una unidad reconocida dentro del `productName`.
- Normaliza la unidad a uno de: `L`, `ML`, `GR`, `KG`, `UNID` (cualquier otra cosa queda en mayúsculas tal cual matcheó).
- Si no hay coincidencia, ChangoMás y Día caen a una **PRIORIDAD 2**: leer atributos del catálogo VTEX (`Unidad de medida`, `Contenido Neto`, `Gramaje`, `UnidaddeMedida`, `Presentacion`) y volver a correr la regex sobre ese texto. Vea no tiene este fallback, solo usa el nombre.
- Si nada matchea, el producto queda con `contenido: 'Sin especificar'`.

## El problema actual (filtros y metadatos)

**Síntoma:** productos que son claramente de `12.5 GR` u `80 GR` (ej. un chocolate) aparecen calificados o filtrables como `1 L`.

**Diagnóstico:**

1. **Fallback a metadatos por defecto.** En ChangoMás y Día, cuando el `productName` no tiene un patrón `número + unidad` que la regex reconozca (nombres con formato irregular, abreviaturas no contempladas, o unidad pegada de forma distinta), el código cae a los atributos VTEX (`Unidad de medida`, `Contenido Neto`, etc.). Estos atributos suelen venir con un **valor por defecto genérico cargado por el catálogo de la tienda** (típicamente `"1 L"` o `"1 UN"`) cuando el producto no tiene ese campo completado correctamente. El mapeador no distingue entre "el atributo describe realmente el contenido" y "el atributo es un default sin sentido para ese producto" — simplemente lo acepta si la regex lo matchea.
2. **Búsqueda amplia contamina el dataset.** La búsqueda fija (`busquedaActual = "leche"`) trae del lado del servidor VTEX cualquier producto cuyo texto indexado contenga "leche" en cualquier posición — incluye chocolates, alfajores, dulces de leche, etc., no solo lácteos líquidos. Esos productos entran al mismo pipeline de mapeo que la leche real, y si su nombre no sigue el patrón esperado, terminan usando el fallback defectuoso del punto 1.
3. **La regex en sí no es la causa principal del `1 L` falso** (los límites `\b` ya evitan que "Leche" matchee como unidad `L`/`G`), pero **es demasiado permisiva sobre dónde busca**: toma el primer número+unidad que encuentra en todo el nombre, sin verificar que sea el token de contenido neto real (podría matchear un número de un pack, una promo tipo "2x1", un código, etc., antes de llegar al valor correcto).

**Conclusión:** el falso positivo de `1 L` en un chocolate de `80 GR` no viene de que la palabra "Leche" rompa la regex — viene de que el nombre no matchea nada útil y el código recurre silenciosamente a un atributo de catálogo con valor por defecto no confiable, sin validar que ese valor sea plausible para la categoría del producto.

## Criterios de aceptación para la solución

### Parser de medidas (reglas estrictas)

- Unidades soportadas y su normalización: `L`, `ML`, `GR`, `KG`, `UNID`.
- El número debe estar **inmediatamente** seguido (con o sin espacio) por la unidad, y la unidad debe estar delimitada por límites de palabra (`\b`) para no matchear substrings de palabras como "Leche", "Gramaje", "Litro" como marca.
- Extraer del `productName` prioriza siempre el **último** grupo número+unidad válido del nombre (el contenido neto suele ir al final, ej. "Leche La Serenísima Entera 1 L"), no el primero — para evitar matchear cantidades de pack o números de promo que aparecen antes.
- El fallback a atributos de catálogo (`Unidad de medida`, `Contenido Neto`, `Gramaje`, etc.) solo se usa si:
  - el nombre no produjo ningún match, **y**
  - el valor del atributo no es un default sospechoso (lista de valores a tratar como "no confiables" a definir, ej. valores que se repiten idénticos en categorías muy distintas del catálogo).
- Si no hay match confiable en nombre ni en atributos, el producto queda explícitamente en `'Sin especificar'` — nunca se debe inferir una unidad "por descarte".
- La lógica de extracción se debe extraer a un util compartido (hoy está duplicada en cada `mapearProducto<Tienda>.js`) para que la corrección se aplique una sola vez a las tres tiendas VTEX.

### Filtro dual (Marca + Medida) y ordenamiento

- Los selects de "Marca" y "Medida" filtran sobre `productos` de forma independiente y combinable (AND): un producto pasa el filtro solo si coincide con la marca seleccionada (o no hay marca seleccionada) **y** con la medida seleccionada (o no hay medida seleccionada).
- Las listas de opciones (`marcasDisponibles`, `contenidosDisponibles`) se derivan de los productos ya cargados, excluyendo `'Sin marca'` y `'Sin especificar'`, y se ordenan alfabéticamente/numéricamente (`localeCompare` con `numeric: true` para que "10 L" no quede antes que "2 L").
- El resultado filtrado se ordena siempre por `precio` ascendente antes de renderizar.
- Con el parser corregido, un chocolate de `80 GR` debe aparecer únicamente en la opción de medida `80 GR`, nunca contaminando la opción `1 L` usada por los lácteos reales.

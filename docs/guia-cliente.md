# Comparador de Precios — Guía para el cliente

## ¿Qué es?

Una página web que permite buscar un producto (por ejemplo "leche entera 1L" o "coca cola 2.25") y ver, en una sola pantalla, los resultados de ese producto en 5 supermercados argentinos al mismo tiempo:

- Carrefour
- Día
- ChangoMás
- Vea
- Coto

En lugar de entrar a cada sitio por separado, el usuario busca una vez y compara precios lado a lado.

## ¿Cómo se usa?

1. **Buscar**: el usuario escribe el nombre del producto en el buscador de arriba y presiona "Buscar" (o Enter).
2. **Resultados**: la pantalla se divide en 5 columnas, una por supermercado. Cada columna muestra las tarjetas de los productos encontrados en esa tienda, con imagen, marca, contenido (peso/volumen), precio y, si existe, una etiqueta de promoción.
3. **Filtrar**: arriba hay dos filtros que aplican a las 5 columnas a la vez:
   - **Medida**: filtra por rango de contenido (por ejemplo, solo productos de 1L a 2L).
   - **Marca**: filtra por marca, y muestra cuántos productos hay de cada una. El filtro de marca se recalcula según la medida elegida (y viceversa), para no mostrar combinaciones sin resultados.
4. **Ver detalle**: al hacer clic en una tarjeta se abre una ficha ampliada del producto con imagen grande, precio por unidad/kilo (cuando el supermercado lo informa) y un botón "Ir a la tienda" que lleva directo a la página de compra de ese producto en el sitio original.
5. Dentro de cada columna, los productos están ordenados automáticamente de menor a mayor precio, para ver la opción más barata primero.

## ¿De dónde salen los datos?

Los precios y productos se obtienen en tiempo real desde las propias APIs públicas de cada supermercado (las mismas que usan sus sitios web) al momento de la búsqueda. La app no guarda ni almacena precios: cada búsqueda trae información actualizada al instante.

## ¿Qué NO hace (por ahora)?

- No permite guardar búsquedas ni crear listas de compras.
- No envía alertas de precio ni notificaciones.
- No incluye Mercado Libre en la pantalla principal (existe la integración pero no está activada de forma visible).
- No compara automáticamente "el más barato entre todos": el usuario compara visualmente entre las 5 columnas.

## Plataforma

Es una aplicación web (no una app de celular para descargar). Funciona desde el navegador, tanto en computadora como en el celular, sin necesidad de instalar nada.

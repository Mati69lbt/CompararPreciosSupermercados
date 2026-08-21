// src/utils/mappers/mapearProductoMeli.js

const extraerContenidoDeTexto = (texto = '') => {
  if (!texto) return '';

  const regex = /(\d+(?:[\.,]\d+)?)\s*(l|lt|lts|litro|litros|ml|cc|g|gr|grs|gramos|kg|kilo|kilos|u|unid|unidades)\b/i;
  const match = texto.match(regex);

  if (match) {
    const cantidad = match[1].replace(',', '.');
    let unidad = match[2].toLowerCase();

    if (['l', 'lt', 'lts', 'litro', 'litros'].includes(unidad)) unidad = 'L';
    else if (['ml', 'cc'].includes(unidad)) unidad = 'ML';
    else if (['g', 'gr', 'grs', 'gramos'].includes(unidad)) unidad = 'G';
    else if (['kg', 'kilo', 'kilos'].includes(unidad)) unidad = 'KG';
    else if (['u', 'unid', 'unidades'].includes(unidad)) unidad = 'UNID';
    else unidad = unidad.toUpperCase();

    return `${cantidad} ${unidad}`;
  }

  return '';
};

export const mapearProductoMeli = (dataOriginal = []) => {
  if (!Array.isArray(dataOriginal)) return [];

  return dataOriginal
    .map((item) => {
      const id = item.id || Math.random().toString(36).substr(2, 9);
      const nombre = item.title || 'Producto sin nombre';

      // 1. Marca desde los atributos de MeLi
      const atributoMarca = item.attributes?.find((attr) => attr.id === 'BRAND');
      const marca = atributoMarca?.value_name || 'Sin marca';

      // 2. Precio
      const precioFinal = item.price || 0;

      // 3. Imagen (reemplazamos 'I.jpg' por 'O.jpg' para obtener mayor resolución)
      const imagenProducto = item.thumbnail
        ? item.thumbnail.replace('-I.jpg', '-O.jpg')
        : '';

      // 4. Extracción de contenido (Primero título, luego atributos)
      const contenidoDelNombre = extraerContenidoDeTexto(nombre);

      const atributoNeto = item.attributes?.find(
        (attr) => attr.id === 'NET_WEIGHT' || attr.id === 'NET_VOLUME'
      );
      const contenidoMeta = atributoNeto?.value_name
        ? extraerContenidoDeTexto(atributoNeto.value_name)
        : '';

      const contenidoFinal = contenidoDelNombre || contenidoMeta || 'Sin especificar';

      // 5. Promociones / Envíos
      let promocion = null;
      if (item.shipping?.free_shipping) {
        promocion = 'Envío Gratis';
      } else if (item.original_price && item.original_price > item.price) {
        promocion = 'En oferta';
      }

      return {
        id: `meli-${id}`,
        tienda: 'mercadolibre',
        nombre,
        precio: Number(precioFinal),
        marca,
        categoria: 'Almacén',
        contenido: contenidoFinal,
        promocion,
        imagenProducto,
        linkCompra: item.permalink || 'https://www.mercadolibre.com.ar',
      };
    })
    .filter((producto) => producto.precio > 0);
};
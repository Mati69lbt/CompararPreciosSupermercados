// src/utils/mappers/mapearProductoChangoMas.js

const extraerContenidoDeTexto = (texto = '') => {
  if (!texto) return '';

  // RegEx mejorada para detectar enteros y decimales seguidos de unidades
  const regex = /(\d+(?:[\.,]\d+)?)\s*(l|lt|lts|litro|litros|ml|cc|g|gr|grs|gramos|kg|kilo|kilos|u|unid|unidades)\b/i;
  const match = texto.match(regex);

  if (match) {
    let cantidad = match[1].replace(',', '.');
    // Si termina en .0 (ej: 1.0), lo dejamos como 1
    if (cantidad.endsWith('.0')) {
      cantidad = cantidad.replace('.0', '');
    }

    let unidad = match[2].toLowerCase();

    if (['l', 'lt', 'lts', 'litro', 'litros'].includes(unidad)) unidad = 'L';
    else if (['ml', 'cc'].includes(unidad)) unidad = 'ML';
    else if (['g', 'gr', 'grs', 'gramos'].includes(unidad)) unidad = 'GR';
    else if (['kg', 'kilo', 'kilos'].includes(unidad)) unidad = 'KG';
    else if (['u', 'unid', 'unidades'].includes(unidad)) unidad = 'UNID';
    else unidad = unidad.toUpperCase();

    return `${cantidad} ${unidad}`;
  }

  return '';
};

const formatearPrecio = (valor) =>
  Number(valor).toLocaleString('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

// ChangoMás no trae precio por kilo/litro de origen: lo calculamos a partir
// del precio final y del "contenido" ya extraído (ej: "1.5 L", "500 ML", "40 GR")
const calcularPrecioPorUnidad = (precioFinal, contenido) => {
  const precio = Number(precioFinal);
  if (!precio || precio <= 0) return null;

  if (!contenido || contenido === 'Sin especificar') {
    return `${formatearPrecio(precio)} x 1 UNID`;
  }

  const match = contenido.match(/^(\d+(?:[.,]\d+)?)\s*(GR|KG|ML|L|UNID)$/i);
  if (!match) return null;

  const cantidad = parseFloat(match[1].replace(',', '.'));
  const unidad = match[2].toUpperCase();

  if (unidad === 'UNID') {
    return `${formatearPrecio(precio)} x 1 UNID`;
  }

  const esPeso = unidad === 'GR' || unidad === 'KG';
  const totalBase = unidad === 'KG' || unidad === 'L' ? cantidad * 1000 : cantidad;
  if (!totalBase || totalBase <= 0) return null;

  const unidadFinal = esPeso ? 'KG' : 'L';
  const precioPorUnidad = (precio / totalBase) * 1000;

  return `${formatearPrecio(precioPorUnidad)} x 1 ${unidadFinal}`;
};

export const mapearProductoChangoMas = (dataOriginal = []) => {
  if (!Array.isArray(dataOriginal)) return [];

  return dataOriginal
    .map((item) => {
      const id = item.productId || item.items?.[0]?.itemId || Math.random().toString(36).substr(2, 9);
      const nombre = item.productName || item.productTitle || item.items?.[0]?.nameComplete || 'Producto sin nombre';
      const marca = (item.brand || 'Sin marca').toString().toUpperCase().trim();

      const seller = item.items?.[0]?.sellers?.[0]?.commertialOffer;
      const precioFinal = seller?.Price || seller?.ListPrice || 0;
      const imagenProducto = item.items?.[0]?.images?.[0]?.imageUrl || '';

      // PRIORIDAD 1: Extraer la medida REAL del NOMBRE del producto
      // Priorizar el nombre evita que metadatos defectuosos cataloguen un alfajor o 200ml como "1 L"
      let contenido = extraerContenidoDeTexto(nombre);

      // PRIORIDAD 2: Solo si en el nombre no había medida, probar con los atributos
      if (!contenido) {
        const contenidoBruto =
          item['Unidad de medida']?.[0] ||
          item['Contenido Neto']?.[0] ||
          item['Gramaje']?.[0] ||
          '';
        contenido = extraerContenidoDeTexto(contenidoBruto);
      }

      let promocion = null;
      if (seller?.Teasers && seller.Teasers.length > 0) {
        promocion = seller.Teasers[0]['<Name>k__BackingField'] || 'Oferta disponible';
      } else if (seller?.Price < seller?.ListPrice) {
        promocion = 'En oferta';
      }

      const contenidoFinal = contenido || 'Sin especificar';
      const precioPorUnidad = calcularPrecioPorUnidad(precioFinal, contenidoFinal);

      return {
        id: `changomas-${id}`,
        tienda: 'changomas',
        nombre,
        precio: Number(precioFinal),
        marca,
        categoria: item.categories?.[0]?.split('/')[1] || 'General',
        contenido: contenidoFinal,
        precioPorUnidad,
        promocion,
        imagenProducto,
        linkCompra: item.link || 'https://www.masonline.com.ar',
      };
    })
    .filter((producto) => producto.precio > 0);
};
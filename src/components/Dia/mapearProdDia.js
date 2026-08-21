// src/utils/mappers/mapearProdDia.js

const extraerContenidoDeTexto = (texto = '') => {
  if (!texto) return '';

  const regex = /(\d+(?:[\.,]\d+)?)\s*(l|lt|lts|litro|litros|ml|cc|g|gr|grs|gramos|kg|kilo|kilos|u|unid|unidades)\b/i;
  const match = texto.match(regex);

  if (match) {
    let cantidad = match[1].replace(',', '.');
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

export const mapearProductoDia = (dataOriginal = []) => {
  if (!Array.isArray(dataOriginal)) return [];

  return dataOriginal
    .map((item) => {
      const id = item.productId || item.items?.[0]?.itemId || Math.random().toString(36).substr(2, 9);
      const nombre = item.productName || item.productTitle || 'Producto sin nombre';
      const marca = item.brand || 'Sin marca';

      const seller = item.items?.[0]?.sellers?.[0]?.commertialOffer;
      const precioFinal = seller?.Price || seller?.ListPrice || 0;
      const imagenProducto = item.items?.[0]?.images?.[0]?.imageUrl || '';

      // PRIORIDAD 1: Extraer desde el NOMBRE del producto
      let contenido = extraerContenidoDeTexto(nombre);

      // PRIORIDAD 2: Si no estaba en el nombre, buscar en los atributos de Día
      if (!contenido) {
        const contenidoBruto =
          item['UnidaddeMedida']?.[0] ||
          item['Contenido Neto']?.[0] ||
          item['Presentacion']?.[0] ||
          '';
        contenido = extraerContenidoDeTexto(contenidoBruto) || contenidoBruto;
      }

      let promocion = null;
      if (seller?.Teasers && seller.Teasers.length > 0) {
        promocion = seller.Teasers[0]['<Name>k__BackingField'] || 'Oferta disponible';
      } else if (seller?.Price < seller?.ListPrice) {
        promocion = 'En oferta';
      }

      return {
        id: `dia-${id}`,
        tienda: 'dia',
        nombre,
        precio: Number(precioFinal),
        marca,
        categoria: item.categories?.[0]?.split('/')[1] || 'General',
        contenido: contenido || 'Sin especificar',
        promocion,
        imagenProducto,
        linkCompra: item.link || 'https://diaonline.supermercadosdia.com.ar',
      };
    })
    .filter((producto) => producto.precio > 0);
};
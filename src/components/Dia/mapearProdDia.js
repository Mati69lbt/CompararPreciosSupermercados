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

const normalizarUnidadMedida = (unidad = '') => {
  const u = unidad.trim().toLowerCase();

  if (['l', 'lt', 'lts', 'litro', 'litros'].includes(u)) return 'L';
  if (['ml', 'cc'].includes(u)) return 'ML';
  if (['g', 'gr', 'grs', 'gramos'].includes(u)) return 'GR';
  if (['kg', 'kilo', 'kilos'].includes(u)) return 'KG';
  if (['u', 'unid', 'unidad', 'unidades'].includes(u)) return 'UNID';

  return unidad.toUpperCase();
};

const formatearPrecioPorUnidad = (precioPorUnd, unidadMedida) => {
  const valor = Number(precioPorUnd);

  if (!precioPorUnd || Number.isNaN(valor) || valor <= 0) return null;

  const precioFormateado = valor.toLocaleString('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  const unidad = normalizarUnidadMedida(unidadMedida || '');

  return `${precioFormateado} x  ${unidad}`;
};

export const mapearProductoDia = (dataOriginal = []) => {
  if (!Array.isArray(dataOriginal)) return [];

  return dataOriginal
    .map((item) => {
      const id = item.productId || item.items?.[0]?.itemId || Math.random().toString(36).substr(2, 9);
      const nombre = item.productName || item.productTitle || 'Producto sin nombre';
      const marca = (item.brand || 'Sin marca').toString().toUpperCase().trim();

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

      const precioPorUnd = item['PrecioPorUnd']?.[0] ?? item.PrecioPorUnd;
      const unidadDeMedida = item['UnidaddeMedida']?.[0] ?? item.UnidaddeMedida;
      const precioPorUnidad = formatearPrecioPorUnidad(precioPorUnd, unidadDeMedida);

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
        precioPorUnidad,
        promocion,
        imagenProducto,
        linkCompra: item.link || 'https://diaonline.supermercadosdia.com.ar',
      };
    })
    .filter((producto) => producto.precio > 0);
};
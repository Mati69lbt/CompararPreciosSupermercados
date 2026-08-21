// src/utils/mappers/mapearProductoCarrefour.js

// Normalizador y extractor de contenido para agrupar LT, LTS, L -> L
const normalizarContenido = (cantidad, unidad, nombre) => {
  let cant = cantidad;
  let uni = unidad;

  // Si no vienen los metadatos explícitos, intentamos extraer del título
  if (!cant || !uni) {
    const match = nombre.match(/(\d+(?:[.,]\d+)?)\s*(LTS?|LT|L|ML|KG|KGS|GR|GMS|G)\b/i);
    if (match) {
      cant = match[1].replace(",", ".");
      uni = match[2];
    }
  }

  if (!cant || !uni) return "Sin especificar";

  uni = uni.toUpperCase().trim();

  // Agrupar variantes de Litro
  if (["LT", "LTS", "L"].includes(uni)) {
    uni = "L";
  } else if (["G", "GMS", "GR"].includes(uni)) {
    uni = "GR";
  } else if (["KG", "KGS"].includes(uni)) {
    uni = "KG";
  }

  return `${cant} ${uni}`;
};

export const mapearProductoCarrefour = (dataOriginal = []) => {
  if (!Array.isArray(dataOriginal)) return [];

  return dataOriginal.map((item) => {
    const id = item.productId || item.items?.[0]?.itemId || Math.random().toString(36).substr(2, 9);
    const nombre = item.productName || item['Descripción Genexis']?.[0] || 'Producto sin nombre';
    const marca = item['Marca Gnx']?.[0] || item.brand || 'Sin marca';

    // Precio
    const seller = item.items?.[0]?.sellers?.[0]?.commertialOffer;
    const precioFinal = seller?.Price || seller?.ListPrice || 0;

    // Imagen
    const imagenProducto = item.items?.[0]?.images?.[0]?.imageUrl || '';

    // Contenido extraído y normalizado
    const gramajeCantidad = item['Gramaje de unidad de consumo']?.[0] || '';
    const gramajeUnidad = item['Gramaje de unidad de medida']?.[0] || '';
    const contenido = normalizarContenido(gramajeCantidad, gramajeUnidad, nombre);

    // Promociones
    let promocion = null;
    if (seller?.Teasers && seller.Teasers.length > 0) {
      promocion = seller.Teasers[0]['<Name>k__BackingField'] || 'Oferta disponible';
    } else if (seller?.Price < seller?.ListPrice) {
      promocion = 'En oferta';
    }

    return {
      id: `carrefour-${id}`,
      tienda: 'carrefour',
      nombre,
      precio: Number(precioFinal),
      marca,
      categoria: item['EC_Sección']?.[0] || item['EC_Familia']?.[0] || 'General',
      contenido,
      promocion,
      imagenProducto,
      linkCompra: item.link || 'https://www.carrefour.com.ar',
    };
  });
};
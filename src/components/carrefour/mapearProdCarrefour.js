// src/utils/mappers/mapearProductoCarrefour.js

const extraerContenidoDelNombre = (nombre = "") => {
  if (!nombre) return null;

  // RegEx robusta para unidades comunes de supermercado
  const regex = /(\d+(?:[.,]\d+)?)\s*(lts?|litros?|ml|cc|cm3|grs?|gramos?|kgs?|kilos?|u|unid|unidades?|\bg\b|\bl\b)/i;
  const match = nombre.match(regex);

  if (!match) return null;

  let cantidad = parseFloat(match[1].replace(",", "."));
  let unidad = match[2].toLowerCase();

  // Convertir equivalencias de ML/CC/CM3 a Litros si es >= 1000
  if (["ml", "cc", "cm3"].includes(unidad)) {
    if (cantidad >= 1000) {
      cantidad = cantidad / 1000;
      unidad = "L";
    } else {
      unidad = "ML";
    }
  } else if (["l", "lt", "lts", "litro", "litros"].includes(unidad)) {
    unidad = "L";
  } else if (["g", "gr", "grs", "gramos"].includes(unidad)) {
    if (cantidad >= 1000) {
      cantidad = cantidad / 1000;
      unidad = "KG";
    } else {
      unidad = "GR";
    }
  } else if (["kg", "kgs", "kilo", "kilos"].includes(unidad)) {
    unidad = "KG";
  } else if (["u", "unid", "unidades"].includes(unidad)) {
    unidad = "UNID";
  } else {
    unidad = unidad.toUpperCase();
  }

  // Formatear número limpia (ej: 1.0 -> 1)
  const cantidadFormateada = Number.isInteger(cantidad)
    ? cantidad.toString()
    : cantidad.toString().replace(".", ",");

  return `${cantidadFormateada} ${unidad}`;
};

export const mapearProductoCarrefour = (dataOriginal = []) => {
  if (!Array.isArray(dataOriginal)) return [];

  return dataOriginal
    .map((item) => {
      const id = item.productId || item.items?.[0]?.itemId || Math.random().toString(36).substr(2, 9);
      const nombre = item.productName || item['Descripción Genexis']?.[0] || 'Producto sin nombre';
      const marca = item['Marca Gnx']?.[0] || item.brand || 'Sin marca';

      const seller = item.items?.[0]?.sellers?.[0]?.commertialOffer;
      const precioFinal = seller?.Price || seller?.ListPrice || 0;
      const imagenProducto = item.items?.[0]?.images?.[0]?.imageUrl || '';

      // PRIORIDAD 1: Extraer del nombre y convertir unidades
      let contenido = extraerContenidoDelNombre(nombre);

      // PRIORIDAD 2: Solo si el nombre no tiene la medida, recurrimos a los campos de la API
      if (!contenido) {
        const cantMeta = item['Gramaje de unidad de consumo']?.[0];
        const uniMeta = item['Gramaje de unidad de medida']?.[0];
        if (cantMeta && uniMeta) {
          contenido = extraerContenidoDelNombre(`${cantMeta} ${uniMeta}`);
        }
      }

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
        contenido: contenido || 'Sin especificar',
        promocion,
        imagenProducto,
        linkCompra: item.link || 'https://www.carrefour.com.ar',
      };
    })
    .filter((p) => p.precio > 500);
};
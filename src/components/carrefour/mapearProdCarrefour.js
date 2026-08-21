// src/utils/mappers/mapearProductoCarrefour.js

export const mapearProductoCarrefour = (dataOriginal = []) => {
  if (!Array.isArray(dataOriginal)) return [];

  return dataOriginal.map((item) => {
    // 1. Identificador
    const id = item.productId || item.items?.[0]?.itemId || Math.random().toString(36).substr(2, 9);
    
    // 2. Nombre del producto (priorizamos el título comercial)
    const nombre = item.productName || item['Descripción Genexis']?.[0] || 'Producto sin nombre';
    
    // 3. Marca (buscamos en Marca Gnx o brand)
    const marca = item['Marca Gnx']?.[0] || item.brand || 'Sin marca';

    // 4. PRECIO REAL (Extraído de la oferta comercial del primer vendedor)
    const seller = item.items?.[0]?.sellers?.[0]?.commertialOffer;
    const precioFinal = seller?.Price || seller?.ListPrice || 0;

    // 5. Imagen principal
    const imagenProducto = item.items?.[0]?.images?.[0]?.imageUrl || '';

    // 6. Contenido / Gramaje (usamos las propiedades que viste en la consola)
    const gramajeCantidad = item['Gramaje de unidad de consumo']?.[0] || '';
    const gramajeUnidad = item['Gramaje de unidad de medida']?.[0] || '';
    const contenido = gramajeCantidad && gramajeUnidad 
      ? `${gramajeCantidad} ${gramajeUnidad}` 
      : item['EC_Familia']?.[0] || '';

    // 7. Promociones comerciales
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
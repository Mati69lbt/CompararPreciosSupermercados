// src/utils/mappers/mapearProductoDia.js

export const mapearProductoDia = (dataOriginal = []) => {
  if (!Array.isArray(dataOriginal)) return [];

  return dataOriginal.map((item) => {
    // 1. Identificador
    const id = item.productId || item.items?.[0]?.itemId || Math.random().toString(36).substr(2, 9);

    // 2. Nombre del producto y Marca
    const nombre = item.productName || item.productTitle || 'Producto sin nombre';
    const marca = item.brand || 'Sin marca';

    // 3. Oferta Comercial (Sellers)
    const seller = item.items?.[0]?.sellers?.[0]?.commertialOffer;
    const precioFinal = seller?.Price || seller?.ListPrice || 0;

    // 4. Imagen principal
    const imagenProducto = item.items?.[0]?.images?.[0]?.imageUrl || '';

    // 5. Contenido / Gramaje
    const contenido =
      item['UnidaddeMedida']?.[0] ||
      item['Contenido Neto']?.[0] ||
      item['Presentacion']?.[0] ||
      '';

    // 6. Promociones
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
      contenido,
      promocion,
      imagenProducto,
      linkCompra: item.link || 'https://diaonline.supermercadosdia.com.ar',
    };
  });
};
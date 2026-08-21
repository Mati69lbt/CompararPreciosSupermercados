// src/utils/mappers.js

export const mapearProductoCoto = (dataOriginal) => {
  const productosRaw =
    dataOriginal?.response?.results ||
    dataOriginal?.response?.products ||
    dataOriginal?.results ||
    [];

  return productosRaw.map((item) => {
    // 1. Datos principales dentro de 'data' o directamente en la raíz
    const d = item.data || {};

    const id = d.sku_id || d.id || item.id || Math.random().toString(36).substr(2, 9);
    const nombre = item.value || d.sku_description || d.sku_display_name || "Producto sin nombre";
    const marca = d.product_brand || "Sin marca";
    const contenido = d.product_format || d.product_unit_of_measure || "";
    const imagenProducto = d.image_url || d.product_large_image_url || "";
    
    const linkCompra = d.url
      ? `https://www.cotodigital3.com.ar${d.url}`
      : "https://www.cotodigital3.com.ar";

    // 2. Extracción del Precio considerando la Sucursal (Store 109)
    let precioFinal = 0;
    const storeTarget = import.meta.env.VITE_API_COTO_STORE || "109";

    if (Array.isArray(d.price) && d.price.length > 0) {
      // Buscar la sucursal específica (ej: 109)
      const precioStore = d.price.find((p) => p.store === storeTarget);

      if (precioStore) {
        precioFinal = precioStore.listPrice || precioStore.formatPrice || 0;
      } else {
        // Fallback: Si no está la store 109 en la lista, tomar el primer precio disponible
        precioFinal = d.price[0].listPrice || d.price[0].formatPrice || 0;
      }
    } else if (typeof d.product_list_price === "number") {
      precioFinal = d.product_list_price;
    }

    // 3. Promoción
    let promocion = null;
    if (Array.isArray(d.sale_type) && d.sale_type.length > 0) {
      promocion = d.sale_type.join(" / ");
    } else if (typeof d.sale_type === "string" && d.sale_type.trim() !== "") {
      promocion = d.sale_type;
    }

    return {
      id: `coto-${id}`,
      tienda: "coto",
      nombre,
      precio: Number(precioFinal),
      marca,
      categoria: d.product_class || "General",
      contenido,
      promocion,
      imagenProducto,
      linkCompra,
    };
  });
};
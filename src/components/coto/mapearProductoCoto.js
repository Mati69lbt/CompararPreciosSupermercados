// src/components/coto/mapearProductoCoto.js

// RegEx para extraer cantidad y unidad del título (ej: "1,5 L", "1LT", "800 GR", "1.5LTS")
const extraerYNormalizarContenido = (nombre) => {
  if (!nombre) return "Sin especificar";

  // Busca patrones de números (enteros o decimales) seguidos de unidades comunes
  const match = nombre.match(/(\d+(?:[.,]\d+)?)\s*(LTS?|LT|L|ML|KG|KGS|GR|GMS|G)\b/i);

  if (!match) return "Sin especificar";

  const cantidad = match[1].replace(",", ".");
  let unidad = match[2].toUpperCase();

  // Agrupar todas las variantes de Litro a "L"
  if (["LT", "LTS", "L"].includes(unidad)) {
    unidad = "L";
  } else if (["G", "GMS", "GR"].includes(unidad)) {
    unidad = "GR";
  } else if (["KG", "KGS"].includes(unidad)) {
    unidad = "KG";
  }

  return `${cantidad} ${unidad}`;
};

const formatearPrecio = (valor) =>
  Number(valor).toLocaleString('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

// Calcula el precio por kilo/litro a partir del precio final y del "contenido"
// ya extraído (ej: "1.5 L", "500 ML", "40 GR")
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

export const mapearProductoCoto = (dataOriginal) => {
  const productosRaw =
    dataOriginal?.response?.results ||
    dataOriginal?.response?.products ||
    dataOriginal?.results ||
    [];

  return productosRaw.map((item) => {
    const d = item.data || {};

    const id = d.sku_id || d.id || item.id || Math.random().toString(36).substr(2, 9);
    const nombre = item.value || d.sku_description || d.sku_display_name || "Producto sin nombre";
    
    // Extracción de Marca
    const marca = (d.product_brand || "Sin marca").toString().toUpperCase().trim();

    // Extraer y homogenizar contenido directamente del título
    const contenido = extraerYNormalizarContenido(nombre);

    const imagenProducto = d.image_url || d.product_large_image_url || "";
    
    const linkCompra = d.url
      ? `https://www.cotodigital3.com.ar${d.url}`
      : "https://www.cotodigital3.com.ar";

    // Extracción de precio por sucursal
    let precioFinal = 0;
    const storeTarget = import.meta.env.VITE_API_COTO_STORE || "109";

    if (Array.isArray(d.price) && d.price.length > 0) {
      const precioStore = d.price.find((p) => p.store === storeTarget);
      if (precioStore) {
        precioFinal = precioStore.listPrice || precioStore.formatPrice || 0;
      } else {
        precioFinal = d.price[0].listPrice || d.price[0].formatPrice || 0;
      }
    } else if (typeof d.product_list_price === "number") {
      precioFinal = d.product_list_price;
    }

    // Promociones
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
      precioPorUnidad: calcularPrecioPorUnidad(precioFinal, contenido),
      promocion,
      imagenProducto,
      linkCompra,
    };
  });
};
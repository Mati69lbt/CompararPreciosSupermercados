// src/components/coto/mapearProductoCoto.js

import { extraerDatosPapel } from '../../utils/extraerDatosPapel';

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

// Extrae la cantidad de unidades de un título tipo "x 8", "8 ud", "8 uni",
// "paq 8", "8 unid", "8 unidades"
const extraerUnidadesDesdeTitulo = (nombre) => {
  if (!nombre) return null;

  let match = nombre.match(/x\s*(\d+)\b/i);
  if (match) return parseInt(match[1], 10);

  match = nombre.match(/paq\.?\s*(\d+)\b/i);
  if (match) return parseInt(match[1], 10);

  match = nombre.match(/(\d+)\s*(?:unidades|unid|uni|ud|u)\b/i);
  if (match) return parseInt(match[1], 10);

  return null;
};

const formatearPrecio = (valor) =>
  Number(valor).toLocaleString('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

const formatearPrecioDecimal = (valor) =>
  Number(valor).toLocaleString('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
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
    if (!cantidad || cantidad <= 0) return `${formatearPrecio(precio)} x 1 UNID`;
    return `${formatearPrecioDecimal(precio / cantidad)} x 1 UNID`;
  }

  const esPeso = unidad === 'GR' || unidad === 'KG';
  const totalBase = unidad === 'KG' || unidad === 'L' ? cantidad * 1000 : cantidad;
  if (!totalBase || totalBase <= 0) return null;

  const unidadFinal = esPeso ? 'KG' : 'L';
  const precioPorUnidad = (precio / totalBase) * 1000;

  return `${formatearPrecio(precioPorUnidad)} x 1 ${unidadFinal}`;
};

// Busca en d.discounts un descuento directo por unidad (no condicionado a
// comprar varios, ej. "Llevando 2 (Hasta 30% DTO!!)"). Sólo se toma en cuenta
// si el precio regular informado coincide con el precio de sucursal ya
// resuelto (precioFinal), para no mezclar descuentos de otra sucursal.
const extraerDescuentoDirecto = (discounts, precioFinal) => {
  if (!Array.isArray(discounts)) return null;

  for (const d of discounts) {
    if (d?.takingText) continue; // condicionado a cantidad, no es descuento directo
    if (!d?.discountText || !d?.discountPrice || !d?.regularPriceText) continue;

    const matchRegular = d.regularPriceText.match(/\$\s*([\d.,]+)/);
    const matchDescuento = d.discountPrice.match(/\$\s*([\d.,]+)/);
    if (!matchRegular || !matchDescuento) continue;

    const regular = parseFloat(matchRegular[1].replace(/[^\d.]/g, ""));
    const descuento = parseFloat(matchDescuento[1].replace(/[^\d.]/g, ""));
    if (!regular || !descuento || descuento >= regular) continue;
    if (Math.round(regular) !== Math.round(precioFinal)) continue;

    return { listPrice: regular, precio: descuento };
  }

  return null;
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

    // Extraer y homogenizar contenido directamente del título (peso/volumen).
    // Si no hay peso/volumen, se usa el número de unidades del título (x N, paq N, N ud/uni/unid).
    let contenido = extraerYNormalizarContenido(nombre);
    if (contenido === "Sin especificar") {
      const unidades = extraerUnidadesDesdeTitulo(nombre);
      if (unidades && unidades > 0) contenido = `${unidades} UNID`;
    }

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

    const descuentoDirecto = extraerDescuentoDirecto(d.discounts, precioFinal);
    const precioMostrado = descuentoDirecto?.precio ?? precioFinal;

    const datosPapel = extraerDatosPapel(nombre, precioMostrado);

    return {
      id: `coto-${id}`,
      tienda: "coto",
      nombre,
      precio: Number(precioMostrado),
      listPrice: Number(precioFinal),
      marca,
      categoria: d.product_class || "General",
      contenido: datosPapel?.contenido || contenido,
      precioPorUnidad: datosPapel?.precioPorUnidad || calcularPrecioPorUnidad(precioMostrado, contenido),
      promocion,
      imagenProducto,
      linkCompra,
    };
  });
};
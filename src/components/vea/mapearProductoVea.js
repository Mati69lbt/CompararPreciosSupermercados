// src/utils/mappers/mapearProductoVea.js
// cspell: ignore jumboargentinav NUMERICAS Peticion Reemplazá Skus matchea matcheando parsear reintenta skus Unicos acum busqueda commertial deduplicamos promocion CODIGO Codigo Parsea categoria codigo descripcion itro matcheado percentual
import { extraerDatosPapel } from '../../utils/extraerDatosPapel';
import {
  obtenerPromocionesVea,
  obtenerDescuentoParaSku,
  extraerDescuentoPorcentual,
  SELLER_VEA_DEFAULT,
} from './segundaPrueba';

const extraerContenidoDeTexto = (texto = '') => {
  if (!texto) return '';

  // 1. Prioridad: Peso y Volumen (GR, KG, ML, L)
  const regexMedida = /(\d+(?:[\.,]\d+)?)\s*(lts?|litros?|ml|cc|cm3|grs?|gramos?|kgs?|kilos?|\bgr\b|\bkg\b|\bml\b|\bl\b|g)(?!\w)/i;
  const matchMedida = texto.match(regexMedida);

  if (matchMedida) {
    let cantidad = matchMedida[1].replace(',', '.');
    if (cantidad.endsWith('.0')) {
      cantidad = cantidad.replace('.0', '');
    }

    let unidad = matchMedida[2].toLowerCase();

    if (['l', 'lt', 'lts', 'litro', 'litros'].includes(unidad)) unidad = 'L';
    else if (['ml', 'cc', 'cm3'].includes(unidad)) unidad = 'ML';
    else if (['g', 'gr', 'grs', 'gramo', 'gramos'].includes(unidad)) unidad = 'GR';
    else if (['kg', 'kilo', 'kilos'].includes(unidad)) unidad = 'KG';

    return `${cantidad} ${unidad}`;
  }

  // 2. Si no es peso/volumen, tomamos el primer número suelto del título
  const matchNumero = texto.match(/\d+/);
  if (matchNumero) {
    const cantidad = parseInt(matchNumero[0], 10);
    if (!Number.isNaN(cantidad) && cantidad > 0) {
      return `${cantidad} UNID`;
    }
  }

  return '1 UNID';
};

const FAMILIA_UNIDAD = {
  L: 'volumen',
  ML: 'volumen',
  GR: 'peso',
  KG: 'peso',
  UNID: 'unidad',
};

const obtenerFamiliaDesdeContenido = (contenido) => {
  if (!contenido) return null;
  const unidad = contenido.split(' ')[1];
  return FAMILIA_UNIDAD[unidad] || null;
};

const obtenerFamiliaDesdeMetadato = (texto = '') => {
  if (!texto) return null;
  const t = texto.toLowerCase();
  if (/\bk(g|ilo)?s?\b|gramo/.test(t)) return 'peso';
  if (/\bl(t|itro)?s?\b/.test(t)) return 'volumen';
  return null;
};

const FAMILIA_CODIGO_VTEX = {
  GRM: 'peso',
  GR: 'peso',
  KGM: 'peso',
  KG: 'peso',
  CM3: 'volumen',
  MLT: 'volumen',
  ML: 'volumen',
  LTR: 'volumen',
  LT: 'volumen',
};

const obtenerFamiliaDesdeCodigoMedida = (codigo = '') => {
  if (!codigo) return null;
  return FAMILIA_CODIGO_VTEX[codigo.toUpperCase()] || null;
};

const primero = (valor) => (Array.isArray(valor) ? valor[0] ?? null : valor ?? null);

const UNIDAD_MEDIDA_VTEX = {
  GRM: 'GR',
  GR: 'GR',
  KGM: 'KG',
  KG: 'KG',
  LTR: 'L',
  LT: 'L',
  MLT: 'ML',
  ML: 'ML',
  UNI: 'UNID',
};

const obtenerContenidoDesdeGramaje = (item) => {
  const cantidadRaw = primero(item['Gramaje de unidad de consumo']);
  const unidadRaw = primero(item['Gramaje de unidad de medida']);
  if (!cantidadRaw || !unidadRaw) return null;

  let cantidad = parseFloat(String(cantidadRaw).replace(',', '.'));
  if (Number.isNaN(cantidad)) return null;

  let unidad = UNIDAD_MEDIDA_VTEX[unidadRaw.toUpperCase()];
  if (!unidad) return null;

  if (unidad === 'GR' && cantidad >= 1000) {
    cantidad = cantidad / 1000;
    unidad = 'KG';
  } else if (unidad === 'ML' && cantidad >= 1000) {
    cantidad = cantidad / 1000;
    unidad = 'L';
  }

  const cantidadFormateada = Number.isInteger(cantidad)
    ? cantidad.toString()
    : cantidad.toString().replace('.', ',');

  return `${cantidadFormateada} ${unidad}`;
};

const parsearLeyendaConversion = (leyenda = '') => {
  if (!leyenda) return null;
  const match = leyenda.match(/(\d+(?:[.,]\d+)?)\s*(kgs?|kilos?|k|lts?|litros?|l)\.?/i);
  if (!match) return null;

  const cantidad = match[1].replace(',', '.');
  const unidad = ['k', 'kg', 'kgs', 'kilo', 'kilos'].includes(match[2].toLowerCase())
    ? 'KG'
    : 'L';

  const cantidadFormateada = cantidad.endsWith('.0')
    ? cantidad.slice(0, -2)
    : cantidad.replace('.', ',');

  return `${cantidadFormateada} ${unidad}`;
};

const formatearPrecio = (valor) =>
  Number(valor).toLocaleString('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

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
    if (cantidad > 1) {
      const precioUnitario = precio / cantidad;
      const formateado = precioUnitario.toLocaleString('es-AR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      return `$${formateado} x 1 UNID`;
    }
    return `${formatearPrecio(precio)} x 1 UNID`;
  }

  const esPeso = unidad === 'GR' || unidad === 'KG';
  const totalBase = unidad === 'KG' || unidad === 'L' ? cantidad * 1000 : cantidad;
  if (!totalBase || totalBase <= 0) return null;

  const unidadFinal = esPeso ? 'KG' : 'L';
  const precioPorUnidad = (precio / totalBase) * 1000;

  return `${formatearPrecio(precioPorUnidad)} x 1 ${unidadFinal}`;
};

const extraerDescuentoDeCatalogo = (offer) => {
  if (!offer) return 0;

  if (Array.isArray(offer.Teasers)) {
    for (const teaser of offer.Teasers) {
      const porcentaje = extraerDescuentoPorcentual(teaser);
      if (porcentaje) return porcentaje;
    }
  }

  if (Array.isArray(offer.DiscountHighLight)) {
    for (const highlight of offer.DiscountHighLight) {
      const porcentaje = extraerDescuentoPorcentual(highlight);
      if (porcentaje) return porcentaje;
    }
  }

  return 0;
};

const isProductAvailable = (item) => {
  const offer = item?.items?.[0]?.sellers?.[0]?.commertialOffer;
  return offer?.IsAvailable === true && (offer?.AvailableQuantity ?? 0) > 0;
};

const consultarDescuentosMasivos = async (skus, seller) => {
  const infoPromosPorSku = new Map();

  if (!skus.length) return infoPromosPorSku;

  const promocionesRaw = await obtenerPromocionesVea(skus, seller);

  skus.forEach((sku) => {
    const infoPromo = obtenerDescuentoParaSku(promocionesRaw, sku);
    infoPromosPorSku.set(sku, infoPromo);
  });

  return infoPromosPorSku;
};

export const mapearProductoVea = async (dataOriginal = []) => {
  if (!Array.isArray(dataOriginal)) return [];

  const disponibles = dataOriginal.filter(isProductAvailable);

  const skus = Array.from(
    new Set(
      disponibles.map((item) => item.items?.[0]?.itemId).filter(Boolean),
    ),
  );

  const seller = SELLER_VEA_DEFAULT;
  const descuentosPorSku = await consultarDescuentosMasivos(skus, seller);



  return disponibles
    .map((item) => {
      const id = item.productId || item.items?.[0]?.itemId || Math.random().toString(36).substr(2, 9);
      const nombre = item.productName || item.productTitle || item.items?.[0]?.nameComplete || 'Producto sin nombre';
      const marca = (item.brand || 'Sin marca').toString().toUpperCase().trim();

      const sellerOffer = item.items?.[0]?.sellers?.[0]?.commertialOffer;
      const itemId = item.items?.[0]?.itemId;

      const precioCatalogo = sellerOffer?.Price || 0;

      // EXTRAER INFO COMPLETA DEL MAP ({ porcentaje, textoPromo })
      const infoPromo = descuentosPorSku.get(itemId) || { porcentaje: 0, textoPromo: null };
      let porcentajeDescuento = infoPromo.porcentaje || 0;
      let textoPromocionAPI = infoPromo.textoPromo || null;

      // Fallback si no hay promo por API externa
      if (porcentajeDescuento === 0 && !textoPromocionAPI) {
        porcentajeDescuento = extraerDescuentoDeCatalogo(sellerOffer);
      }

      const precio = porcentajeDescuento > 0
        ? Math.round(precioCatalogo * (1 - porcentajeDescuento / 100))
        : precioCatalogo;

      const listPrice = precioCatalogo;
      const descuentoPercent = porcentajeDescuento > 0 ? porcentajeDescuento : 0;

    

      const imagenProducto = item.items?.[0]?.images?.[0]?.imageUrl || '';

      const codigoUnidadMedida = primero(item['Gramaje de unidad de medida']);
      const leyendaConversion = item['Gramaje leyenda de conversión']?.[0];
      const descripcionMedida = item['Gramaje descripción de medida']?.[0];
      const familiaMeta =
        obtenerFamiliaDesdeCodigoMedida(codigoUnidadMedida) ||
        obtenerFamiliaDesdeMetadato(leyendaConversion) ||
        obtenerFamiliaDesdeMetadato(descripcionMedida);

      let contenido = extraerContenidoDeTexto(nombre);

      if (contenido && familiaMeta) {
        const familiaRegex = obtenerFamiliaDesdeContenido(contenido);
        if (familiaRegex && familiaRegex !== familiaMeta) {
          contenido = '';
        }
      }

      if (!contenido) {
        contenido = obtenerContenidoDesdeGramaje(item) || '';
      }

      if (!contenido && leyendaConversion) {
        contenido = parsearLeyendaConversion(leyendaConversion) || '';
      }

      if (contenido && familiaMeta) {
        const familiaFinal = obtenerFamiliaDesdeContenido(contenido);
        if (familiaFinal && familiaFinal !== familiaMeta) {
          contenido = '';
        }
      }

      // ETIQUETA FINAL DE PROMOCIÓN (Combina API, Teasers y fallback porcentual)
      let promocion = textoPromocionAPI;
      if (!promocion) {
        if (sellerOffer?.Teasers && sellerOffer.Teasers.length > 0) {
          promocion = sellerOffer.Teasers[0]['<Name>k__BackingField'] || 'Oferta disponible';
        } else if (descuentoPercent > 0) {
          promocion = `${descuentoPercent}% OFF`;
        }
      }

      const datosPapel = extraerDatosPapel(nombre, precio, 'vea');

      const productoResultante = {
        id: `vea-${id}`,
        tienda: 'vea',
        nombre,
        precio: Number(precio),
        listPrice: Number(listPrice),
        descuentoPercent,
        marca,
        categoria: item.categories?.[0]?.split('/')[1] || 'General',
        contenido: datosPapel?.contenido || contenido || 'Sin especificar',
        precioPorUnidad: datosPapel?.precioPorUnidad || calcularPrecioPorUnidad(precio, contenido || 'Sin especificar'),
        promocion,
        imagenProducto,
        linkCompra: item.link || 'https://www.vea.com.ar',
      };

      return productoResultante;
    })
    .filter((producto) => producto.precio > 500);
};
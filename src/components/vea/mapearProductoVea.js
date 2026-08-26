// src/utils/mappers/mapearProductoVea.js

import { extraerDatosPapel } from '../../utils/extraerDatosPapel';

const extraerContenidoDeTexto = (texto = '') => {
  if (!texto) return '';

  // 1. Prioridad: Peso y Volumen (GR, KG, ML, L)
  const regexMedida = /(\d+(?:[\.,]\d+)?)\s*(lts?|litros?|ml|cc|cm3|grs?|gramos?|kgs?|kilos?|\bgr\b|\bkg\b|\bml\b|\bl\b)(?!\w)/i;
  const matchMedida = texto.match(regexMedida);

  if (matchMedida) {
    let cantidad = matchMedida[1].replace(',', '.');
    if (cantidad.endsWith('.0')) {
      cantidad = cantidad.replace('.0', '');
    }

    let unidad = matchMedida[2].toLowerCase();

    if (['l', 'lt', 'lts', 'litro', 'litros'].includes(unidad)) unidad = 'L';
    else if (['ml', 'cc', 'cm3'].includes(unidad)) unidad = 'ML';
    else if (['g', 'gr', 'grs', 'gramos'].includes(unidad)) unidad = 'GR';
    else if (['kg', 'kilo', 'kilos'].includes(unidad)) unidad = 'KG';

    return `${cantidad} ${unidad}`;
  }

  // 2. Si no es peso/volumen, tomamos el primer número suelto del título
  // como cantidad de unidades del pack (ej: "Jabón x8" -> 8, "Yogur 4" -> 4).
  // Si no hay ningún número, se considera 1 unidad.
  const matchNumero = texto.match(/\d+/);
  if (matchNumero) {
    const cantidad = parseInt(matchNumero[0], 10);
    if (!Number.isNaN(cantidad) && cantidad > 0) {
      return `${cantidad} UNID`;
    }
  }

  return '1 UNID';
};

// Familia a la que pertenece cada unidad normalizada, para detectar contaminación GR/KG vs L/ML
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

// Detecta la familia (peso/volumen) declarada en los metadatos de gramaje de VTEX
const obtenerFamiliaDesdeMetadato = (texto = '') => {
  if (!texto) return null;
  const t = texto.toLowerCase();
  if (/\bk(g|ilo)?s?\b|gramo/.test(t)) return 'peso';
  if (/\bl(t|itro)?s?\b/.test(t)) return 'volumen';
  return null;
};

// Familia declarada por el código VTEX de "Gramaje de unidad de medida" (fuente más confiable)
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

// Devuelve el primer elemento si es array, o el valor tal cual si ya es escalar
const primero = (valor) => (Array.isArray(valor) ? valor[0] ?? null : valor ?? null);

// Códigos de unidad de medida VTEX (Gramaje de unidad de medida) a nuestra notación
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



// Construye el contenido directamente desde "Gramaje de unidad de consumo" +
// "Gramaje de unidad de medida" (ej: '160.00' + 'GRM' -> '160 GR').
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

// Parsea directamente el texto de la leyenda de conversión VTEX ("1 K." / "1 L."),
// que usa abreviaturas ("K" sin "g") que extraerContenidoDeTexto no reconoce
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

// Descarta ítems sin stock real antes de mapear (IsAvailable=true y AvailableQuantity>0)
const isProductAvailable = (item) => {
  const offer = item?.items?.[0]?.sellers?.[0]?.commertialOffer;
  return offer?.IsAvailable === true && (offer?.AvailableQuantity ?? 0) > 0;
};

export const mapearProductoVea = (dataOriginal = []) => {
  if (!Array.isArray(dataOriginal)) return [];

  return dataOriginal
    .filter(isProductAvailable)
    .map((item) => {
      const id = item.productId || item.items?.[0]?.itemId || Math.random().toString(36).substr(2, 9);
      const nombre = item.productName || item.productTitle || item.items?.[0]?.nameComplete || 'Producto sin nombre';
      const marca = (item.brand || 'Sin marca').toString().toUpperCase().trim();

      const seller = item.items?.[0]?.sellers?.[0]?.commertialOffer;
      const precioFinal = seller?.Price || seller?.ListPrice || 0;
      const imagenProducto = item.items?.[0]?.images?.[0]?.imageUrl || '';

      // FAMILIA DE VERDAD (Regla inquebrantable): el código VTEX de "Gramaje de unidad de medida"
      // (GRM/GR/KGM/KG -> peso, CM3/MLT/LTR/LT -> volumen) manda por sobre cualquier otra fuente.
      const codigoUnidadMedida = primero(item['Gramaje de unidad de medida']);
      const leyendaConversion = item['Gramaje leyenda de conversión']?.[0];
      const descripcionMedida = item['Gramaje descripción de medida']?.[0];
      const familiaMeta =
        obtenerFamiliaDesdeCodigoMedida(codigoUnidadMedida) ||
        obtenerFamiliaDesdeMetadato(leyendaConversion) ||
        obtenerFamiliaDesdeMetadato(descripcionMedida);

      // EXTRAER ÚNICAMENTE DEL NOMBRE
      let contenido = extraerContenidoDeTexto(nombre);

      // FILTRO ESTRICTO: si la familia extraída del título contradice la familia de metadatos,
      // se descarta por completo la extracción del título (nunca se mezclan GR/KG con L/ML).
      if (contenido && familiaMeta) {
        const familiaRegex = obtenerFamiliaDesdeContenido(contenido);
        if (familiaRegex && familiaRegex !== familiaMeta) {
          contenido = '';
        }
      }

      // SEGUNDA FUENTE: dato numérico exacto de VTEX (Gramaje de unidad de consumo/medida)
      if (!contenido) {
        contenido = obtenerContenidoDesdeGramaje(item) || '';
      }

      // ÚLTIMA FUENTE DE VERDAD: la leyenda de conversión declarada por VTEX ("1 K." / "1 L.")
      if (!contenido && leyendaConversion) {
        contenido = parsearLeyendaConversion(leyendaConversion) || '';
      }

      // Blindaje final: si a pesar de todo el contenido resultante contradice la familia
      // declarada por metadatos, se descarta (queda "Sin especificar").
      if (contenido && familiaMeta) {
        const familiaFinal = obtenerFamiliaDesdeContenido(contenido);
        if (familiaFinal && familiaFinal !== familiaMeta) {
          contenido = '';
        }
      }

      let promocion = null;
      if (seller?.Teasers && seller.Teasers.length > 0) {
        promocion = seller.Teasers[0]['<Name>k__BackingField'] || 'Oferta disponible';
      } else if (seller?.Price < seller?.ListPrice) {
        promocion = 'En oferta';
      }

      const datosPapel = extraerDatosPapel(nombre, precioFinal);

      return {
        id: `vea-${id}`,
        tienda: 'vea',
        nombre,
        precio: Number(precioFinal),
        listPrice: Number(seller?.ListPrice || precioFinal),
        marca,
        categoria: item.categories?.[0]?.split('/')[1] || 'General',
        contenido: datosPapel?.contenido || contenido || 'Sin especificar', // Si no tiene medida en el título, pasa a ser "Sin especificar"
        precioPorUnidad: datosPapel?.precioPorUnidad || calcularPrecioPorUnidad(precioFinal, contenido || 'Sin especificar'),
        promocion,
        imagenProducto,
        linkCompra: item.link || 'https://www.vea.com.ar',
      };
    })
    .filter((producto) => producto.precio > 500);
};
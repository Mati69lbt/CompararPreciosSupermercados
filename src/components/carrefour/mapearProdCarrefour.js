// src/utils/mappers/mapearProductoCarrefour.js

const extraerContenidoDelNombre = (nombre = "") => {
  if (!nombre) return null;

  // RegEx robusta para unidades comunes de supermercado.
  // La unidad solo matchea si va precedida de un número y no es parte de otra palabra
  // (evita falsos positivos como "leche"/"dulce" siendo interpretados como litros).
  const regex = /(\d+(?:[.,]\d+)?)\s*(lts?|litros?|ml|cc|cm3|grs?|gramos?|kgs?|kilos?|u|unid|unidades?|\bgr\b|\bkg\b|\bml\b|\bl\b)(?!\w)/i;
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

// Detecta la familia (peso/volumen) declarada en los metadatos de gramaje de VTEX
const obtenerFamiliaDesdeMetadato = (texto = '') => {
  if (!texto) return null;
  const t = texto.toLowerCase();
  if (/grm|\bk(g|ilo)?s?\b|gramo/.test(t)) return 'peso';
  if (/cm3|\bml\b|\bl(t|itro)?s?\b/.test(t)) return 'volumen';
  return null;
};

// Parsea directamente la leyenda de conversión VTEX ("1 K." / "1 L."),
// que usa abreviaturas ("K" sin "g") que extraerContenidoDelNombre no reconoce
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

// Devuelve el primer elemento si es array, o el valor tal cual si ya es escalar
// (algunos campos VTEX llegan como Array(1) y otros como string plano)
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
// Es la fuente más precisa cuando está presente porque viene como dato numérico exacto.
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

// Construye/extrae el texto de precio de referencia ("($2.799,00 x 1 L.)")
// Solo usa metadatos VTEX (nunca altera p.contenido)
const extraerPrecioPorUnidad = (item, precioFinal) => {
  const directo = item["Precio x unidad"]?.[0];
  if (directo) return directo;

  const leyenda =
    item["Gramaje leyenda de conversión"]?.[0] ||
    item["Gramaje descripción de medida"]?.[0];

    console.log("extraerPrecioPorUnidad -> leyenda:", leyenda, );

  if (leyenda && precioFinal) {
    const precioFormateado = Number(precioFinal).toLocaleString("es-AR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `($${precioFormateado} x ${leyenda})`;
  }

  return null;
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

      // FAMILIA DE VERDAD (Regla inquebrantable): el código VTEX de "Gramaje de unidad de medida"
      // (GRM/GR/KGM/KG -> peso, CM3/MLT/LTR/LT -> volumen) manda por sobre cualquier otra fuente.
      const codigoUnidadMedida = primero(item['Gramaje de unidad de medida']);
      const leyendaConversion = item['Gramaje leyenda de conversión']?.[0];
      const descripcionMedida = item['Gramaje descripción de medida']?.[0];
      const familiaMeta =
        obtenerFamiliaDesdeCodigoMedida(codigoUnidadMedida) ||
        obtenerFamiliaDesdeMetadato(leyendaConversion) ||
        obtenerFamiliaDesdeMetadato(descripcionMedida);

      // Fuente principal: el título comercial.
      let contenido = extraerContenidoDelNombre(nombre);

      // FILTRO ESTRICTO: si la familia extraída del título contradice la familia de metadatos,
      // se descarta por completo la extracción del título (nunca se mezclan GR/KG con L/ML).
      if (contenido && familiaMeta) {
        const familiaRegex = obtenerFamiliaDesdeContenido(contenido);
        if (familiaRegex && familiaRegex !== familiaMeta) {
          contenido = null;
        }
      }

      // SEGUNDA FUENTE: dato numérico exacto de VTEX (Gramaje de unidad de consumo/medida)
      if (!contenido) {
        contenido = obtenerContenidoDesdeGramaje(item);
      }

      // ÚLTIMA FUENTE DE VERDAD: la leyenda de conversión declarada por VTEX ("1 K." / "1 L.")
      if (!contenido && leyendaConversion) {
        contenido = parsearLeyendaConversion(leyendaConversion) || null;
      }

      // Blindaje final: si a pesar de todo el contenido resultante contradice la familia
      // declarada por metadatos, se descarta (queda "Sin especificar").
      if (contenido && familiaMeta) {
        const familiaFinal = obtenerFamiliaDesdeContenido(contenido);
        if (familiaFinal && familiaFinal !== familiaMeta) {
          contenido = null;
        }
      }

      const precioPorUnidad = extraerPrecioPorUnidad(item, precioFinal);

      let promocion = null;
      if (seller?.Teasers && seller.Teasers.length > 0) {
        promocion = seller.Teasers[0]['<Name>k__BackingField'] || 'Oferta disponible';
      } else if (seller?.Price < seller?.ListPrice) {
        promocion = 'En oferta';
      }

      // Info extra pedida para inspección/depuración (no usada aún en la UI)
      const infoExtra = {
        descripcionGenexis: primero(item['Descripción Genexis']),
        ecFamilia: primero(item['EC_Familia']),
        gramajeUnidadConsumo: primero(item['Gramaje de unidad de consumo']),
        gramajeUnidadMedida: primero(item['Gramaje de unidad de medida']),
        gramajeDescripcionMedida: primero(item['Gramaje descripción de medida']),
        gramajeLeyendaConversion: primero(item['Gramaje leyenda de conversión']),
        precioXUnidadRaw: primero(item['Precio x unidad']),
        brand: primero(item.brand) || primero(item.items?.[0]?.brand),
        description: primero(item.description) || primero(item.items?.[0]?.description),
        pricePerUnit: primero(item.pricePerUnit) || primero(item.items?.[0]?.pricePerUnit),
      };

      return {
        id: `carrefour-${id}`,
        tienda: 'carrefour',
        nombre,
        precio: Number(precioFinal),
        marca,
        categoria: item['EC_Sección']?.[0] || item['EC_Familia']?.[0] || 'General',
        contenido: contenido || 'Sin especificar',
        precioPorUnidad,
        promocion,
        imagenProducto,
        linkCompra: item.link || 'https://www.carrefour.com.ar',
        infoExtra,
      };
    })
    .filter((p) => p.precio > 500);
};

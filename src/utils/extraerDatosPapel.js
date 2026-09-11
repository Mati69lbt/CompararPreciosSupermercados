// src/utils/extraerDatosPapel.js
// cspell: ignore Estandar GENERICA HIGIENICO metraje numeros     
//
// Extrae contenido (rollos) y precio relativo para papel higiénico / rollos de
// cocina, según el diccionario de unidades y metros propio de cada tienda.

// Cantidades de rollos "estándar" en un pack. Se usa para resolver el conflicto
// entre "X <n>" (que en algunos títulos es el metraje por rollo, no la cantidad
// de rollos) y el metraje/M2 declarado aparte del título.
const STANDARD_ROLLOS = [1, 2, 3, 4, 8, 12, 24];

const CONFIG_TIENDA = {
  carrefour: {
    regexRollosSufijo: /(\d+)\s*(?:uni\b|u\b)/i,
    regexMetros: /(\d+)\s*(?:mts\b|m\b)/i,
  },
  dia: {
    regexRollosSufijo: /(\d+)\s*ud\.?\b/i,
    regexMetros: /(\d+)\s*(?:mts\b|m\b)/i,
  },
  changomas: {
    regexRollosSufijo: /(\d+)\s*(?:u\b|rollos?\b)/i,
    regexMetros: /(\d+)\s*(?:mts\b|mt\b|m\b)/i,
  },
  vea: {
    regexRollosSufijo: /(\d+)\s*un\b/i,
    regexMetros: /(\d+)\s*(?:m\b|mts\b)/i,
  },
  coto: {
    regexRollosSufijo: /(\d+)\s*rollos?\b/i,
    regexMetros: /(\d+)\s*metros\b/i,
  },
};

const CONFIG_GENERICA = {
  regexRollosSufijo: /(\d+)\s*(?:u\b|ud\b|uni\b|unid\b|unidades?\b|rollos?\b)/i,
  regexMetros: /(\d+)\s*(?:m\b|ms\b|mt\b|mts\b|metros\b)/i,
};

const regexRollosPrefijo = /(?:x|pack\s*x|paquete\s*x?)\s*(\d+)\b/i;
const regexMetrosOM2 = /(\d+)\s*(?:m2|m²|mts?|metros?)\b/i;

// Dimensiones en centímetros (ancho/largo de la hoja): se descartan antes de
// buscar metros/rollos para que no se confundan con esos valores (ej: "10 Cm"
// no es la cantidad de rollos ni el metraje del producto).
const regexCentimetros = /\d+\s*(?:cm\.?|centimetros?)\b/gi;

// "30 m x 6 u" / "30 mts x 6 rollos": metros por rollo primero, cantidad de rollos después.
const regexMetrosXRollos =
  /(\d+)\s*(?:m|mts?|metros)\b\s*x\s*(\d+)\s*(?:u|rll|rollos?)?\b/i;
// "4 x 20" / "4 u x 20 m" / "4 rll x 20 mts": cantidad de rollos primero, metros por rollo después.
const regexRollosXMetros =
  /(\d+)\s*(?:u|rll|rollos?)?\s*x\s*(\d+)\s*(?:m|mts?|metros)?\b/i;

const formatearMoneda = (valor) =>
  `$${valor.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

// --- Fallback exclusivo de ChangoMás: "Gramaje factor de conversión" trae los
// metros totales del pack (a veces truncado a 2 cifras), y se usa para deducir
// rollos/metros cuando el título no los especifica completos.

// La API a veces trunca el valor a 2 cifras (ej: 12, 36, 48 en vez de 120, 360, 480).
const normalizarMetrosTotalesChangoMas = (raw) => {
  if (raw === undefined || raw === null || raw === "") return null;
  const num = parseInt(String(raw).replace(",", "."), 10);
  if (!Number.isFinite(num) || num <= 0) return null;
  return num >= 10 && num <= 99 ? num * 10 : num;
};

const METROS_COMUNES_CHANGOMAS = [30, 50, 60];

// Tabla de equivalencias conocidas + deducción genérica por metraje común (30/50/60m).
const deducirRollosYMetrosChangoMas = (metrosTotales) => {
  const tabla = {
    120: { rollos: 4, metros: 30 },
    180: { rollos: 6, metros: 30 },
    200: { rollos: 4, metros: 50 },
    360: { rollos: 12, metros: 30 },
  };
  if (tabla[metrosTotales]) return tabla[metrosTotales];

  for (const metros of METROS_COMUNES_CHANGOMAS) {
    if (metrosTotales % metros === 0) {
      return { rollos: metrosTotales / metros, metros };
    }
  }
  return null;
};

// Aplica el fallback de metros totales para ChangoMás sobre lo detectado en el
// título, cubriendo los 4 casos: A) título completo, B) faltan metros,
// C) faltan rollos, D) no hay ni rollos ni metros en el título.
const resolverConFallbackChangoMas = (rollos, metros, rollosEspecificados, metrosTotalesRaw) => {
  const metrosTotalesFallback = normalizarMetrosTotalesChangoMas(metrosTotalesRaw);

  // Caso A: el título ya trae ambos datos.
  if (rollosEspecificados && metros) {
    return { rollos, metros };
  }

  if (!metrosTotalesFallback) return null;

  // Caso B: falta el metraje por rollo.
  if (rollosEspecificados && !metros) {
    const metrosPorRollo = metrosTotalesFallback / rollos;
    if (Number.isFinite(metrosPorRollo) && metrosPorRollo > 0) {
      return { rollos, metros: metrosPorRollo };
    }
    return null;
  }

  // Caso C: faltan las unidades/rollos.
  if (!rollosEspecificados && metros) {
    const rollosDeducidos = metrosTotalesFallback / metros;
    if (Number.isFinite(rollosDeducidos) && rollosDeducidos > 0) {
      return { rollos: rollosDeducidos, metros };
    }
    return null;
  }

  // Caso D: no hay ni rollos ni metros en el título, se usa tabla/patrón de equivalencias.
  return deducirRollosYMetrosChangoMas(metrosTotalesFallback);
};

// Detecta rollos y metros por rollo. Resuelve el caso "... X 30 ... 12 M2":
// si el número que sigue a "X" no es un tamaño de pack estándar, es el
// metraje por rollo (no la cantidad de rollos), y la cantidad de rollos hay
// que buscarla entre los números "estándar" restantes del título.
const detectarRollosYMetros = (titulo, config) => {
  // "30 m x 6 u": metros por rollo primero, rollos después.
  const metrosXRollos = titulo.match(regexMetrosXRollos);
  if (metrosXRollos) {
    return {
      rollos: parseInt(metrosXRollos[2], 10),
      metros: parseInt(metrosXRollos[1], 10),
      rollosEspecificados: true,
    };
  }

  // "4 x 20" / "4 u x 20 m": rollos primero, metros por rollo después.
  const rollosXMetros = titulo.match(regexRollosXMetros);
  if (rollosXMetros) {
    return {
      rollos: parseInt(rollosXMetros[1], 10),
      metros: parseInt(rollosXMetros[2], 10),
      rollosEspecificados: true,
    };
  }

  const matchPrefijoX = titulo.match(regexRollosPrefijo);
  const matchMetrosSueltos = titulo.match(regexMetrosOM2);

  if (matchPrefijoX && matchMetrosSueltos) {
    const nX = parseInt(matchPrefijoX[1], 10);
    if (!STANDARD_ROLLOS.includes(nX)) {
      const metros = nX;
      const numerosEstandar = [...titulo.matchAll(/\b(\d+)\b/g)]
        .map((m) => parseInt(m[1], 10))
        .filter((n) => STANDARD_ROLLOS.includes(n) && n !== metros);

      return {
        rollos: numerosEstandar[0] || null,
        metros,
        rollosEspecificados: numerosEstandar.length > 0,
      };
    }
  }

  let rollos = null;
  let rollosEspecificados = false;

  if (matchPrefijoX) {
    rollos = parseInt(matchPrefijoX[1], 10);
    rollosEspecificados = true;
  } else {
    const matchSufijo =
      titulo.match(config.regexRollosSufijo) ||
      titulo.match(CONFIG_GENERICA.regexRollosSufijo);
    if (matchSufijo) {
      rollos = parseInt(matchSufijo[1], 10);
      rollosEspecificados = true;
    }
  }

  const matchMetros =
    titulo.match(config.regexMetros) || titulo.match(CONFIG_GENERICA.regexMetros);
  const metros = matchMetros ? parseInt(matchMetros[1], 10) : null;

  return { rollos, metros, rollosEspecificados };
};

// Detecta papel higiénico / rollo de cocina y calcula el precio relativo
// (por metro si el título especifica metraje, por unidad/rollo si no).
export const extraerDatosPapel = (titulo = "", precioFinal = 0, tienda = "", metrosTotalesRaw = null) => {
  if (!titulo) return null;

  const t = titulo.toUpperCase();
  const esPapel =
    t.includes("PAPEL HIGIENICO") ||
    t.includes("PAPEL HIGIÉNICO") ||
    t.includes("P.H.") ||
    t.includes("ROLLO DE COCINA") ||
    t.includes("ROLLO COCINA") ||
    t.includes("PAPEL COCINA") ||
    t.includes("HIGIENICO") ||
    t.includes("HIGIÉNICO");

  if (!esPapel) return null;

  const precio = Number(precioFinal);
  if (!precio || precio <= 0) return null;

  const config = CONFIG_TIENDA[tienda] || CONFIG_GENERICA;
  const tituloSinCm = titulo.replace(regexCentimetros, " ");
  // Normaliza puntos de abreviatura ("u." / "m.") a espacios, sin tocar decimales
  // (ej: "1.5"), para que "4 u. x 80 m." matchee como "rollos x metros" y no
  // caiga en el fallback de prefijo "x <n>" (que confundiría 80 con la cantidad
  // de rollos en vez del metraje).
  const tituloNormalizado = tituloSinCm.replace(/(?<!\d)\.(?!\d)/g, " ");
  const { rollos, metros, rollosEspecificados } = detectarRollosYMetros(tituloNormalizado, config);

  // ChangoMás: usa "Gramaje factor de conversión" (metros totales del pack) como
  // fallback cuando el título no trae rollos y/o metraje por rollo completos.
  if (tienda === "changomas") {
    const resuelto = resolverConFallbackChangoMas(rollos, metros, rollosEspecificados, metrosTotalesRaw);
    if (resuelto) {
      const metrosTotales = resuelto.rollos * resuelto.metros;
      return {
        contenido: `${resuelto.rollos}u x ${resuelto.metros} mts`,
        precioPorUnidad: `${formatearMoneda(precio / metrosTotales)} x 1 M`,
      };
    }
  }

  const rollosFinal = rollos || 1;
  const etiquetaRollo = "U"

  // Título sin unidades detectadas: no hay base para un precio relativo confiable.
  if (!rollosEspecificados) {
    return { contenido: `${rollosFinal} UNID`, precioPorUnidad: "S/E" };
  }

  // Sin metraje en el título: precio por unidad/rollo.
  if (!metros) {
    return {
      contenido: `${rollosFinal} UNID`,
      precioPorUnidad: `${formatearMoneda(precio / rollosFinal)} x 1 UNID`,
    };
  }

  // Con metraje: precio por metro (metraje total = rollos x metros por rollo).
  const metrosTotales = rollosFinal * metros;
  return {
    contenido: `${rollosFinal}${etiquetaRollo} x ${metros}MTS`,
    precioPorUnidad: `${formatearMoneda(precio / metrosTotales)} x 1 M`,
  };
};

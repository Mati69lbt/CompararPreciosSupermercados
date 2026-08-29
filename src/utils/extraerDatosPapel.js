// src/utils/extraerDatosPapel.js
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
const regexCombinado = /(\d+)\s*x\s*(\d+)\s*(?:m|mt|mts|metros)\b/i;
const regexMetrosOM2 = /(\d+)\s*(?:m2|m²|mts?|metros?)\b/i;

const formatearMoneda = (valor) =>
  `$${valor.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

// Detecta rollos y metros por rollo. Resuelve el caso "... X 30 ... 12 M2":
// si el número que sigue a "X" no es un tamaño de pack estándar, es el
// metraje por rollo (no la cantidad de rollos), y la cantidad de rollos hay
// que buscarla entre los números "estándar" restantes del título.
const detectarRollosYMetros = (titulo, config) => {
  const combinado = titulo.match(regexCombinado);
  if (combinado) {
    return {
      rollos: parseInt(combinado[1], 10),
      metros: parseInt(combinado[2], 10),
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
export const extraerDatosPapel = (titulo = "", precioFinal = 0, tienda = "") => {
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
  const { rollos, metros, rollosEspecificados } = detectarRollosYMetros(titulo, config);

  const rollosFinal = rollos || 1;
  const contenido = `${rollosFinal} UNID`;

  // Título sin unidades detectadas: no hay base para un precio relativo confiable.
  if (!rollosEspecificados) {
    return { contenido, precioPorUnidad: "S/E" };
  }

  // Sin metraje en el título: precio por unidad/rollo.
  if (!metros) {
    return {
      contenido,
      precioPorUnidad: `${formatearMoneda(precio / rollosFinal)} x 1 UNID`,
    };
  }

  // Con metraje: precio por metro (metraje total = rollos x metros por rollo).
  const metrosTotales = rollosFinal * metros;
  return {
    contenido,
    precioPorUnidad: `${formatearMoneda(precio / metrosTotales)} x 1 M`,
  };
};

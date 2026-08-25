// src/utils/extraerDatosPapel.js

// Detecta papel higiénico / rollo de cocina y calcula precio por metro (o por unidad)
export const extraerDatosPapel = (titulo = "", precioFinal = 0) => {
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

  let rollos = null;
  let metrosPorRollo = null;

  // CASO ESPECIAL: Patrón combinado tipo "4x30m" o "4 x 30 mts"
  const regexCombinado = /(\d+)\s*x\s*(\d+)\s*(?:m|mt|mts|metros)\b/i;
  const matchCombinado = titulo.match(regexCombinado);

  if (matchCombinado) {
    rollos = parseInt(matchCombinado[1], 10);
    metrosPorRollo = parseInt(matchCombinado[2], 10);
  } else {
    // 1. Extraer Metros (ej: "30 mts", "50m", "30 mt", "30 m")
    const regexMetros = /(\d+)\s*(?:m\b|ms\b|mt\b|mts\b|metros\b)/i;
    const matchMetros = titulo.match(regexMetros);
    if (matchMetros) {
      metrosPorRollo = parseInt(matchMetros[1], 10);
    }

    // 2. Extraer Rollos / Unidades
    // Busca patrones tipo: "x4", "x 4", "4 u", "4u", "4 ud", "4 uni", "paquete 4 unidades", "4x"
    const regexRollosPrefijo = /(?:x|pack\s*x|paquete\s*x?)\s*(\d+)/i;
    const regexRollosSufijo = /(\d+)\s*(?:u\b|ud\b|uni\b|unid\b|unidades?\b|rollos?)/i;

    const matchPrefijo = titulo.match(regexRollosPrefijo);
    const matchSufijo = titulo.match(regexRollosSufijo);

    if (matchPrefijo) {
      rollos = parseInt(matchPrefijo[1], 10);
    } else if (matchSufijo) {
      rollos = parseInt(matchSufijo[1], 10);
    }
  }

  // Fallback si no detectó unidades pero es papel higiénico (asumir 1 unidad si no hay número)
  if (!rollos) rollos = 1;

  // RESULTADOS:
  const contenido = `${rollos} UNID`;

  if (metrosPorRollo && rollos) {
    const metrosTotales = rollos * metrosPorRollo;
    const precioPorMetro = precio / metrosTotales;

    const precioPorUnidad = `$${precioPorMetro.toLocaleString("es-AR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} x 1 M`;

    return { contenido, precioPorUnidad };
  }

  // Si solo tenemos unidades sin metros
  const precioPorRollo = precio / rollos;
  const precioPorUnidad = `$${precioPorRollo.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} x 1 UNID`;

  return { contenido, precioPorUnidad };
};

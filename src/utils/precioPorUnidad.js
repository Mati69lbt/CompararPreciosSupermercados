// Calcula el precio relativo (por KG, L o UNID) a partir del precio de oferta y el campo "contenido"
// (formato "1,5 L" / "800 GR" / "2 KG" / "6 UNID"). Devuelve null si no se pudo parsear el contenido.
export const calcularPrecioPorUnidad = (precio, contenido) => {
  if (!precio || !contenido) return null;

  const match = contenido.match(/^(\d+(?:[.,]\d+)?)\s*(GR|KG|ML|L|UNID)$/i);
  if (!match) return null;

  const cantidad = parseFloat(match[1].replace(",", "."));
  if (!cantidad) return null;

  const unidad = match[2].toUpperCase();

  if (unidad === "UNID") {
    return { valor: precio / cantidad, unidad: "un" };
  }

  const cantidadEnUnidadBase =
    unidad === "GR" || unidad === "ML" ? cantidad / 1000 : cantidad;

  const unidadBase = unidad === "GR" || unidad === "KG" ? "kg" : "L";
  const valor = precio / cantidadEnUnidadBase;

  return { valor, unidad: unidadBase };
};

// Extrae el valor numérico de un string "precioPorUnidad" (ej: "$120,50 x 1 M",
// "$1.200,00 x 1 KG"). Sin match o "S/E" / "Sin especificar" -> Infinity (va al final).
export const parsePrecioPorUnidad = (precioPorUnidad) => {
  if (!precioPorUnidad || typeof precioPorUnidad !== "string") return Infinity;

  const match = precioPorUnidad.match(/\$\s*([\d.,]+)/);
  if (!match) return Infinity;

  const numero = parseFloat(
    match[1].replace(/\./g, "").replace(",", "."),
  );

  return Number.isFinite(numero) ? numero : Infinity;
};

// Ordena productos estrictamente de menor a mayor precio relativo, parseando el
// string `precioPorUnidad` ya calculado por cada mapeador. Sin precio relativo
// válido -> Infinity (al final). Empate -> precio final asc.
export const ordenarPorPrecioRelativo = (productos) => {
  return [...productos].sort((a, b) => {
    const valA = parsePrecioPorUnidad(a.precioPorUnidad);
    const valB = parsePrecioPorUnidad(b.precioPorUnidad);

    if (valA !== valB) return valA - valB;
    return a.precio - b.precio;
  });
};

export const formatearPrecioPorUnidad = (precio, contenido) => {
  const resultado = calcularPrecioPorUnidad(precio, contenido);
  if (!resultado) return null;

  const valorFormateado = resultado.valor.toLocaleString("es-AR", {
    maximumFractionDigits: 0,
  });

  return `$ ${valorFormateado} / ${resultado.unidad}`;
};

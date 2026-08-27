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

// Ordena productos de menor a mayor precio relativo ($/kg, $/L o $/un), calculado
// on-the-fly desde precio + contenido. Empate -> precio total asc. Sin contenido parseable -> al final.
export const ordenarPorPrecioRelativo = (productos) => {
  return [...productos].sort((a, b) => {
    const valA = calcularPrecioPorUnidad(a.precio, a.contenido)?.valor;
    const valB = calcularPrecioPorUnidad(b.precio, b.contenido)?.valor;

    if (valA != null && valB != null) {
      if (valA !== valB) return valA - valB;
      return a.precio - b.precio;
    }
    if (valA != null) return -1;
    if (valB != null) return 1;

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

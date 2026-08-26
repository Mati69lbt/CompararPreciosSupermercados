// Calcula el precio relativo (por KG o por L) a partir del precio de oferta y el campo "contenido"
// (formato "1,5 L" / "800 GR" / "2 KG" / "6 UNID"). Devuelve null si no aplica (UNID o sin especificar).
export const calcularPrecioPorUnidad = (precio, contenido) => {
  if (!precio || !contenido) return null;

  const match = contenido.match(/^(\d+(?:[.,]\d+)?)\s*(GR|KG|ML|L)$/i);
  if (!match) return null;

  const cantidad = parseFloat(match[1].replace(",", "."));
  if (!cantidad) return null;

  const unidad = match[2].toUpperCase();
  const cantidadEnUnidadBase =
    unidad === "GR" || unidad === "ML" ? cantidad / 1000 : cantidad;

  const unidadBase = unidad === "GR" || unidad === "KG" ? "kg" : "L";
  const valor = precio / cantidadEnUnidadBase;

  return { valor, unidad: unidadBase };
};

export const formatearPrecioPorUnidad = (precio, contenido) => {
  const resultado = calcularPrecioPorUnidad(precio, contenido);
  if (!resultado) return null;

  const valorFormateado = resultado.valor.toLocaleString("es-AR", {
    maximumFractionDigits: 0,
  });

  return `$ ${valorFormateado} / ${resultado.unidad}`;
};

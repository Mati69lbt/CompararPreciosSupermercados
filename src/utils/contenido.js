export const RANGOS_CONTENIDO = [
  "Menos de 200 GR",
  "200 a 500 GR",
  "500 GR a 1 KG",
  "1 KG",
  "Más de 1 KG",
  "Menos de 200 ML",
  "200 a 500 ML",
  "500 ML a 1 L",
  "1 L",
  "Más de 1 L",
  "Menos de 10 un",
  "10 a 20 un",
  "20 a 30 un",
  "Más de 30 un",
  "Unidades / Sin especificar",
];

// Etiquetas de rango por cantidad de unidades (ej: Carrefour, productos vendidos por UNI)
const RANGOS_UNIDADES = ["Menos de 10 un", "10 a 20 un", "20 a 30 un", "Más de 30 un"];

// Convierte "1,5 L" / "800 GR" / "2 KG" a un rango de Peso o Volumen, sin mezclar familias
export const obtenerRangoContenido = (contenido) => {
  if (!contenido || contenido === "Sin especificar")
    return "Unidades / Sin especificar";

  if (RANGOS_UNIDADES.includes(contenido)) return contenido;

  const match = contenido.match(/^(\d+(?:[.,]\d+)?)\s*(GR|KG|ML|L|UNID)$/i);
  if (!match) return "Unidades / Sin especificar";

  const cantidad = parseFloat(match[1].replace(",", "."));
  const unidad = match[2].toUpperCase();

  if (unidad === "UNID") {
    if (cantidad < 10) return "Menos de 10 un";
    if (cantidad < 20) return "10 a 20 un";
    if (cantidad < 30) return "20 a 30 un";
    return "Más de 30 un";
  }

  const esPeso = unidad === "GR" || unidad === "KG";
  const equivalente =
    unidad === "KG" || unidad === "L" ? cantidad * 1000 : cantidad;

  if (esPeso) {
    if (equivalente < 200) return "Menos de 200 GR";
    if (equivalente < 500) return "200 a 500 GR";
    if (equivalente < 1000) return "500 GR a 1 KG";
    if (equivalente === 1000) return "1 KG";
    return "Más de 1 KG";
  }

  if (equivalente < 200) return "Menos de 200 ML";
  if (equivalente < 500) return "200 a 500 ML";
  if (equivalente < 1000) return "500 ML a 1 L";
  if (equivalente === 1000) return "1 L";
  return "Más de 1 L";
};

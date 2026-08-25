// Normalización y agrupación de productos equivalentes entre supermercados.

const STOPWORDS = new Set([
  "de", "del", "la", "el", "los", "las", "con", "sin", "x", "un", "una",
  "y", "en", "para", "al", "por",
]);

const UNIDADES_TEXTO = new Set([
  "gr", "kg", "ml", "l", "lt", "lts", "litro", "litros",
  "kilo", "kilos", "gramo", "gramos", "unid", "unidades",
]);

export const normalizarTexto = (texto = "") =>
  texto
    .toString()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// El campo "contenido" ya viene canonicalizado por los mapeadores como "<numero> <UNIDAD>"
// (GR/KG/ML/L/UNID). Lo convertimos a una unidad base comparable (g, ml o unidades).
const obtenerEquivalenteContenido = (contenido) => {
  if (!contenido) return "sin-contenido";

  const match = contenido.match(/^(\d+(?:[.,]\d+)?)\s*(GR|KG|ML|L|UNID)$/i);
  if (!match) return normalizarTexto(contenido) || "sin-contenido";

  const cantidad = parseFloat(match[1].replace(",", "."));
  const unidad = match[2].toUpperCase();

  if (unidad === "UNID") return `${cantidad}-un`;

  const esPeso = unidad === "GR" || unidad === "KG";
  const equivalente = unidad === "KG" || unidad === "L" ? cantidad * 1000 : cantidad;

  return `${Math.round(equivalente)}-${esPeso ? "g" : "ml"}`;
};

// Palabras significativas del nombre (sin marca, unidades ni números), ordenadas
// para que no importe el orden en que cada tienda redacta el producto.
const obtenerPalabrasClave = (nombre, marca) => {
  const marcaTokens = new Set(normalizarTexto(marca).split(" ").filter(Boolean));

  const tokens = normalizarTexto(nombre)
    .split(" ")
    .filter((tok) => tok.length > 1)
    .filter((tok) => !/^\d+([.,]\d+)?$/.test(tok))
    .filter((tok) => !UNIDADES_TEXTO.has(tok))
    .filter((tok) => !marcaTokens.has(tok))
    .filter((tok) => !STOPWORDS.has(tok));

  return [...new Set(tokens)].sort().slice(0, 5).join("-");
};

// Clave de coincidencia: marca + contenido equivalente + palabras clave del nombre.
export const obtenerClaveProducto = (producto) => {
  if (producto.ean) return `ean:${producto.ean}`;

  const marca = normalizarTexto(producto.marca) || "sin-marca";
  const contenidoKey = obtenerEquivalenteContenido(producto.contenido);
  const palabrasClave = obtenerPalabrasClave(producto.nombre, producto.marca);

  return `${marca}|${contenidoKey}|${palabrasClave}`;
};

// Agrupa productos de todas las tiendas y determina, por cada uno,
// si es único, ganador (más barato dentro de un grupo con 2+ tiendas) o competidor.
export const construirInfoDeCoincidencias = (productos) => {
  const grupos = new Map();

  productos.forEach((producto) => {
    const clave = obtenerClaveProducto(producto);
    if (!grupos.has(clave)) grupos.set(clave, []);
    grupos.get(clave).push(producto);
  });

  const infoPorClave = new Map();

  grupos.forEach((productosDelGrupo, groupId) => {
    const tiendasDistintas = new Set(productosDelGrupo.map((p) => p.tienda));

    if (tiendasDistintas.size < 2) {
      productosDelGrupo.forEach((p) => {
        infoPorClave.set(`${p.tienda}:${p.id}`, { estado: "unico", groupId });
      });
      return;
    }

    const precioMinimo = Math.min(...productosDelGrupo.map((p) => p.precio));

    productosDelGrupo.forEach((p) => {
      infoPorClave.set(`${p.tienda}:${p.id}`, {
        estado: p.precio === precioMinimo ? "ganador" : "compite",
        groupId,
      });
    });
  });

  return infoPorClave;
};

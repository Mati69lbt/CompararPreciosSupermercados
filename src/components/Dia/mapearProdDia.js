// src/utils/mappers/mapearProdDia.js

const extraerContenidoDeTexto = (texto = '') => {
  if (!texto) return '';

  const regex = /(\d+(?:[\.,]\d+)?)\s*(l|lt|lts|litro|litros|ml|cc|g|gr|grs|gramos|kg|kilo|kilos|u|unid|unidades)\b/i;
  const match = texto.match(regex);

  if (match) {
    let cantidad = match[1].replace(',', '.');
    if (cantidad.endsWith('.0')) {
      cantidad = cantidad.replace('.0', '');
    }

    let unidad = match[2].toLowerCase();

    if (['l', 'lt', 'lts', 'litro', 'litros'].includes(unidad)) unidad = 'L';
    else if (['ml', 'cc'].includes(unidad)) unidad = 'ML';
    else if (['g', 'gr', 'grs', 'gramos'].includes(unidad)) unidad = 'GR';
    else if (['kg', 'kilo', 'kilos'].includes(unidad)) unidad = 'KG';
    else if (['u', 'unid', 'unidades'].includes(unidad)) unidad = 'UNID';
    else unidad = unidad.toUpperCase();

    return `${cantidad} ${unidad}`;
  }

  return '';
};

// Fallback: busca cantidad de unidades en el título (ej: "Pañales x36 uds", "Toallitas... 8 Ud.")
const contarUnidadesDesdeTitulo = (texto = '') => {
  if (!texto) return null;
  // Captura formatos como: x36, 36u, 36 un, 36unid, 36 uds, 36 unidades, 8 Ud.
  const match = texto.match(/(?:x|\b)(\d+)\s*(?:u|ud|uds|un|unid|unidades)\b/i);
  if (match && parseInt(match[1], 10) > 1) {
    return `${match[1]} UNID`;
  }
  return null;
};

// Descarta "1 UD" / "1 UN" / "1 UNID": no es una cantidad real, es el envase entero
const esContenidoUnitarioInvalido = (contenido) =>
  !!contenido && /^1\s*(ud|un|unid)\.?$/i.test(contenido.trim());

// REGLA PRINCIPAL E INELUDIBLE: cuando la unidad de medida es de tipo "unidad" (UD/UN),
// la única fuente de verdad es la división precio final / precio por unidad.
// El título no siempre trae la cantidad real y la regex de texto falla.
const calcularUnidadesExactas = (precioFinal, precioPorUnd) => {
  const pf = Number(precioFinal);
  const ppu = Number(precioPorUnd);
  if (!pf || !ppu || Number.isNaN(pf) || Number.isNaN(ppu) || ppu <= 0) return null;
  const unidades = Math.round(pf / ppu);
  return unidades > 0 ? `${unidades} UNID` : null;
};

const normalizarUnidadMedida = (unidad = '') => {
  const u = unidad.trim().toLowerCase();

  if (['l', 'lt', 'lts', 'litro', 'litros'].includes(u)) return 'L';
  if (['ml', 'cc'].includes(u)) return 'ML';
  if (['g', 'gr', 'grs', 'gramos'].includes(u)) return 'GR';
  if (['kg', 'kilo', 'kilos'].includes(u)) return 'KG';
  if (['u', 'unid', 'unidad', 'unidades'].includes(u)) return 'UNID';

  return unidad.toUpperCase();
};

const formatearPrecioPorUnidad = (precioPorUnd, unidadMedida) => {
  const valor = Number(precioPorUnd);

  if (!precioPorUnd || Number.isNaN(valor) || valor <= 0) return null;

  const precioFormateado = valor.toLocaleString('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  const unidad = normalizarUnidadMedida(unidadMedida || '');

  return `${precioFormateado} x  ${unidad}`;
};

export const mapearProductoDia = (dataOriginal = []) => {
  if (!Array.isArray(dataOriginal)) return [];

  return dataOriginal
    .map((item) => {
      const id = item.productId || item.items?.[0]?.itemId || Math.random().toString(36).substr(2, 9);
      const nombre = item.productName || item.productTitle || 'Producto sin nombre';
      const marca = (item.brand || 'Sin marca').toString().toUpperCase().trim();

      const seller = item.items?.[0]?.sellers?.[0]?.commertialOffer;
      const precioFinal = seller?.Price || seller?.ListPrice || 0;
      const imagenProducto = item.items?.[0]?.images?.[0]?.imageUrl || '';

      const precioPorUnd = item['PrecioPorUnd']?.[0] ?? item.PrecioPorUnd;
      const unidadDeMedida = (item['UnidaddeMedida']?.[0] ?? item.UnidaddeMedida ?? '')
        .toString()
        .trim()
        .toUpperCase();
      const precioPorUnidad = formatearPrecioPorUnidad(precioPorUnd, unidadDeMedida);
      const esUnidadTipoUnidad = unidadDeMedida.includes('UD') || unidadDeMedida.includes('UN');

      let contenido = null;

      // PRIORIDAD 1 (obligatoria): si es un producto por unidad, calcular por división.
      if (esUnidadTipoUnidad) {
        contenido = calcularUnidadesExactas(precioFinal, precioPorUnd);
      }

      // PRIORIDAD 2: extraer la cantidad real desde el título comercial
      if (!contenido) {
        contenido = contarUnidadesDesdeTitulo(nombre) || extraerContenidoDeTexto(nombre) || null;
      }

      // PRIORIDAD 3: recién si todo lo anterior falló, usar los metadatos globales
      if (!contenido) {
        const contenidoBruto =
          item['UnidaddeMedida']?.[0] ||
          item['Contenido Neto']?.[0] ||
          item['Presentacion']?.[0] ||
          '';
        contenido = extraerContenidoDeTexto(contenidoBruto) || contenidoBruto || null;
      }

      // Limpieza final: solo aplica si el contenido NO vino del cálculo estricto por división
      if (!esUnidadTipoUnidad && esContenidoUnitarioInvalido(contenido)) {
        contenido = contarUnidadesDesdeTitulo(nombre) || null;
      }

      let promocion = null;
      if (seller?.Teasers && seller.Teasers.length > 0) {
        promocion = seller.Teasers[0]['<Name>k__BackingField'] || 'Oferta disponible';
      } else if (seller?.Price < seller?.ListPrice) {
        promocion = 'En oferta';
      }

      return {
        id: `dia-${id}`,
        tienda: 'dia',
        nombre,
        precio: Number(precioFinal),
        marca,
        categoria: item.categories?.[0]?.split('/')[1] || 'General',
        contenido: contenido || 'Sin especificar',
        precioPorUnidad,
        promocion,
        imagenProducto,
        linkCompra: item.link || 'https://diaonline.supermercadosdia.com.ar',
      };
    })
    .filter((producto) => producto.precio > 0);
};
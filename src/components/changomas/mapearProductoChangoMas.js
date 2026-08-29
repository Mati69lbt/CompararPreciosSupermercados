// src/utils/mappers/mapearProductoChangoMas.js

import { extraerDatosPapel } from '../../utils/extraerDatosPapel';

const extraerContenidoDeTexto = (texto = '') => {
  if (!texto) return '';

  // RegEx mejorada para detectar enteros y decimales seguidos de unidades
  const regex = /(\d+(?:[\.,]\d+)?)\s*(l|lt|lts|litro|litros|ml|cc|g|gr|grs|gramos|kg|kilo|kilos|u|unid|unidades)\b/i;
  const match = texto.match(regex);

  if (match) {
    let cantidad = match[1].replace(',', '.');
    // Si termina en .0 (ej: 1.0), lo dejamos como 1
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

const primero = (valor) => (Array.isArray(valor) ? valor[0] : valor);

const obtenerContenidoDesdeGramaje = (item) => {
  const contenidoBruto =
    primero(item['Unidad de medida']) ||
    primero(item['Contenido Neto']) ||
    primero(item['Gramaje']) ||
    '';
  return extraerContenidoDeTexto(contenidoBruto);
};

// ChangoMás informa la cantidad exacta de unidades (paquetes/packs) en
// "Gramaje factor de conversión" cuando "Gramaje de unidad de medida" es UNI/UNID/UD/UN.
// Ese dato es más confiable que intentar parsearlo del nombre o de otros atributos.
const obtenerContenidoChangoMas = (item, nombre) => {
  const unidadMedidaRaw = primero(item['Gramaje de unidad de medida']) || '';
  const factorConversionRaw = primero(item['Gramaje factor de conversión']);

  const unidadClean = unidadMedidaRaw.toString().trim().toUpperCase();

  if (['UNI', 'UNID', 'UD', 'UN'].includes(unidadClean)) {
    if (factorConversionRaw) {
      const cantidad = parseFloat(String(factorConversionRaw).replace(',', '.'));
      if (!Number.isNaN(cantidad) && cantidad > 0) {
        return `${Math.round(cantidad)} UNID`;
      }
    }
  }

  const contenidoNombre = extraerContenidoDeTexto(nombre);
  if (contenidoNombre) return contenidoNombre;

  const contenidoGramaje = obtenerContenidoDesdeGramaje(item);
  if (contenidoGramaje) return contenidoGramaje;

  return '';
};

const formatearPrecio = (valor) =>
  Number(valor).toLocaleString('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

// ChangoMás no trae precio por kilo/litro de origen: lo calculamos a partir
// del precio final y del "contenido" ya extraído (ej: "1.5 L", "500 ML", "40 GR")
const calcularPrecioPorUnidad = (precioFinal, contenido) => {
  const precio = Number(precioFinal);
  if (!precio || precio <= 0) return null;

  if (!contenido || contenido === 'Sin especificar') {
    return `${formatearPrecio(precio)} x 1 UNID`;
  }

  const match = contenido.match(/^(\d+(?:[.,]\d+)?)\s*(GR|KG|ML|L|UNID)$/i);
  if (!match) return null;

  const cantidad = parseFloat(match[1].replace(',', '.'));
  const unidad = match[2].toUpperCase();

  if (unidad === 'UNID') {
    if (cantidad > 1) {
      const precioUnitario = precio / cantidad;
      const formateado = precioUnitario.toLocaleString('es-AR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      return `$${formateado} x 1 UNID`;
    }
    return `${formatearPrecio(precio)} x 1 UNID`;
  }

  const esPeso = unidad === 'GR' || unidad === 'KG';
  const totalBase = unidad === 'KG' || unidad === 'L' ? cantidad * 1000 : cantidad;
  if (!totalBase || totalBase <= 0) return null;

  const unidadFinal = esPeso ? 'KG' : 'L';
  const precioPorUnidad = (precio / totalBase) * 1000;

  return `${formatearPrecio(precioPorUnidad)} x 1 ${unidadFinal}`;
};

// Descarta ítems sin stock real antes de mapear (IsAvailable=true y AvailableQuantity>0)
const isProductAvailable = (item) => {
  const offer = item?.items?.[0]?.sellers?.[0]?.commertialOffer;
  return offer?.IsAvailable === true && (offer?.AvailableQuantity ?? 0) > 0;
};

export const mapearProductoChangoMas = (dataOriginal = []) => {
  if (!Array.isArray(dataOriginal)) return [];

  return dataOriginal
    .filter(isProductAvailable)
    .map((item) => {
      const id = item.productId || item.items?.[0]?.itemId || Math.random().toString(36).substr(2, 9);
      const nombre = item.productName || item.productTitle || item.items?.[0]?.nameComplete || 'Producto sin nombre';
      const marca = (item.brand || 'Sin marca').toString().toUpperCase().trim();

      const seller = item.items?.[0]?.sellers?.[0]?.commertialOffer;
      const precioFinal = seller?.Price || seller?.ListPrice || 0;
      const imagenProducto = item.items?.[0]?.images?.[0]?.imageUrl || '';

      const contenido = obtenerContenidoChangoMas(item, nombre);

      let promocion = null;
      if (seller?.Teasers && seller.Teasers.length > 0) {
        promocion = seller.Teasers[0]['<Name>k__BackingField'] || 'Oferta disponible';
      } else if (seller?.Price < seller?.ListPrice) {
        promocion = 'En oferta';
      }

      const contenidoFinal = contenido || 'Sin especificar';
      const precioPorUnidad = calcularPrecioPorUnidad(precioFinal, contenidoFinal);
      const datosPapel = extraerDatosPapel(nombre, precioFinal, 'changomas');

      return {
        id: `changomas-${id}`,
        tienda: 'changomas',
        nombre,
        precio: Number(precioFinal),
        listPrice: Number(seller?.ListPrice || precioFinal),
        marca,
        categoria: item.categories?.[0]?.split('/')[1] || 'General',
        contenido: datosPapel?.contenido || contenidoFinal,
        precioPorUnidad: datosPapel?.precioPorUnidad || precioPorUnidad,
        promocion,
        imagenProducto,
        linkCompra: item.link || 'https://www.masonline.com.ar',
      };
    })
    .filter((producto) => producto.precio > 0);
};
// segundaPrueba.js

// cspell: ignore jumboargentinav NUMERICAS Peticion Reemplazá Skus matchea matcheando parsear reintenta skus parseada codigos Vacia codigo  

export const SELLER_VEA_DEFAULT = "jumboargentinav700cordoba700";

// Acumulador global donde se guardan los códigos/nombres de las promos leídas
export const codigosPromocionesAcumulados = [];

const CHUNK_SIZE = 5;
const DELAY_ENTRE_LOTES_MS = 400;
const MAX_REINTENTOS_LOTE = 2;
const CONCURRENCIA_LOTES = 4;

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Ejecuta `fn` sobre `items` con hasta `limite` tareas en paralelo,
// evitando disparar todos los lotes a la vez (throttling de VTEX).
async function mapConConcurrencia(items, limite, fn) {
  const resultados = new Array(items.length);
  let indice = 0;

  async function trabajador() {
    while (indice < items.length) {
      const i = indice++;
      resultados[i] = await fn(items[i], i);
    }
  }

  const trabajadores = Array.from(
    { length: Math.min(limite, items.length) },
    trabajador,
  );
  await Promise.all(trabajadores);
  return resultados;
}

// Divide un array en trozos de tamaño `size`
function dividirEnLotes(array, size) {
  const lotes = [];
  for (let i = 0; i < array.length; i += size) {
    lotes.push(array.slice(i, i + size));
  }
  return lotes;
}

// Un lote se considera "sospechosamente vacío" cuando la API responde 200
// pero sin ninguna promo en ningún nodo: suele ser throttling silencioso de
// VTEX ante ráfagas de POST a search-promotions, no ausencia real de promos.
function esRespuestaVacia(data) {
  const nodos = data?.promotions;
  if (!nodos || typeof nodos !== "object") return true;
  return Object.values(nodos).every(
    (nodo) => !nodo?.promotions || Object.keys(nodo.promotions).length === 0,
  );
}

// Intenta extraer un porcentaje desde texto (ej: "20%", "70% EN LA 2DA")
function parsearPorcentajeDeString(texto) {
  if (typeof texto !== "string") return null;
  const match = texto.match(/(\d+(?:[.,]\d+)?)\s*%/);
  if (!match) return null;
  const valor = parseFloat(match[1].replace(",", "."));
  return Number.isNaN(valor) ? null : valor;
}

// Normaliza el nodo generic a un Array utilizable
function normalizarGeneric(generic) {
  if (!generic) return [];
  if (Array.isArray(generic)) return generic;
  if (typeof generic === "object") return Object.values(generic);
  return [];
}

// Busca la promo por itemId dentro de un array/lista de promociones candidatos
function buscarPorcentualEnGeneric(generic, itemId) {
  const candidatos = normalizarGeneric(generic);

  for (const promo of candidatos) {
    if (!promo || typeof promo !== "object") continue;

    const idsPromo = [promo.itemId, promo.skuId, promo.id]
      .filter((v) => v !== undefined && v !== null)
      .map(String);

    if (!idsPromo.includes(String(itemId))) continue;

    const porcentaje = extraerDescuentoPorcentual(promo);
    if (porcentaje && porcentaje > 0) return porcentaje;
  }

  return 0;
}

export function extraerDescuentoPorcentual(promo) {
  const info = extraerInformacionPromo(promo);
  return info ? info.porcentaje : 0;
}

// Procesa valores tanto enteros (18) como decimales (0.18 -> 18%)
export function extraerInformacionPromo(promo) {
  if (!promo || typeof promo !== "object") return null;

const TIPOS_PERMITIDOS = ["percentual", "fixed_price"];
  if (promo.categoryType !== undefined && !TIPOS_PERMITIDOS.includes(promo.categoryType)) {
    return null;
  }

  let porcentaje = null;
  let textoPromo = null;

  // 1. Extraer texto promocional (code, description, teaserType).
  // "name" queda excluido a propósito: nunca debe usarse como leyenda.
  const CLAVES_STRING = ["code", "description", "teaserType"];
  for (const clave of CLAVES_STRING) {
    if (promo[clave] && typeof promo[clave] === "string" && promo[clave].trim() !== "") {
      textoPromo = promo[clave].trim();
      break;
    }
  }

  // 2. Intentar buscar porcentaje numérico en campos dedicados
  const CLAVES_NUMERICAS = [
    "effectiveDiscount",
    "nominalDiscount",
    "discount",
    "discountPercentage",
    "percent",
    "percentage",
    "value",
    "rate",
    "teaserValue",
  ];

  for (const clave of CLAVES_NUMERICAS) {
    const valor = promo[clave];
    if (valor === undefined || valor === null || valor === "") continue;
    const numero = parseFloat(valor);
    if (!Number.isNaN(numero) && numero > 0) {
      porcentaje = numero <= 1 ? Math.round(numero * 100) : numero;
      break;
    }
  }

  // 3. Si no había % numérico, intentar parsearlo desde el texto
  if (!porcentaje && textoPromo) {
    porcentaje = parsearPorcentajeDeString(textoPromo);
  }

  // Si no se encontró ningún nombre ni % numérico pero el objeto tiene datos
  if (!textoPromo && porcentaje) {
    textoPromo = `${porcentaje}% OFF`;
  }

  return {
    porcentaje: porcentaje || 0,
    textoPromo: textoPromo || null,
  };
}

// Navega la estructura anidada de VTEX devolviendo % y texto descriptivo
export function obtenerDescuentoParaSku(promocionesRaw, itemId) {
  if (!promocionesRaw || !itemId) return { porcentaje: 0, textoPromo: null };

  const idBuscado = String(itemId);

  let entradaDirecta = promocionesRaw[idBuscado];
  const promocionesAnidadas =
    promocionesRaw.promotions?.generic?.promotions ||
    promocionesRaw.generic?.promotions ||
    promocionesRaw.generic ||
    null;

  if (!entradaDirecta && promocionesAnidadas) {
    entradaDirecta = promocionesAnidadas[idBuscado];
  }

  if (entradaDirecta) {
    const info = extraerInformacionPromo(entradaDirecta);
    if (info) return info;
  }

  // Fallback si viene en arrays/listas
  const listaCandidatos = normalizarGeneric(promocionesAnidadas || promocionesRaw);
  for (const promo of listaCandidatos) {
    if (!promo || typeof promo !== "object") continue;
    const idsPromo = [promo.itemId, promo.skuId, promo.id]
      .filter((v) => v !== undefined && v !== null)
      .map(String);

    if (idsPromo.includes(idBuscado)) {
      const info = extraerInformacionPromo(promo);
      if (info) return info;
    }
  }

  return { porcentaje: 0, textoPromo: null };
}

async function hacerPeticionPromo(skusLote, seller) {
  try {
    const res = await fetch("/promos-vea/_v/search-promotions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seller, skus: skusLote }),
    });

    

    if (!res.ok) {
      if (res.status === 429) {
        console.warn("⚠️ search-promotions: 429 Too Many Requests para", skusLote, "seller:", seller);
      } else if (res.status === 403) {
        console.warn("⚠️ search-promotions: 403 Forbidden para", skusLote, "seller:", seller);
      } else {
        console.warn("⚠️ search-promotions respondió", res.status, "para", skusLote);
      }
      return null;
    }

    const textoCrudo = await res.text();
    
    
    let data;
    try {
      data = textoCrudo ? JSON.parse(textoCrudo) : {};
    } catch {
      console.warn("⚠️ search-promotions: respuesta no es JSON válido:", textoCrudo);
      return null;
    }



    

    const promosGeneric = data?.promotions?.generic?.promotions || {};
    const cantidadPromos = Object.keys(promosGeneric).length;

    // --- GUARDAR CÓDIGOS DE PROMOCIONES ---
    Object.entries(promosGeneric).forEach(([skuKey, promoObj]) => {
      const codigo = promoObj?.code;
      if (codigo) {
        codigosPromocionesAcumulados.push({
          sku: skuKey,
          code: codigo,
          fecha: new Date().toISOString(),
        });
      }
    });



    return data;
  } catch (error) {
    console.warn("⚠️ Error en petición de promociones:", error);
    return null;
  }
}

// Función auxiliar para combinar objetos anidados profundamente sin sobrescribir nodos
function deepMerge(target, source) {
  if (!source || typeof source !== "object") return target;

  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === "object" &&
      !Array.isArray(source[key])
    ) {
      if (!target[key] || typeof target[key] !== "object") {
        target[key] = {};
      }
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

export async function obtenerPromocionesVea(skus, seller = SELLER_VEA_DEFAULT) {
  // BLINDAJE: Si el seller es "1" o inválido, usamos el default real
  const sellerValido = (!seller || seller === "1" || seller.length < 5) 
    ? SELLER_VEA_DEFAULT 
    : seller;

  const arraySkus = Array.isArray(skus) ? skus : [skus];
  const skusLimpios = arraySkus
    .filter(Boolean)
    .map(String)
    .sort((a, b) => Number(a) - Number(b));



  if (!skusLimpios.length) return {};

const lotes = dividirEnLotes(skusLimpios, CHUNK_SIZE);

  const procesarLote = async (lote) => {
    let data = null;
    for (let intento = 0; intento <= MAX_REINTENTOS_LOTE; intento++) {
      if (intento > 0) {
        await esperar(DELAY_ENTRE_LOTES_MS * (intento + 1));
      }

      // Se envía sellerValido en lugar de seller
      data = await hacerPeticionPromo(lote, sellerValido);

      if (data && !(lote.length > 1 && esRespuestaVacia(data))) break;
    }
    return data;
  };

  // Los lotes son independientes entre sí: los resolvemos en paralelo
  // (con límite de concurrencia) en vez de uno por uno.
  const resultadosLotes = await mapConConcurrencia(
    lotes,
    CONCURRENCIA_LOTES,
    procesarLote,
  );

  const promocionesUnificadas = {};
  resultadosLotes.forEach((data) => {
    if (data) deepMerge(promocionesUnificadas, data);
  });

  return promocionesUnificadas;
}

export default obtenerPromocionesVea;

// segundaPrueba.js (al final del archivo)



// 📍 ACÁ ESTABA EL FETCH DE PRUEBA MANUAL
fetch("/promos-vea/_v/search-promotions", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    seller: "jumboargentinav700cordoba700",
    skus: ["407873"] // 👈 SKU a probar individualmente
  })
})
  .then(res => res.json())
  .then(data => console.log("🔥 RESPUESTA EN CRUDO:", data))
  .catch(err => console.error("Error:", err));
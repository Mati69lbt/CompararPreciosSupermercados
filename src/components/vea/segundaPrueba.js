// segundaPrueba.js

export const SELLER_VEA_DEFAULT = "jumboargentinav700cordoba700";

// Lotes más pequeños para evitar saturar el endpoint de VTEX
const CHUNK_SIZE = 10;

// Extrae el nodo de promociones probando varias rutas posibles de la respuesta,
// porque "_v/search-promotions" es un endpoint custom de la tienda (no VTEX
// estándar) y su forma exacta no está documentada públicamente.
function extraerNodoPromociones(data) {
  return (
    data?.promotions?.generic?.promotions ||
    data?.promotions?.generic ||
    data?.generic?.promotions ||
    data?.promotions ||
    data?.teaser ||
    data?.teasers ||
    null
  );
}

// Función auxiliar para hacer la petición individual/lote
async function hacerPeticionPromo(skusLote, seller) {
  try {
    const res = await fetch("/promos-vea/_v/search-promotions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seller, skus: skusLote }),
    });

    if (!res.ok) {
      console.warn("⚠️ search-promotions respondió", res.status, "para", skusLote);
      return null;
    }
    const data = await res.json();

    // Log completo SIEMPRE (no solo cuando hay datos) para poder inspeccionar
    // la forma real que devuelve VTEX/la tienda y ajustar extraerNodoPromociones.
    console.log("🔎 Respuesta cruda search-promotions:", skusLote, JSON.stringify(data));

    const nodo = extraerNodoPromociones(data);

    // Blindaje: si el nodo no es un objeto usable (null, undefined, {} vacío, u otro tipo),
    // se devuelve null para que el llamador no intente hacer Object.assign con basura.
    if (!nodo || typeof nodo !== "object" || Object.keys(nodo).length === 0) {
      return null;
    }

    console.log("✅ Nodo de promociones detectado:", nodo);
    return nodo;
  } catch (error) {
    console.warn("⚠️ Error en petición de promociones:", error);
    return null;
  }
}

export async function obtenerPromocionesVea(skus, seller = SELLER_VEA_DEFAULT) {
  const arraySkus = Array.isArray(skus) ? skus : [skus];
  
  const skusLimpios = arraySkus.filter(Boolean).map(String);
  
  
  if (!skusLimpios.length) return {};

  const lotes = [];
  for (let i = 0; i < skusLimpios.length; i += CHUNK_SIZE) {
    lotes.push(skusLimpios.slice(i, i + CHUNK_SIZE));
  }

  const promocionesUnificadas = {};

  // Procesamos lote por lote de forma secuencial para no ahogar la API
  for (const lote of lotes) {
    let promos = await hacerPeticionPromo(lote, seller);

    console.log("📦 Promociones obtenidas para el lote:", lote, promos);

    // FALLBACK: Si el lote falló (HTTP 500), probamos esos SKUs uno por uno
    if (!promos && lote.length > 1) {
      for (const skuIndividual of lote) {
        const promoIndividual = await hacerPeticionPromo([skuIndividual], seller);
        if (promoIndividual) {
          Object.assign(promocionesUnificadas, promoIndividual);
        }
      }
    } else if (promos) {
      Object.assign(promocionesUnificadas, promos);
    }
  }

  return promocionesUnificadas;
}

export default obtenerPromocionesVea;
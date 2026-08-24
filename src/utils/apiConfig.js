const TIENDAS_URLS = {
  carrefour: "https://www.carrefour.com.ar/api/catalog_system/pub/products/search",
  dia: "https://diaonline.supermercadosdia.com.ar/api/catalog_system/pub/products/search",
  changomas: "https://www.masonline.com.ar/api/catalog_system/pub/products/search",
  vea: "https://www.vea.com.ar/api/catalog_system/pub/products/search",
};

export const getApiUrl = (tienda, endpoint) => {
  if (import.meta.env.DEV) {
    return `/api-${tienda}${endpoint}`;
  }

  const baseUrl = TIENDAS_URLS[tienda];
  const targetUrl = encodeURIComponent(`${baseUrl}${endpoint}`);
  return `/api/proxy?url=${targetUrl}`;
};

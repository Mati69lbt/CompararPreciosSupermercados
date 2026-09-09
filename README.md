# Comparativa de precios — Supermercados AR

App en React (Vite + Tailwind v4) que busca un mismo producto en varios supermercados argentinos (Carrefour, Día, ChangoMás, Vea, Coto) y compara precios lado a lado en una grilla de 5 columnas, con filtros globales de marca y medida.

Con `react-router-dom` tiene dos rutas:

- `/` — buscador manual (`App.jsx`): el usuario tipea un término y se compara ese producto en las 5 tiendas.
- `/ofertas` — relevamiento automático (`src/ofertas/page/ofertas.jsx`): recorre una canasta fija de términos (`src/ofertas/data/terminosCanasta.js`) contra las 5 tiendas, se queda solo con los productos en oferta (`precio < listPrice`) y calcula el % de descuento.

> Documento para cliente (qué es y cómo funciona, sin jerga técnica): [`docs/guia-cliente.md`](docs/guia-cliente.md)

Mercado Libre tiene integración propia (`src/components/mercadoLibre/`) pero no está montada en ninguna de las dos rutas actualmente.

## Comandos

```bash
npm run dev       # servidor de desarrollo (Vite)
npm run build     # build de producción
npm run preview   # sirve el build de producción
npm run lint      # ESLint sobre todo el repo
npm run deploy    # publica dist/ a GitHub Pages (gh-pages)
```

Deploy: proyecto en Vercel (build de Vite + función serverless `api/proxy.js`). Push a `main` dispara el deploy. También existe un deploy alternativo a GitHub Pages vía `npm run deploy`.

No hay suite de tests configurada.

## Variables de entorno (`.env.local`)

```
VITE_API_CARREFOUR
VITE_API_DIA
VITE_API_CHANGOMAS
VITE_API_VEA
VITE_API_MERCADOLIBRE
VITE_API_COTO_KEY
VITE_API_COTO_STORE
VITE_MELI_CLIENT_ID
VITE_MELI_CLIENT_SECRET
```

## Arquitectura

Cada supermercado tiene su carpeta en `src/components/<tienda>/` con dos archivos:

- `Products<Tienda>.jsx` — hace el fetch, guarda estado (`productos`, `cargando`, filtros de marca/contenido) y renderiza la grilla de resultados.
- `mapearProducto<Tienda>.js` — transforma la respuesta cruda de la API al modelo común de producto:

```js
{ id, tienda, nombre, precio, marca, categoria, contenido, promocion, imagenProducto, linkCompra }
```

`App.jsx` monta las 5 tiendas en simultáneo en una grilla, con filtros globales de marca y medida (contenido) que se aplican en cascada sobre los resultados de todas.

### Familias de APIs

- **VTEX** (Carrefour, Día, ChangoMás, Vea): array de productos con estructura VTEX estándar (`items[0].sellers[0].commertialOffer`, campos custom como `Marca Gnx`, `Gramaje de unidad de consumo`, etc).
- **Coto**: API BFF propia (`api.coto.com.ar/.../products/search/...`), estructura `response.results[].data`, precio por sucursal (array `price` filtrado por `VITE_API_COTO_STORE`).
- **Mercado Libre**: API pública, requiere OAuth (`VITE_MELI_CLIENT_ID` / `VITE_MELI_CLIENT_SECRET`).

En dev, `src/utils/apiConfig.js` arma las URLs contra los proxies locales (`vite.config.js`); en producción pasa por `api/proxy.js`, una función serverless de Vercel que reenvía la petición con headers propios (`User-Agent`, `Accept`) y habilita CORS, evitando los bloqueos 403 de proxies públicos.

### Extracción de contenido/medida

Cada mapeador VTEX extrae el peso/volumen (ej. "1.5 L", "800 GR") parseando el nombre del producto con una regex compartida por convención (duplicada archivo por archivo, no extraída a un util común todavía), y lo canonicaliza como `"<numero> <UNIDAD>"` (GR/KG/ML/L/UNID). Detalle del parseo y de un bug conocido de falsos positivos en `docs/normalizacion-vtex.md`.

Caso especial: papel higiénico / rollos de cocina se resuelve aparte en `src/utils/extraerDatosPapel.js`, con regex de cantidad de rollos y metraje propias por tienda (el título mezcla "x N unidades" con "N metros" en formatos distintos según el supermercado).

### Coincidencia de productos entre tiendas (`src/utils/productMatch.js`)

`construirInfoDeCoincidencias` agrupa productos de todas las tiendas que son "el mismo producto" (mismo EAN si está disponible, o mismo `marca + contenido equivalente + palabras clave del nombre` normalizadas) y marca cada uno como `unico` (sin equivalente en otra tienda), `ganador` (precio más bajo del grupo) o `compite`. `ProductMatchContext` expone esa info a los componentes de producto para resaltar visualmente ganadores/competidores.

### Precio por unidad (`src/utils/precioPorUnidad.js`)

`calcularPrecioPorUnidad` deriva precio por KG/L/unidad a partir de `precio` + `contenido`, y `ordenarPorPrecioRelativo` ordena una lista de productos por ese valor (usado en `/ofertas` para comparar packs de distinto tamaño).

### Página de ofertas (`src/ofertas/`)

- `page/ofertas.jsx` — dispara los fetches de la canasta de términos contra las 4 APIs VTEX + Coto, limitando concurrencia con `utils/ejecutarConLimite.js` (evita saturar los proxies de dev), filtra por descuento real y ordena/pagina el resultado.
- `utils/persistenciaFiltros.js` — persiste filtros e historial de búsqueda en `localStorage` con TTL (3hs): entradas vencidas se descartan solas al leer.
- `data/terminosCanasta.js` — lista de términos de la canasta básica que se recorre en cada relevamiento.

### Proxy de desarrollo (`vite.config.js`)

Las APIs VTEX están mapeadas a rutas locales para evitar CORS en dev: `/api-carrefour`, `/api-dia`, `/api-changomas`, `/api-vea`, `/api-meli`. Coto se llama directo desde el browser (no tiene proxy configurado).

# Comparativa de precios — Supermercados AR

App en React (Vite + Tailwind v4) que busca un mismo producto en varios supermercados argentinos (Carrefour, Día, ChangoMás, Vea, Coto) y en Mercado Libre, y compara precios lado a lado.

## Comandos

```bash
npm run dev       # servidor de desarrollo (Vite)
npm run build     # build de producción
npm run preview   # sirve el build de producción
npm run lint      # ESLint sobre todo el repo
npm run deploy    # publica dist/ en GitHub Pages (gh-pages)
```

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

En dev, `src/utils/apiConfig.js` arma las URLs contra los proxies locales (`vite.config.js`); en producción pasa por un CORS proxy público (`corsproxy.io`) ya que no hay backend propio.

### Extracción de contenido/medida

Cada mapeador VTEX extrae el peso/volumen (ej. "1.5 L", "800 GR") parseando el nombre del producto con una regex compartida por convención (duplicada archivo por archivo, no extraída a un util común todavía). Detalle del parseo y de un bug conocido de falsos positivos en `docs/normalizacion-vtex.md`.

### Proxy de desarrollo (`vite.config.js`)

Las APIs VTEX están mapeadas a rutas locales para evitar CORS en dev: `/api-carrefour`, `/api-dia`, `/api-changomas`, `/api-vea`, `/api-meli`. Coto se llama directo desde el browser (no tiene proxy configurado).

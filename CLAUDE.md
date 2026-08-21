# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Comandos

- `npm run dev` — servidor de desarrollo (Vite)
- `npm run build` — build de producción
- `npm run lint` — ESLint sobre todo el repo
- `npm run preview` — sirve el build de producción

No hay suite de tests configurada.

## Qué es esto

App React (Vite + Tailwind v4) que compara precios de productos entre supermercados argentinos (Coto, Carrefour, Día, ChangoMás, Vea) y Mercado Libre, buscando el mismo producto en varias APIs y normalizando los resultados a un formato común.

## Arquitectura

Cada supermercado tiene una carpeta en `src/components/<tienda>/` con dos archivos:

- `Products<Tienda>.jsx` — componente que hace el fetch, guarda estado (`productos`, `cargando`, filtros de marca/contenido), y renderiza la grilla de resultados.
- `mapearProducto<Tienda>.js` — transforma la respuesta cruda de la API de esa tienda al modelo común de producto:
  ```
  { id, tienda, nombre, precio, marca, categoria, contenido, promocion, imagenProducto, linkCompra }
  ```

Todos los mapeadores extraen y normalizan el "contenido" (peso/volumen, ej. "1.5 L", "800 GR") parseando el nombre del producto con una regex compartida (duplicada en cada archivo, no extraída a un util común todavía).

Dos familias de APIs de origen:
- **VTEX** (Carrefour, Día, ChangoMás, Vea): responden un array de productos con estructura VTEX estándar (`items[0].sellers[0].commertialOffer`, campos custom como `Marca Gnx`, `Gramaje de unidad de consumo`, etc).
- **Coto**: API BFF propia (`api.coto.com.ar/.../products/search/...`), estructura `response.results[].data`, con precio por sucursal (array `price` filtrado por `VITE_API_COTO_STORE`).
- **Mercado Libre**: API pública, requiere OAuth (`VITE_MELI_CLIENT_ID`/`SECRET`).

`SUPERMARKET_LOGOS` (`src/assets/logos/logos.js`) mapea `tienda` → logo, inyectado en cada producto mapeado como `logoTienda`.

`App.jsx` actualmente monta un solo componente de tienda a la vez (el resto están comentados) — es el punto de entrada para probar/depurar cada integración individualmente.

### Proxy de desarrollo (`vite.config.js`)

Las APIs VTEX de cada tienda están mapeadas a rutas locales para evitar CORS en dev: `/api-carrefour`, `/api-dia`, `/api-changomas`, `/api-vea`, `/api-meli`. Coto se llama directo desde el browser (no tiene proxy configurado).

### Variables de entorno (`.env.local`)

`VITE_API_CARREFOUR`, `VITE_API_DIA`, `VITE_API_CHANGOMAS`, `VITE_API_VEA`, `VITE_API_MERCADOLIBRE`, `VITE_API_COTO_KEY`, `VITE_API_COTO_STORE`, `VITE_MELI_CLIENT_ID`, `VITE_MELI_CLIENT_SECRET`.

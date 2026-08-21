# SPEC-001: Buscador Global y Tabla Comparativa Multi-Tienda

## 1. Contexto y Objetivo

Actualmente `App.jsx` renderiza un solo supermercado a la vez con la búsqueda harcodeada de "leche". Se requiere refactorizar la aplicación para convertirla en un comparador global en tiempo real.

El usuario podrá ingresar cualquier término de búsqueda y ver los resultados de los 5 supermercados (Carrefour, Día, ChangoMás, Vea y Coto) en una vista multicolumna (tabla/grid) para pantallas grandes, manteniendo los filtros por Marca, Medida/Contenido y el ordenamiento automático de menor a mayor precio.

---

## 2. Instrucciones para Claude Code

### Reglas de Ejecución y Notificación

- **PROHIBIDO** preguntar si se debe emitir sonido o confirmaciones intermedias durante la ejecución.
- Al **finalizar completamente** la tarea con éxito, ejecuta el comando de consola para emitir un aviso sonoro:
  ```bash
  powershell -c "[console]::beep(1000, 300)"
  ```
- Si la tarea termina con error, emite un tono diferente:
  ```bash
  powershell -c "[console]::beep(400, 600)"
  ```

## 3. Requerimientos Técnicos y Cambios en la UI

#### A. Buscador Global (App.jsx)

- Reemplazar la renderización individual de tiendas por un componente de búsqueda global superior.

- Incluir un input de texto y un botón de búsqueda (o trigger en Enter).

- Eliminar la búsqueda harcodeada de "leche". La app iniciará vacía o con una sugerencia de búsqueda.

- Al presionar buscar, se debe disparar la carga paralela (4 páginas / 200 productos por tienda) para los 5 supermercados:
  - Carrefour (src/components/carrefour/)

  - Día (src/components/dia/)

  - ChangoMás (src/components/changomas/)

  - Vea (src/components/vea/)

  - Coto (src/components/coto/)

#### B. Vista Multi-Columna / Tabla Comparativa (Pantallas Grandes)

- Para pantallas lg y superiores, renderizar un contenedor principal estructurado en 5 columnas (una por cada supermercado).

- Cada columna debe tener en el encabezado el logo oficial del supermercado, importado desde SUPERMARKET_LOGOS en src/assets/logos/logos.js:

- JavaScript

  ```bash
  import { SUPERMARKET_LOGOS } from './assets/logos/logos';
  ```

- Ajustar el diseño de las tarjetas de producto (ProductCard) para que sean más compactas/pequeñas y encajen limpiamente dentro de las columnas sin saturar la pantalla.

#### C. Controles de Filtros y Ordenamiento

- Ubicar sobre la tabla comparativa los controles globales y/o por columna:

- Filtro por Marca: Muestra las marcas disponibles en los resultados obtenidos.

- Filtro por Medida / Contenido: Muestra las medidas parsedadas (1 L, 500 ML, 1 KG, etc.).

- Regra de Ordenamiento Obligatoria: Los productos de cada columna y resultado filtrado DEBEN estar ordenados estrictamente de MENOR a MAYOR PRECIO (.sort((a, b) => a.precio - b.precio)).

## 4. Archivos Involucrados

- src/App.jsx (Rediseño de la vista global y orquestación)

- src/assets/logos/logos.js (Uso de los logos SUPERMARKET_LOGOS)

- src/components/carrefour/mapearProductoCarrefour.js

- src/components/dia/mapearProductoDia.js

- src/components/changomas/mapearProductoChangoMas.js

- src/components/vea/mapearProductoVea.js

- src/components/coto/mapearProductoCoto.js

## 5. Criterios de Aceptación
1.  El usuario puede escribir cualquier producto en el buscador global y obtener los resultados de las 5 tiendas en paralelo.

2.  En pantallas grandes se despliegan 5 columnas responsivas, cada una con su logo de tienda correspondiente.

3.  El filtro por medida no cruza datos erróneos (ej. filtrar 1 L no debe mostrar chocolates de 12.5 GR u 80 GR).

4.  Todos los productos dentro de cada columna están ordenados por precio ascendente.

5.  Al finalizar con éxito la refactorización, la terminal emite el beep de 300ms a 1000Hz sin preguntas previas.
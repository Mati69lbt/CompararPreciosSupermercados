import React, { useState, useEffect, useMemo } from "react";
import { SUPERMARKET_LOGOS } from "../../assets/logos/logos";
import { mapearProductoMeli } from "./mapearProductoMeli";

let accessTokenMemoria = null;

const PRODUCTOS_POR_PAGINA = 50;
const CATEGORIA_ALMACEN = "MLA1403"; // Categoría Alimentos y Bebidas

const ProductsMeli = () => {
  const [productos, setProductos] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [error, setError] = useState(null);

  const [pagina, setPagina] = useState(0);
  const [hayMasResultados, setHayMasResultados] = useState(true);
  const [busquedaActual] = useState("leche");

  const [contenidoFiltro, setContenidoFiltro] = useState("");

  const obtenerAccessToken = async () => {
    if (accessTokenMemoria) return accessTokenMemoria;

    const clientId = import.meta.env.VITE_MELI_CLIENT_ID;
    const clientSecret = import.meta.env.VITE_MELI_CLIENT_SECRET;

    console.log("CLIENT_ID cargado:", clientId ? "Sí" : "NO ESTÁ DEFINIDO");
    console.log(
      "CLIENT_SECRET cargado:",
      clientSecret ? "Sí" : "NO ESTÁ DEFINIDO",
    );

    const bodyParams = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    });

    const resToken = await fetch("/api-meli/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: bodyParams,
    });

    const dataToken = await resToken.json();
    console.log("Respuesta del servidor OAuth:", dataToken);

    if (dataToken.access_token) {
      accessTokenMemoria = dataToken.access_token;
      return accessTokenMemoria;
    } else {
      throw new Error(
        `Error de autenticación: ${dataToken.message || JSON.stringify(dataToken)}`,
      );
    }
  };

  // Función principal para obtener productos (recibe el número de página a solicitar)
  const obtenerProductosMeli = async (numPagina = 0) => {
    if (!busquedaActual) return;

    // Si es la página 0 mostramos el spinner principal; si es > 0, el de "Cargar más"
    if (numPagina === 0) {
      setCargando(true);
    } else {
      setCargandoMas(true);
    }
    setError(null);

    try {
      const token = await obtenerAccessToken();

      // Calculamos el offset numérico según la página recibida
      const offsetCalculado = numPagina * PRODUCTOS_POR_PAGINA;

      const res = await fetch(
        `/api-meli/sites/MLA/search?q=${encodeURIComponent(
          busquedaActual,
        )}&category=${CATEGORIA_ALMACEN}&offset=${offsetCalculado}&limit=${PRODUCTOS_POR_PAGINA}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const data = await res.json();

      if (res.ok) {
        const rawResults = data.results || [];

        // Mapeamos la respuesta usando la función del mapper
        const productosMapeados = mapearProductoMeli(rawResults);

        if (numPagina === 0) {
          setProductos(productosMapeados);
        } else {
          // Si es paginación acumulativa, anexamos los nuevos productos
          setProductos((prev) => [...prev, ...productosMapeados]);
        }

        // Verificamos si la API trajo menos elementos que el límite o si llegamos al total
        if (
          rawResults.length < PRODUCTOS_POR_PAGINA ||
          offsetCalculado + rawResults.length >= (data.paging?.total || 0)
        ) {
          setHayMasResultados(false);
        } else {
          setHayMasResultados(true);
        }
      } else {
        setError(data.message || "Error al cargar productos de Mercado Libre");
      }
    } catch (err) {
      console.error("Error MeLi:", err);
      setError("Ocurrió un error al conectar con Mercado Libre");
    } finally {
      setCargando(false);
      setCargandoMas(false);
    }
  };

  useEffect(() => {
    setPagina(0);
    obtenerProductosMeli(0);
  }, [busquedaActual]);

  const manejarCargarMas = () => {
    const siguientePagina = pagina + 1;
    setPagina(siguientePagina);
    obtenerProductosMeli(siguientePagina);
  };

  const opcionesContenido = useMemo(() => {
    const todosLosContenidos = productos
      .map((p) => p.contenido)
      .filter((c) => c && c !== "Sin especificar");

    const unicos = [...new Set(todosLosContenidos)];
    return unicos.sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }),
    );
  }, [productos]);

  const productosFiltrados = useMemo(() => {
    if (!contenidoFiltro) return productos;
    return productos.filter((p) => p.contenido === contenidoFiltro);
  }, [productos, contenidoFiltro]);

  return (
    <div className="p-6 bg-slate-900 min-h-screen text-white">
      <h2 className="text-2xl font-bold mb-4 text-center">
        Resultados Mercado Libre
      </h2>

      {/* Controles de Filtro */}
      <div className="max-w-xs mx-auto mb-6 flex flex-col items-center gap-2">
        <label
          htmlFor="select-contenido"
          className="text-xs text-slate-400 font-medium"
        >
          Filtrar por Contenido / Medida:
        </label>
        <select
          id="select-contenido"
          value={contenidoFiltro}
          onChange={(e) => setContenidoFiltro(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg p-2.5 focus:ring-2 focus:ring-yellow-500 focus:outline-none"
        >
          <option value="">
            Todos los contenidos ({productos.length} productos)
          </option>
          {opcionesContenido.map((c, index) => (
            <option key={index} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl text-center mb-6 max-w-md mx-auto">
          {error}
        </div>
      )}

      {cargando ? (
        <p className="text-center text-slate-400">Cargando productos...</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {productosFiltrados.map((prod) => (
              <div
                key={prod.id}
                className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex flex-col justify-between shadow-lg hover:border-slate-500 transition-all overflow-hidden"
              >
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <img
                      src={SUPERMARKET_LOGOS.mercadolibre}
                      alt="Mercado Libre"
                      className="h-6 object-contain"
                    />
                    <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
                      {prod.marca}
                    </span>
                  </div>

                  <div className="w-full h-40 bg-white/5 rounded-lg mb-4 flex items-center justify-center overflow-hidden">
                    {prod.imagenProducto ? (
                      <img
                        src={prod.imagenProducto}
                        alt={prod.nombre}
                        className="h-full object-contain p-2"
                      />
                    ) : (
                      <span className="text-xs text-slate-500">Sin imagen</span>
                    )}
                  </div>

                  <h3 className="font-medium text-slate-100 text-sm mb-2">
                    {prod.nombre}
                  </h3>

                  {prod.promocion && (
                    <div className="mt-1">
                      <span className="inline-block bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 text-xs font-semibold px-2 py-0.5 rounded-md">
                        🏷️ {prod.promocion}
                      </span>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-700/60">
                  <div className="flex justify-between text-xs text-slate-400 mb-2">
                    <span>{prod.categoria}</span>
                    {prod.contenido && (
                      <span className="font-semibold text-slate-300">
                        {prod.contenido}
                      </span>
                    )}
                  </div>

                  <div className="flex justify-between items-baseline mt-2">
                    <span className="text-xs text-slate-400">Precio</span>
                    <span className="text-xl font-extrabold text-emerald-400">
                      ${prod.precio.toLocaleString("es-AR")}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Botón Cargar Más / Mensaje de Fin */}
          <div className="mt-10 flex justify-center">
            {hayMasResultados ? (
              <button
                onClick={manejarCargarMas}
                disabled={cargandoMas}
                className="bg-yellow-600 hover:bg-yellow-500 text-white font-semibold py-2.5 px-6 rounded-xl shadow-lg transition-all border border-yellow-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {cargandoMas ? "Cargando más..." : "Cargar más productos"}
              </button>
            ) : (
              <div className="bg-slate-800/80 border border-slate-700 text-slate-400 px-4 py-2 rounded-lg text-sm font-medium shadow-inner">
                🚫 No hay más productos disponibles para esta búsqueda
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default ProductsMeli;

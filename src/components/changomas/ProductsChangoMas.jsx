import React, { useState, useEffect, useMemo } from "react";
import { SUPERMARKET_LOGOS } from "../../assets/logos/logos";
import { mapearProductoChangoMas } from "./mapearProductoChangoMas";

const PRODUCTOS_POR_PAGINA = 50;

const ProductsChangoMas = () => {
  const [productos, setProductos] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [cargandoMas, setCargandoMas] = useState(false);

  const [pagina, setPagina] = useState(0);
  const [hayMasResultados, setHayMasResultados] = useState(true);
  const [busquedaActual] = useState("leche");

  const [contenidoFiltro, setContenidoFiltro] = useState("");

  const obtenerProductosChangoMas = async (pageIndex = 0) => {
    const esPrimeraCarga = pageIndex === 0;

    if (esPrimeraCarga) {
      setCargando(true);
    } else {
      setCargandoMas(true);
    }

    const from = pageIndex * PRODUCTOS_POR_PAGINA;
    const to = from + PRODUCTOS_POR_PAGINA - 1;

    try {
      const res = await fetch(
        `/api-changomas?ft=${busquedaActual}&_from=${from}&_to=${to}`,
      );
      const data = await res.json();

      if (Array.isArray(data) && data.length > 0) {
        const productosLimpios = mapearProductoChangoMas(data).map((p) => ({
          ...p,
          logoTienda:
            SUPERMARKET_LOGOS.changomas || SUPERMARKET_LOGOS.masonline,
        }));

        setProductos((prev) =>
          esPrimeraCarga ? productosLimpios : [...prev, ...productosLimpios],
        );

        if (data.length < PRODUCTOS_POR_PAGINA) {
          setHayMasResultados(false);
        }
      } else {
        setHayMasResultados(false);
      }
    } catch (error) {
      console.error("❌ Error al procesar MásOnline / ChangoMás:", error);
    } finally {
      setCargando(false);
      setCargandoMas(false);
    }
  };

  useEffect(() => {
    obtenerProductosChangoMas(0);
  }, [busquedaActual]);

  const manejarCargarMas = () => {
    const siguientePagina = pagina + 1;
    setPagina(siguientePagina);
    obtenerProductosChangoMas(siguientePagina);
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
        Resultados MásOnline / ChangoMás
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
          className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg p-2.5 focus:ring-2 focus:ring-amber-500 focus:outline-none"
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
                      src={prod.logoTienda}
                      alt="ChangoMás"
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

                  <h3 className="font-medium text-slate-100 text-sm line-clamp-2 mb-2">
                    {prod.nombre}
                  </h3>

                  {prod.promocion && (
                    <div className="mt-1">
                      <span className="inline-block bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-semibold px-2 py-0.5 rounded-md">
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

          {/* Botón de Cargar Más o Mensaje de fin de catálogo */}
          <div className="mt-10 flex justify-center">
            {hayMasResultados ? (
              <button
                onClick={manejarCargarMas}
                disabled={cargandoMas}
                className="bg-amber-600 hover:bg-amber-500 text-white font-semibold py-2.5 px-6 rounded-xl shadow-lg transition-all border border-amber-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
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

export default ProductsChangoMas;

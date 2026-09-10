import React, { useState, useEffect, useMemo, useRef } from "react";
import { SUPERMARKET_LOGOS } from "../../assets/logos/logos";
import { mapearProductoVea } from "./mapearProductoVea";
import { obtenerRangoContenido } from "../../utils/contenido";
import { getApiUrl } from "../../utils/apiConfig";
import { useEstiloTarjeta } from "../../context/ProductMatchContext";
import { ordenarPorPrecioRelativo } from "../../utils/precioPorUnidad";

//cspell: ignore jumboargentinav NUMERICAS Peticion Reemplazá Skus matchea matcheando parsear reintenta skus Unicos acum busqueda commertial deduplicamos promocion

const PRODUCTOS_POR_PAGINA = 50;

const TarjetaProducto = ({ prod, onSeleccionar, vistaUnica }) => {
  const { claseBorde, onMouseEnter, onMouseLeave } = useEstiloTarjeta(
    "vea",
    prod.id,
  );
  const tieneDescuento = prod.listPrice > prod.precio;
  const descuento = tieneDescuento
    ? Math.round((1 - prod.precio / prod.listPrice) * 100)
    : null;

  return (
    <div
      onClick={() => onSeleccionar(prod)}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`${vistaUnica ? "w-full max-w-[240px]" : "w-[220px] sm:w-[240px] shrink-0 snap-start lg:w-auto lg:shrink lg:snap-align-none"} bg-slate-800 rounded-lg p-2.5 sm:p-2 flex flex-col justify-between shadow transition-all overflow-hidden cursor-pointer hover:scale-[1.01] ${claseBorde}`}
    >
      <div>
        <div className="h-24 sm:h-26 w-full shrink-0 bg-white/5 rounded-md flex items-center justify-center overflow-hidden mb-1.5">
          {prod.imagenProducto ? (
            <img
              src={prod.imagenProducto}
              alt={prod.nombre}
              className="h-full w-full object-contain p-1"
            />
          ) : (
            <span className="text-[9px] text-slate-500">Sin imagen</span>
          )}
        </div>

        <div className="flex items-center justify-between gap-1 mb-1">
          <span className="min-w-0 flex-1 block text-[10px] text-slate-400 uppercase tracking-wider font-semibold truncate">
            {prod.marca}
            {prod.contenido && prod.contenido !== "Sin especificar"
              ? ` - ${prod.contenido}`
              : ""}
          </span>
          {tieneDescuento && (
            <span className="shrink-0 bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[9px] font-bold px-1.5 py-0.5 rounded-md">
              -{descuento}%
            </span>
          )}
        </div>

        <h3
          title={prod.nombre}
          className="font-medium text-slate-100 text-xs line-clamp-2 leading-snug"
        >
          {prod.nombre}
        </h3>
      </div>

      <div>
        <hr className="border-slate-800 my-1.5" />
        <div className="flex items-center justify-between gap-1 text-xs">
          <span className="text-slate-400 font-medium truncate text-[11px]">
            {prod.precioPorUnidad || ""}
          </span>
          {tieneDescuento && (
            <span className="text-slate-500 font-normal text-[11px] px-1 whitespace-nowrap line-through">
              ${prod.listPrice.toLocaleString("es-AR")}
            </span>
          )}
          <span className="text-emerald-400 font-bold text-xs sm:text-sm whitespace-nowrap">
            ${prod.precio.toLocaleString("es-AR")}
          </span>
        </div>
      </div>
    </div>
  );
};

const ProductsVea = ({
  busqueda,
  filtroContenido = "",
  filtroMarca = "",
  onCount,
  onProducts,
  vistaUnica = false,
}) => {
  const [productos, setProductos] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [productoSeleccionado, setProductoSeleccionado] = useState(null);
  const busquedaEnCursoRef = useRef(null);

  // Carga automática de las 2 primeras páginas (100 productos)
  const cargarPaginasIniciales = async (termino) => {
    setCargando(true);
    setProgreso(0);
    try {
      const paginasACargar = [0, 1];
      let peticionesCompletadas = 0;
      const peticiones = paginasACargar.map(async (pageIndex) => {
        const from = pageIndex * PRODUCTOS_POR_PAGINA;
        const to = from + PRODUCTOS_POR_PAGINA - 1;
        try {
          const res = await fetch(
            getApiUrl("vea", `?ft=${termino}&_from=${from}&_to=${to}`),
          );
          return await res.json();
        } catch {
          return [];
        } finally {
          peticionesCompletadas += 1;
          setProgreso(Math.round((peticionesCompletadas / paginasACargar.length) * 60));
        }
      });

      const resultados = await Promise.all(peticiones);

      const todosRaw = resultados.flat();

      todosRaw.sort((a, b) => {
        const marcaA = (a.brand || "").toString();
        const marcaB = (b.brand || "").toString();
        return marcaA.localeCompare(marcaB, "es", { sensitivity: "base" });
      });

      console.table(
        todosRaw.map((p) => ({
          ID: p.productId,
          Marca: p.brand,
          Nombre: p.productName,
          PrecioBase: p.items?.[0]?.sellers?.[0]?.commertialOffer?.Price,
          itemId: p.items?.[0]?.itemId,
        })),
      );

      if (Array.isArray(todosRaw) && todosRaw.length > 0) {
        setProgreso(70);
        const productosLimpios = (await mapearProductoVea(todosRaw)).map(
          (p) => ({
            ...p,
            logoTienda: SUPERMARKET_LOGOS.vea,
          }),
        );
        setProgreso(90);

        // La carga en paralelo de páginas puede traer el mismo producto repetido; deduplicamos por id
        const productosUnicos = Array.from(
          new Map(productosLimpios.map((p) => [p.id, p])).values(),
        );

        setProductos(productosUnicos);
      } else {
        setProductos([]);
      }
      setProgreso(100);
    } catch (error) {
      console.error("❌ Error al procesar Vea:", error);
      setProductos([]);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    if (busqueda) {
      // Evita la doble ejecución del efecto (React StrictMode / remounts) para
      // el mismo término de búsqueda, que disparaba la carga inicial por duplicado.
      if (busquedaEnCursoRef.current === busqueda) return;
      busquedaEnCursoRef.current = busqueda;
      cargarPaginasIniciales(busqueda);
    } else {
      busquedaEnCursoRef.current = null;
      setProductos([]);
    }
  }, [busqueda]);

  useEffect(() => {
    onProducts?.(productos);
  }, [productos, onProducts]);

  // Filtrado por Marca/Rango de Medida, solo productos con descuento real
  // + ORDENAMIENTO DE MENOR A MAYOR PRECIO
  const productosFiltrados = useMemo(() => {
    const filtrados = productos.filter((p) => {
      const coincideMarca = filtroMarca
        ? p.marca?.toUpperCase().trim() === filtroMarca.toUpperCase().trim()
        : true;
      const coincideContenido = filtroContenido
        ? obtenerRangoContenido(p.contenido) === filtroContenido
        : true;

      // SIMPLEMENTE RETORNAR LA COINCIDENCIA DE FILTROS (Sin exigir tieneDescuento)
      return coincideMarca && coincideContenido;
    });
    return ordenarPorPrecioRelativo(filtrados);
  }, [productos, filtroMarca, filtroContenido]);

  useEffect(() => {
    onCount?.(productosFiltrados.length);
  }, [productosFiltrados, onCount]);

  return (
    <div
      className={`bg-slate-900 text-white flex flex-col ${vistaUnica ? "max-w-7xl mx-auto w-full px-2 sm:px-4" : ""}`}
    >
      <div className="p-2">
        {cargando ? (
          <div className="flex items-center justify-center py-8">
            <div className="relative w-16 h-16">
              <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="6"
                  className="text-slate-800"
                />
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 28}
                  strokeDashoffset={2 * Math.PI * 28 * (1 - progreso / 100)}
                  className="text-emerald-400 transition-all duration-300 ease-out"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-amber-400">
                {progreso}%
              </span>
            </div>
          </div>
        ) : (
          <div
            className={
              vistaUnica
                ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 justify-items-center"
                : "flex flex-row gap-2 overflow-x-auto snap-x snap-mandatory scrollbar-none pb-1 lg:flex-col lg:overflow-visible lg:snap-none lg:pb-0"
            }
          >
            {productosFiltrados.map((prod) => (
              <TarjetaProducto
                key={prod.id}
                prod={prod}
                onSeleccionar={setProductoSeleccionado}
                vistaUnica={vistaUnica}
              />
            ))}
          </div>
        )}
      </div>

      {productoSeleccionado && (
        <div
          onClick={() => setProductoSeleccionado(null)}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-lg w-full bg-slate-800 border border-slate-700 rounded-xl p-5 shadow-2xl relative flex flex-col gap-4 text-white animate-fade-in"
          >
            <button
              onClick={() => setProductoSeleccionado(null)}
              className="absolute top-3 right-3 text-slate-400 hover:text-white text-lg leading-none z-10"
              aria-label="Cerrar"
            >
              ✕
            </button>

            {/* Imagen Principal */}
            <div className="w-full h-60 bg-white/5 rounded-lg flex items-center justify-center p-4">
              {productoSeleccionado.imagenProducto ? (
                <img
                  src={productoSeleccionado.imagenProducto}
                  alt={productoSeleccionado.nombre}
                  className="h-full object-contain"
                />
              ) : (
                <span className="text-xs text-slate-500">Sin imagen</span>
              )}
            </div>

            {/* Información del Producto */}
            <div>
              <span className="block text-[10px] text-slate-400 uppercase tracking-wider font-semibold truncate">
                {productoSeleccionado.marca}
                {productoSeleccionado.contenido &&
                  productoSeleccionado.contenido !== "Sin especificar" && (
                    <>
                      <br className="block sm:hidden" />
                      <span className="hidden sm:inline"> - </span>
                      <span className="text-slate-400 font-bold">
                        {productoSeleccionado.contenido}
                      </span>
                    </>
                  )}
              </span>

              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold text-slate-100">
                  {productoSeleccionado.nombre}
                </h2>
                {productoSeleccionado.promocion && (
                  <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-semibold px-2 py-0.5 rounded-md whitespace-nowrap shrink-0">
                    🏷️ {productoSeleccionado.promocion}
                  </span>
                )}
              </div>
            </div>

            {/* Precios y Enlace */}
            <div className="flex justify-between items-end border-t border-slate-700/60 pt-3">
              <div className="min-w-0">
                {productoSeleccionado.precioPorUnidad ? (
                  <span className="block text-xs text-slate-400 font-medium">
                    {productoSeleccionado.precioPorUnidad}
                  </span>
                ) : (
                  <span className="block text-xs text-slate-500 italic">
                    Sin acum.
                  </span>
                )}
              </div>
              <span className="text-2xl font-extrabold text-emerald-400 whitespace-nowrap">
                ${productoSeleccionado.precio.toLocaleString("es-AR")}
              </span>
            </div>

            {productoSeleccionado.linkCompra && (
              <a
                href={productoSeleccionado.linkCompra}
                target="_blank"
                rel="noopener noreferrer"
                className="text-center bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-md py-2 transition-colors"
              >
                Ir a la tienda
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductsVea;

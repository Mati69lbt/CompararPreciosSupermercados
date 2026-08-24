import React, { useState, useEffect, useMemo } from "react";

import { SUPERMARKET_LOGOS } from "../../assets/logos/logos";
import { mapearProductoCarrefour } from "./mapearProdCarrefour";
import { obtenerRangoContenido } from "../../utils/contenido";

const PRODUCTOS_POR_PAGINA = 50;

const ProductsCarrefour = ({
  busqueda,
  filtroContenido = "",
  filtroMarca = "",
  onCount,
  onProducts,
}) => {
  const [productos, setProductos] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [productoSeleccionado, setProductoSeleccionado] = useState(null);

  // Carga automática de las primeras 4 páginas (200 productos)
  const cargarPaginasIniciales = async (termino) => {
    setCargando(true);
    try {
      // Creamos 4 promesas para traer páginas 0, 1, 2 y 3 en paralelo
      const paginasACargar = [0, 1, 2, 3];
      const peticiones = paginasACargar.map((pageIndex) => {
        const from = pageIndex * PRODUCTOS_POR_PAGINA;
        const to = from + PRODUCTOS_POR_PAGINA - 1;
        return fetch(`/api-carrefour/${termino}?_from=${from}&_to=${to}`)
          .then((res) => res.json())
          .catch(() => []);
      });

      const resultados = await Promise.all(peticiones);

      // Aplanamos los resultados de las 4 páginas en un solo array
      const todosRaw = resultados.flat();

      if (Array.isArray(todosRaw) && todosRaw.length > 0) {
        const productosLimpios = mapearProductoCarrefour(todosRaw).map((p) => ({
          ...p,
          logoTienda: SUPERMARKET_LOGOS.carrefour,
        }));

        // La carga en paralelo de páginas puede traer el mismo producto repetido; deduplicamos por id
        const productosUnicos = Array.from(
          new Map(productosLimpios.map((p) => [p.id, p])).values(),
        );

        setProductos(productosUnicos);
      } else {
        setProductos([]);
      }
    } catch (error) {
      console.error("❌ Error al procesar Carrefour:", error);
      setProductos([]);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    if (busqueda) {
      cargarPaginasIniciales(busqueda);
    } else {
      setProductos([]);
    }
  }, [busqueda]);

  useEffect(() => {
    onProducts?.(productos);
  }, [productos, onProducts]);

  // Filtrar por Marca/Rango de Medida y ORDENAR DE MENOR A MAYOR PRECIO
  const productosFiltrados = useMemo(() => {
    return productos
      .filter((p) => {
        const coincideMarca = filtroMarca ? p.marca?.toUpperCase().trim() === filtroMarca.toUpperCase().trim() : true;
        const coincideContenido = filtroContenido
          ? obtenerRangoContenido(p.contenido) === filtroContenido
          : true;
        return coincideMarca && coincideContenido;
      })
      .sort((a, b) => a.precio - b.precio);
  }, [productos, filtroMarca, filtroContenido]);

  useEffect(() => {
    onCount?.(productosFiltrados.length);
  }, [productosFiltrados, onCount]);

  return (
    <div className="bg-slate-900 text-white flex flex-col">
      <div className="p-2">
        {cargando ? (
          <p className="text-center text-slate-400 text-xs py-4">Cargando...</p>
        ) : (
          <div className="flex flex-col gap-2">
            {productosFiltrados.map((prod) => (
              <div
                key={prod.id}
                onClick={() => setProductoSeleccionado(prod)}
                className="bg-slate-800 border border-slate-700 rounded-lg p-2 flex flex-col justify-between shadow hover:border-slate-500 transition-all overflow-hidden cursor-pointer hover:scale-[1.01]"
              >
                <div className="flex gap-2">
                  <div className="w-14 h-14 shrink-0 bg-white/5 rounded-md flex items-center justify-center overflow-hidden">
                    {prod.imagenProducto ? (
                      <img
                        src={prod.imagenProducto}
                        alt={prod.nombre}
                        className="h-full object-contain p-1"
                      />
                    ) : (
                      <span className="text-[9px] text-slate-500">
                        Sin imagen
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block text-[10px] text-slate-400 uppercase tracking-wider font-semibold truncate">
                      {prod.marca} -{" "}
                      <span className="text-[10px] text-slate-400">
                        {prod.contenido}
                      </span>
                    </span>
                    <h3
                      title={prod.nombre}
                      className="font-medium text-slate-100 text-[11px]"
                    >
                      {prod.nombre}
                    </h3>
                    {prod.promocion && (
                      <span className="inline-block mt-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-semibold px-1.5 py-0.5 rounded-md w-fit">
                        🏷️ {prod.promocion}
                      </span>
                    )}
                  </div>
                </div>

                {/* Pie de tarjeta: Precio por unidad/kilo a la izquierda / Precio final a la derecha */}
                <div className="mt-1.5 pt-1.5 border-t border-slate-700/60 flex justify-between items-baseline gap-1">
                  <div className="min-w-0 shrink">
                    <span className="block text-[12px] text-slate-400 font-medium truncate">
                      {prod.precioPorUnidad}
                    </span>
                  </div>

                  <span className="text-sm font-extrabold text-emerald-400 whitespace-nowrap text-right shrink-0">
                    ${prod.precio.toLocaleString("es-AR")}
                  </span>
                </div>
              </div>
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
              <span className="block text-slate-400 text-xs uppercase font-semibold tracking-wider mb-1">
                {productoSeleccionado.marca} - {productoSeleccionado.contenido}
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

export default ProductsCarrefour;

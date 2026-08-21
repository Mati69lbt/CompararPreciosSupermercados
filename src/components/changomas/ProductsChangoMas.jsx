import React, { useState, useEffect, useMemo } from "react";
import { SUPERMARKET_LOGOS } from "../../assets/logos/logos";
import { mapearProductoChangoMas } from "./mapearProductoChangoMas";

const PRODUCTOS_POR_PAGINA = 50;

const ProductsChangoMas = ({ busqueda, onCount }) => {
  const [productos, setProductos] = useState([]);
  const [cargando, setCargando] = useState(false);

  // Estados para Filtros
  const [filtroMarca, setFiltroMarca] = useState("");
  const [filtroContenido, setFiltroContenido] = useState("");

  // Carga automática de las 4 primeras páginas (200 productos)
  const cargarPaginasIniciales = async (termino) => {
    setCargando(true);
    setFiltroMarca("");
    setFiltroContenido("");
    try {
      const paginasACargar = [0, 1, 2, 3];
      const peticiones = paginasACargar.map((pageIndex) => {
        const from = pageIndex * PRODUCTOS_POR_PAGINA;
        const to = from + PRODUCTOS_POR_PAGINA - 1;
        return fetch(
          `/api-changomas?ft=${termino}&_from=${from}&_to=${to}`,
        )
          .then((res) => res.json())
          .catch(() => []);
      });

      const resultados = await Promise.all(peticiones);
      const todosRaw = resultados.flat();

      if (Array.isArray(todosRaw) && todosRaw.length > 0) {
        const productosLimpios = mapearProductoChangoMas(todosRaw).map((p) => ({
          ...p,
          logoTienda:
            SUPERMARKET_LOGOS.changomas || SUPERMARKET_LOGOS.masonline,
        }));

        setProductos(productosLimpios);
      } else {
        setProductos([]);
      }
    } catch (error) {
      console.error("❌ Error al procesar MásOnline / ChangoMás:", error);
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
    onCount?.(productos.length);
  }, [productos, onCount]);

  // Lista única de Marcas
  const marcasDisponibles = useMemo(() => {
    const marcas = productos
      .map((p) => p.marca)
      .filter((m) => m && m !== "Sin marca");
    return [...new Set(marcas)].sort((a, b) => a.localeCompare(b));
  }, [productos]);

  // Lista única de Contenidos/Medidas
  const contenidosDisponibles = useMemo(() => {
    const contenidos = productos
      .map((p) => p.contenido)
      .filter((c) => c && c !== "Sin especificar");
    return [...new Set(contenidos)].sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }),
    );
  }, [productos]);

  // Filtrado + ORDENAMIENTO DE MENOR A MAYOR PRECIO
  const productosFiltrados = useMemo(() => {
    return productos
      .filter((p) => {
        const coincideMarca = filtroMarca ? p.marca === filtroMarca : true;
        const coincideContenido = filtroContenido
          ? p.contenido === filtroContenido
          : true;
        return coincideMarca && coincideContenido;
      })
      .sort((a, b) => a.precio - b.precio);
  }, [productos, filtroMarca, filtroContenido]);

  return (
    <div className="bg-slate-900 text-white flex flex-col">
      <div className="sticky top-0 z-10 bg-slate-900 border-b border-slate-800 p-2 flex flex-col gap-2">
        {/* Selects de Filtrado (Marca y Contenido) */}
        <div className="flex flex-row gap-1.5">
          <select
            value={filtroMarca}
            onChange={(e) => setFiltroMarca(e.target.value)}
            className="w-1/2 bg-slate-800 border border-slate-700 text-slate-200 text-[11px] rounded-md p-1.5 focus:ring-1 focus:ring-amber-500 focus:outline-none"
          >
            <option value="">Marca ({marcasDisponibles.length})</option>
            {marcasDisponibles.map((marca, i) => (
              <option key={i} value={marca}>
                {marca}
              </option>
            ))}
          </select>

          <select
            value={filtroContenido}
            onChange={(e) => setFiltroContenido(e.target.value)}
            className="w-1/2 bg-slate-800 border border-slate-700 text-slate-200 text-[11px] rounded-md p-1.5 focus:ring-1 focus:ring-amber-500 focus:outline-none"
          >
            <option value="">Medida ({contenidosDisponibles.length})</option>
            {contenidosDisponibles.map((cont, i) => (
              <option key={i} value={cont}>
                {cont}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="p-2">
      {cargando ? (
        <p className="text-center text-slate-400 text-xs py-4">Cargando...</p>
      ) : (
        <div className="flex flex-col gap-2">
          {productosFiltrados.map((prod) => (
            <div
              key={prod.id}
              className="bg-slate-800 border border-slate-700 rounded-lg p-2 flex flex-col justify-between shadow hover:border-slate-500 transition-all overflow-hidden"
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
                    {prod.marca}
                  </span>
                  <h3 className="font-medium text-slate-100 text-[11px] line-clamp-2">
                    {prod.nombre}
                  </h3>
                </div>
              </div>

              {prod.promocion && (
                <span className="inline-block mt-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-semibold px-1.5 py-0.5 rounded-md w-fit">
                  🏷️ {prod.promocion}
                </span>
              )}

              <div className="mt-1.5 pt-1.5 border-t border-slate-700/60 flex justify-between items-baseline">
                <span className="text-[10px] text-slate-400">
                  {prod.contenido}
                </span>
                <span className="text-sm font-extrabold text-emerald-400">
                  ${prod.precio.toLocaleString("es-AR")}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
      </div>
    </div>
  );
};

export default ProductsChangoMas;

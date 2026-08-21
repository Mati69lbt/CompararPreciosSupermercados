import React, { useState, useEffect, useMemo } from "react";
import { SUPERMARKET_LOGOS } from "../../assets/logos/logos";
import { mapearProductoCoto } from "./mapearProductoCoto";

const ProductsCoto = () => {
  const [productos, setProductos] = useState([]);
  const [cargando, setCargando] = useState(false);

  // Estados para los filtros
  const [filtroMarca, setFiltroMarca] = useState("");
  const [filtroContenido, setFiltroContenido] = useState("");

  const probarCoto = async (busqueda = "leche") => {
    setCargando(true);
    try {
      const urlCoto = `https://api.coto.com.ar/api/v1/ms-digital-sitio-bff-web/api/v1/products/search/${busqueda}?key=${import.meta.env.VITE_API_COTO_KEY}&num_results_per_page=50&pre_filter_expression=%7B%22name%22:%22store_availability%22,%22value%22:%22${import.meta.env.VITE_API_COTO_STORE}%22%7D`;

      const res = await fetch(urlCoto);
      const data = await res.json();

      const productosLimpios = mapearProductoCoto(data).map((p) => ({
        ...p,
        logoTienda: SUPERMARKET_LOGOS.coto,
      }));

      setProductos(productosLimpios);
    } catch (error) {
      console.error("❌ Error al procesar Coto:", error);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    probarCoto("leche");
  }, []);

  // Lista de Marcas únicas
  const marcasDisponibles = useMemo(() => {
    const marcas = productos
      .map((p) => p.marca)
      .filter((m) => m && m !== "Sin marca");
    return [...new Set(marcas)].sort((a, b) => a.localeCompare(b));
  }, [productos]);

  // Lista de Contenidos/Medidas únicas
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
    return (
      productos
        .filter((p) => {
          const coincideMarca = filtroMarca ? p.marca === filtroMarca : true;
          const coincideContenido = filtroContenido
            ? p.contenido === filtroContenido
            : true;
          return coincideMarca && coincideContenido;
        })
        // Orden asc de precio (menor a mayor)
        .sort((a, b) => a.precio - b.precio)
    );
  }, [productos, filtroMarca, filtroContenido]);

  return (
    <div className="p-6 bg-slate-900 min-h-screen text-white">
      <h2 className="text-2xl font-bold mb-6 text-center">Resultados Coto</h2>

      {/* Selects de Filtrado (Brand y Contenido) */}
      <div className="max-w-xl mx-auto mb-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Filtro Marca / Brand */}
        <div>
          <label className="block text-xs text-slate-400 font-medium mb-1">
            Filtrar por Marca:
          </label>
          <select
            value={filtroMarca}
            onChange={(e) => setFiltroMarca(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          >
            <option value="">
              Todas las marcas ({marcasDisponibles.length})
            </option>
            {marcasDisponibles.map((marca, i) => (
              <option key={i} value={marca}>
                {marca}
              </option>
            ))}
          </select>
        </div>

        {/* Filtro Contenido / Medida */}
        <div>
          <label className="block text-xs text-slate-400 font-medium mb-1">
            Filtrar por Medida:
          </label>
          <select
            value={filtroContenido}
            onChange={(e) => setFiltroContenido(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          >
            <option value="">
              Todas las medidas ({contenidosDisponibles.length})
            </option>
            {contenidosDisponibles.map((cont, i) => (
              <option key={i} value={cont}>
                {cont}
              </option>
            ))}
          </select>
        </div>
      </div>

      {cargando ? (
        <p className="text-center text-slate-400">Cargando productos...</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {productosFiltrados.map((prod) => (
            <div
              key={prod.id}
              className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex flex-col justify-between shadow-lg hover:border-slate-500 transition-all relative overflow-hidden"
            >
              <div>
                <div className="flex justify-between items-center mb-3">
                  <img
                    src={prod.logoTienda}
                    alt="Coto"
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
      )}
    </div>
  );
};

export default ProductsCoto;

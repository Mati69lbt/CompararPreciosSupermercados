import React, { useState, useEffect, useMemo } from "react";

import { SUPERMARKET_LOGOS } from "../../assets/logos/logos";
import { mapearProductoCarrefour } from "./mapearProdCarrefour";

const PRODUCTOS_POR_PAGINA = 50;

const RANGOS_CONTENIDO = [
  "Menos de 200 GR",
  "200 a 500 GR",
  "500 GR a 1 KG",
  "1 KG",
  "Más de 1 KG",
  "Menos de 200 ML",
  "200 a 500 ML",
  "500 ML a 1 L",
  "1 L",
  "Más de 1 L",
  "Unidades / Sin especificar",
];

// Convierte "1,5 L" / "800 GR" / "2 KG" a un rango de Peso o Volumen, sin mezclar familias
const obtenerRangoContenido = (contenido) => {
  if (!contenido || contenido === "Sin especificar")
    return "Unidades / Sin especificar";

  const match = contenido.match(/^(\d+(?:[.,]\d+)?)\s*(GR|KG|ML|L)$/i);
  if (!match) return "Unidades / Sin especificar";

  const cantidad = parseFloat(match[1].replace(",", "."));
  const unidad = match[2].toUpperCase();
  const esPeso = unidad === "GR" || unidad === "KG";
  const equivalente =
    unidad === "KG" || unidad === "L" ? cantidad * 1000 : cantidad;

  if (esPeso) {
    if (equivalente < 200) return "Menos de 200 GR";
    if (equivalente < 500) return "200 a 500 GR";
    if (equivalente < 1000) return "500 GR a 1 KG";
    if (equivalente === 1000) return "1 KG";
    return "Más de 1 KG";
  }

  if (equivalente < 200) return "Menos de 200 ML";
  if (equivalente < 500) return "200 a 500 ML";
  if (equivalente < 1000) return "500 ML a 1 L";
  if (equivalente === 1000) return "1 L";
  return "Más de 1 L";
};

const ProductsCarrefour = ({ busqueda, onCount }) => {
  const [productos, setProductos] = useState([]);
  const [cargando, setCargando] = useState(false);

  // Estados para los Filtros
  const [filtroMarca, setFiltroMarca] = useState("");
  const [filtroContenido, setFiltroContenido] = useState("");

  // Carga automática de las primeras 4 páginas (200 productos)
  const cargarPaginasIniciales = async (termino) => {
    setCargando(true);
    setFiltroMarca("");
    setFiltroContenido("");
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

  // 1. Extraer lista única de MARCAS disponibles
  const marcasDisponibles = useMemo(() => {
    const marcas = productos
      .map((p) => p.marca)
      .filter((m) => m && m !== "Sin marca");
    return [...new Set(marcas)].sort((a, b) =>
      a.localeCompare(b, "es", { sensitivity: "base" }),
    );
  }, [productos]);

  // 2. Extraer lista única de RANGOS DE CONTENIDO/MEDIDA disponibles
  const contenidosDisponibles = useMemo(() => {
    const rangos = new Set(
      productos.map((p) => obtenerRangoContenido(p.contenido)),
    );
    return RANGOS_CONTENIDO.filter((r) => rangos.has(r));
  }, [productos]);

  // 3. Filtrar por Marca/Rango de Medida y ORDENAR DE MENOR A MAYOR PRECIO
  const productosFiltrados = useMemo(() => {
    return productos
      .filter((p) => {
        const coincideMarca = filtroMarca ? p.marca === filtroMarca : true;
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
      <div className="sticky top-0 z-10 bg-slate-900 border-b border-slate-800 p-2 flex flex-col gap-2">
        {/* Selects de Filtrado (Marca y Contenido) */}
        <div className="flex flex-row gap-1.5">
          <select
            value={filtroMarca}
            onChange={(e) => setFiltroMarca(e.target.value)}
            className="w-1/2 bg-slate-800 border border-slate-700 text-slate-200 text-[11px] rounded-md p-1.5 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
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
            className="w-1/2 bg-slate-800 border border-slate-700 text-slate-200 text-[11px] rounded-md p-1.5 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
          >
            <option value="">Medida ({contenidosDisponibles.length})</option>
            {[...contenidosDisponibles]
              .sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }))
              .map((cont, i) => (
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
                className="bg-slate-800 border border-slate-700 rounded-lg flex shadow hover:border-slate-500 transition-all overflow-hidden"
              >
                <div className="w-30 shrink-0 bg-white/5 flex items-center justify-center overflow-hidden aspect-square">
                  {prod.imagenProducto ? (
                    <img
                      src={prod.imagenProducto}
                      alt={prod.nombre}
                      className="h-full w-full object-contain p-1"
                    />
                  ) : (
                    <span className="text-[9px] text-slate-500 text-center px-1">
                      Sin imagen
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1 p-2 flex flex-col justify-between">
                  <div className="min-w-0">
                    <span className="block text-[12px] text-slate-400 uppercase tracking-wider font-semibold">
                      {prod.marca} - {prod.contenido}
                    </span>

                    <h3
                      title={prod.nombre}
                      className="font-medium text-slate-100 text-[14px]"
                    >
                      {prod.nombre}
                    </h3>
                  </div>

                  <div className="mt-1.5 pt-1.5 border-t border-slate-700/60 flex flex-col gap-1">
                    {/* Fila alineada: Promoción a la izquierda / Precio siempre a la derecha */}
                    <div className="flex justify-between items-center gap-2">
                      <div>
                        {prod.promocion && (
                          <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-semibold px-1.5 py-0.5 rounded-md whitespace-nowrap">
                            🏷️ {prod.promocion}
                          </span>
                        )}
                      </div>

                      <span className="text-[16px] font-extrabold text-emerald-400 whitespace-nowrap text-right">
                        ${prod.precio.toLocaleString("es-AR")}
                      </span>
                    </div>

                    {/* Precio por unidad siempre abajo y a la derecha */}
                    {prod.precioPorUnidad && (
                      <span className="block text-right text-[12px] text-slate-400 font-medium">
                        {prod.precioPorUnidad}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductsCarrefour;

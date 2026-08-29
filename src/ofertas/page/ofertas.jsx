import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { getApiUrl } from "../../utils/apiConfig";
import { SUPERMARKET_LOGOS } from "../../assets/logos/logos";
import { construirInfoDeCoincidencias } from "../../utils/productMatch";
import {
  formatearPrecioPorUnidad,
  ordenarPorPrecioRelativo,
} from "../../utils/precioPorUnidad";
import {
  ProductMatchContext,
  useEstiloTarjeta,
} from "../../context/ProductMatchContext";
import { TERMINOS_CANASTA } from "../data/terminosCanasta";
import { ejecutarConLimite } from "../utils/ejecutarConLimite";

import { mapearProductoCarrefour } from "../../components/carrefour/mapearProdCarrefour";
import { mapearProductoDia } from "../../components/Dia/mapearProdDia";
import { mapearProductoChangoMas } from "../../components/changomas/mapearProductoChangoMas";
import { mapearProductoVea } from "../../components/vea/mapearProductoVea";
import { mapearProductoCoto } from "../../components/coto/mapearProductoCoto";

// Config de fetch por tienda VTEX (Coto usa su propia API BFF, ver
// buscarOfertasDeCotoTermino; MELI no expone catalog_system y queda sin datos).
const TIENDAS_OFERTAS = {
  carrefour: { nombre: "Carrefour", mapear: mapearProductoCarrefour },
  dia: { nombre: "Día", mapear: mapearProductoDia },
  changomas: { nombre: "ChangoMás", mapear: mapearProductoChangoMas },
  vea: { nombre: "Vea", mapear: mapearProductoVea },
  coto: { nombre: "Coto", mapear: mapearProductoCoto },
};

// Orden de las 5 columnas del layout
const COLUMNAS = ["carrefour", "dia", "changomas", "vea", "coto"];

const PRODUCTOS_POR_TERMINO = 24;
const CONCURRENCIA = 6;

// Trae y mapea los productos de una tienda para un término de búsqueda puntual.
// Cualquier error de red/parseo se resuelve como lista vacía para no cortar el relevamiento.
const buscarOfertasDeTermino = async (tienda, mapear, termino) => {
  try {
    const res = await fetch(
      getApiUrl(
        tienda,
        `/${encodeURIComponent(termino)}?_from=0&_to=${PRODUCTOS_POR_TERMINO - 1}`,
      ),
    );
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];

    if (tienda === "vea") {
      console.log(`📦 JSON Crudo de VEA para [${termino}]:`, data);
    }

    // Solo ítems con stock real (defensa adicional, independiente del filtro de cada mapeador)
    const dataConStock = data.filter((item) => {
      const offer = item?.items?.[0]?.sellers?.[0]?.commertialOffer;
      return offer?.IsAvailable === true && (offer?.AvailableQuantity ?? 0) > 0;
    });

    return mapear(dataConStock)
      .map((p) => ({ ...p, logoTienda: SUPERMARKET_LOGOS[tienda] }))
      .filter((p) => p.listPrice > p.precio)
      .map((p) => ({
        ...p,
        descuento: Math.round((1 - p.precio / p.listPrice) * 100),
        termino,
      }));
  } catch {
    return [];
  }
};

// Coto no expone catalog_system (VTEX): usa su propia API BFF, con
// estructura y filtros de stock/descuento distintos.
const buscarOfertasDeCotoTermino = async (termino) => {
  try {
    const storeTarget = import.meta.env.VITE_API_COTO_STORE || "109";
    const url = `https://api.coto.com.ar/api/v1/ms-digital-sitio-bff-web/api/v1/products/search/${encodeURIComponent(termino)}?key=${import.meta.env.VITE_API_COTO_KEY}&num_results_per_page=${PRODUCTOS_POR_TERMINO}&page=1&pre_filter_expression=%7B%22name%22:%22store_availability%22,%22value%22:%22${storeTarget}%22%7D`;

    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    const resultados = data?.response?.results || [];
    if (!Array.isArray(resultados) || resultados.length === 0) return [];

    // Solo ítems con stock real en la sucursal configurada
    const conStock = resultados.filter((item) =>
      (item?.data?.store_availability || []).includes(storeTarget),
    );

    return mapearProductoCoto({ response: { results: conStock } })
      .map((p) => ({ ...p, logoTienda: SUPERMARKET_LOGOS.coto }))
      .filter((p) => p.listPrice > p.precio)
      .map((p) => ({
        ...p,
        descuento: Math.round((1 - p.precio / p.listPrice) * 100),
        termino,
      }));
  } catch {
    return [];
  }
};

const TarjetaOferta = ({ prod, onSeleccionar }) => {
  const { claseBorde, onMouseEnter, onMouseLeave } = useEstiloTarjeta(
    prod.tienda,
    prod.id,
  );

  return (
    <div
      onClick={() => onSeleccionar(prod)}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`w-[220px] sm:w-[280px] shrink-0 snap-start lg:w-full lg:snap-align-none bg-slate-800 rounded-lg p-2.5 sm:p-2 flex flex-col justify-between shadow transition-all overflow-hidden cursor-pointer hover:scale-[1.01] ${claseBorde}`}
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
            {prod.marca} - {prod.contenido}
          </span>
          <span className="shrink-0 bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[9px] font-bold px-1.5 py-0.5 rounded-md">
            -{prod.descuento}%
          </span>
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
            {prod.precioPorUnidad ||
              formatearPrecioPorUnidad(prod.precio, prod.contenido) ||
              ""}
          </span>
          <span className="text-slate-400 font-normal text-[11px] px-1 whitespace-nowrap">
            ${prod.listPrice.toLocaleString("es-AR")}
          </span>
          <span className="text-emerald-400 font-bold text-xs sm:text-sm whitespace-nowrap">
            ${prod.precio.toLocaleString("es-AR")}
          </span>
        </div>
      </div>
    </div>
  );
};

const TERMINOS_CANASTA_ORDENADOS = [...TERMINOS_CANASTA].sort((a, b) =>
  a.localeCompare(b, "es", { sensitivity: "base" }),
);

const SelectorTerminoGlobal = ({
  terminoSeleccionado,
  onChange,
  conteoGlobalPorTermino,
  totalOfertas,
}) => (
  <div className="w-full max-w-sm mx-auto mb-4">
    <select
      id="filtro-canasta-global"
      aria-label="Filtrar por categoría"
      value={terminoSeleccionado}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 border border-slate-700 rounded-lg bg-slate-800 text-slate-100 shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
    >
      <option value="TODOS">TODOS ({totalOfertas})</option>
      {TERMINOS_CANASTA_ORDENADOS.map((termino) => {
        const cantidad = conteoGlobalPorTermino[termino] || 0;
        if (cantidad === 0) return null;
        return (
          <option key={termino} value={termino}>
            {termino.toUpperCase()} ({cantidad})
          </option>
        );
      })}
    </select>
  </div>
);

const SpinnerCarga = ({ progreso, totalTareas }) => (
  <div className="flex flex-col items-center justify-center gap-3 mt-6">
    <div className="h-10 w-10 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 animate-spin" />
    <p className="text-center text-slate-400 text-xs">
      Relevando canasta básica... {progreso}/{totalTareas}
    </p>
  </div>
);

const ColumnaTienda = ({
  nombre,
  logo,
  ofertas,
  cargando,
  progreso,
  totalTareas,
  onSeleccionar,
}) => (
  <div className="bg-slate-950/40 border-2 border-slate-600 rounded-xl overflow-hidden flex flex-col lg:h-full lg:min-w-0">
    <div className="flex justify-between items-center bg-slate-800 p-3 border-b border-slate-700 shrink-0">
      <div className="flex items-center gap-2">
        {logo && <img src={logo} alt={nombre} className="h-6 object-contain" />}
        <h3 className="font-bold text-slate-100 text-sm md:text-base">
          {nombre}
        </h3>
      </div>
      <span className="bg-emerald-500/20 text-emerald-400 text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap">
        {ofertas.length} ofertas
      </span>
    </div>

    <div className="flex-1 lg:overflow-y-auto lg:min-h-0 scroll-tienda p-2">
      {cargando && ofertas.length === 0 ? (
        <SpinnerCarga progreso={progreso} totalTareas={totalTareas} />
      ) : ofertas.length === 0 ? (
        <p className="text-center text-slate-500 text-xs mt-6">
          Sin ofertas relevadas.
        </p>
      ) : (
        <div className="flex justify-start gap-2 overflow-x-auto px-2 pb-2 snap-x snap-mandatory scroll-px-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:flex-col lg:items-stretch lg:overflow-x-visible lg:px-0 lg:pb-0 lg:snap-none">
          {ofertas.map((prod) => (
            <TarjetaOferta
              key={prod.id}
              prod={prod}
              onSeleccionar={onSeleccionar}
            />
          ))}
        </div>
      )}
    </div>
  </div>
);

const Ofertas = () => {
  const navigate = useNavigate();
  const [ofertasPorTienda, setOfertasPorTienda] = useState({});
  const [cargandoPorTienda, setCargandoPorTienda] = useState({});
  const [progresoPorTienda, setProgresoPorTienda] = useState({});
  const [productoSeleccionado, setProductoSeleccionado] = useState(null);
  const [grupoActivo, setGrupoActivo] = useState(null);
  const [terminoFiltroGlobal, setTerminoFiltroGlobal] = useState("TODOS");

  const canceladoRef = useRef(false);

  const fetchOfertasTienda = async (key) => {
    const config = TIENDAS_OFERTAS[key];
    if (!config?.mapear) return;

    setCargandoPorTienda((prev) => ({ ...prev, [key]: true }));
    setProgresoPorTienda((prev) => ({ ...prev, [key]: 0 }));

    const tareas = TERMINOS_CANASTA.map((termino) => async () => {
      const resultado =
        key === "coto"
          ? await buscarOfertasDeCotoTermino(termino)
          : await buscarOfertasDeTermino(key, config.mapear, termino);
      if (!canceladoRef.current) {
        setProgresoPorTienda((prev) => ({
          ...prev,
          [key]: (prev[key] || 0) + 1,
        }));
      }
      return resultado;
    });

    const resultados = await ejecutarConLimite(tareas, CONCURRENCIA);
    if (canceladoRef.current) return;

    const unicas = Array.from(
      new Map(resultados.flat().map((p) => [p.id, p])).values(),
    );
    unicas.sort((a, b) =>
      (a.nombre || "").localeCompare(b.nombre || "", "es", {
        sensitivity: "base",
      }),
    );

    setOfertasPorTienda((prev) => ({ ...prev, [key]: unicas }));
    setCargandoPorTienda((prev) => ({ ...prev, [key]: false }));
  };

  useEffect(() => {
    canceladoRef.current = false;

    const cargarSecuencial = async () => {
      for (const key of COLUMNAS) {
        if (canceladoRef.current) return;
        await fetchOfertasTienda(key);
      }
    };
    cargarSecuencial();

    return () => {
      canceladoRef.current = true;
    };
  }, []);

  const todasLasOfertas = useMemo(
    () => Object.values(ofertasPorTienda).flat(),
    [ofertasPorTienda],
  );

  const matchInfoPorClave = useMemo(
    () => construirInfoDeCoincidencias(todasLasOfertas),
    [todasLasOfertas],
  );
  const productMatchValue = useMemo(
    () => ({ matchInfoPorClave, grupoActivo, setGrupoActivo }),
    [matchInfoPorClave, grupoActivo],
  );

  const totalTareas = TERMINOS_CANASTA.length;

  // Conteo global por término (suma entre las 5 tiendas) y lista filtrada+ordenada
  // por columna, a partir de ofertasPorTienda + terminoFiltroGlobal.
  const conteoGlobalPorTermino = useMemo(() => {
    const conteo = {};
    todasLasOfertas.forEach((p) => {
      if (p.termino) conteo[p.termino] = (conteo[p.termino] || 0) + 1;
    });
    return conteo;
  }, [todasLasOfertas]);

  const ofertasFiltradasPorTienda = useMemo(() => {
    const resultado = {};
    COLUMNAS.forEach((key) => {
      const ofertas = ofertasPorTienda[key] || [];
      const filtradas =
        terminoFiltroGlobal === "TODOS"
          ? ofertas
          : ofertas.filter((p) => p.termino === terminoFiltroGlobal);
      resultado[key] = ordenarPorPrecioRelativo(filtradas);
    });
    return resultado;
  }, [ofertasPorTienda, terminoFiltroGlobal]);

  return (
    <div className="text-white px-2 sm:px-4">
      <header className="flex items-center justify-between mb-3">
        <button
          onClick={() => navigate("/")}
          className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm px-4 py-2 rounded-lg border border-slate-700 transition-colors"
        >
          ← Volver
        </button>

        <div className="flex items-center gap-3">
          <h1 className="text-base sm:text-2xl font-extrabold tracking-tight whitespace-nowrap bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
            Ofertas Destacadas
          </h1>
          <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap">
            {todasLasOfertas.length} ofertas
          </span>
        </div>

        <div className="w-[92px]" aria-hidden="true" />
      </header>

      <SelectorTerminoGlobal
        terminoSeleccionado={terminoFiltroGlobal}
        onChange={setTerminoFiltroGlobal}
        conteoGlobalPorTermino={conteoGlobalPorTermino}
        totalOfertas={todasLasOfertas.length}
      />

      <ProductMatchContext.Provider value={productMatchValue}>
        <div className="flex flex-col gap-3 lg:grid lg:grid-cols-5 lg:gap-3 lg:h-[calc(100vh-200px)] lg:items-stretch">
          {COLUMNAS.map((key) => (
            <ColumnaTienda
              key={key}
              nombre={TIENDAS_OFERTAS[key].nombre}
              logo={SUPERMARKET_LOGOS[key]}
              ofertas={ofertasFiltradasPorTienda[key] || []}
              cargando={!!cargandoPorTienda[key]}
              progreso={progresoPorTienda[key] || 0}
              totalTareas={totalTareas}
              onSeleccionar={setProductoSeleccionado}
            />
          ))}
        </div>
      </ProductMatchContext.Provider>

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

            <div>
              <span className="block text-slate-400 text-xs uppercase font-semibold tracking-wider mb-1">
                {productoSeleccionado.marca} - {productoSeleccionado.contenido}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold text-slate-100">
                  {productoSeleccionado.nombre}
                </h2>
                <span className="bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-bold px-2 py-0.5 rounded-md whitespace-nowrap shrink-0">
                  -{productoSeleccionado.descuento}%
                </span>
              </div>
            </div>

            <div className="flex justify-between items-end border-t border-slate-700/60 pt-3">
              <span className="text-xs text-slate-500 font-medium">
                {productoSeleccionado.precioPorUnidad ||
                  formatearPrecioPorUnidad(
                    productoSeleccionado.precio,
                    productoSeleccionado.contenido,
                  ) ||
                  ""}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-400">
                  ${productoSeleccionado.listPrice.toLocaleString("es-AR")}
                </span>
                <span className="text-2xl font-extrabold text-emerald-400 whitespace-nowrap">
                  ${productoSeleccionado.precio.toLocaleString("es-AR")}
                </span>
              </div>
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

export default Ofertas;

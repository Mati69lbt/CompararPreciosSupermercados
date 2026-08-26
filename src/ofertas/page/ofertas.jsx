import { useEffect, useMemo, useRef, useState } from "react";

import { getApiUrl } from "../../utils/apiConfig";
import { SUPERMARKET_LOGOS } from "../../assets/logos/logos";
import { construirInfoDeCoincidencias } from "../../utils/productMatch";
import { formatearPrecioPorUnidad } from "../../utils/precioPorUnidad";
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

// Config de fetch por tienda VTEX (Coto y MELI no exponen catalog_system,
// por eso no tienen mapeador acá; su columna queda visible pero sin datos).
const TIENDAS_OFERTAS = {
  carrefour: { nombre: "Carrefour", mapear: mapearProductoCarrefour },
  dia: { nombre: "Día", mapear: mapearProductoDia },
  changomas: { nombre: "ChangoMás", mapear: mapearProductoChangoMas },
  vea: { nombre: "Vea", mapear: mapearProductoVea },
  coto: { nombre: "Coto", mapear: null },
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
      className={`bg-slate-800 rounded-lg p-2 flex flex-col justify-between shadow transition-all overflow-hidden cursor-pointer hover:scale-[1.01] ${claseBorde}`}
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
            <span className="text-[9px] text-slate-500">Sin imagen</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <span className="block text-[10px] text-slate-400 uppercase tracking-wider font-semibold truncate">
            {prod.marca} - {prod.contenido}
          </span>
          <h3
            title={prod.nombre}
            className="font-medium text-slate-100 text-[11px] line-clamp-3"
          >
            {prod.nombre}
          </h3>
          <span className="inline-block mt-1 bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[9px] font-bold px-1.5 py-0.5 rounded-md w-fit">
            -{prod.descuento}%
          </span>
        </div>
      </div>

      <div className="mt-1.5 pt-1.5 border-t border-slate-700/60 flex justify-between items-center gap-1">
        <span className="text-[10px] text-slate-500 font-medium truncate">
          {formatearPrecioPorUnidad(prod.precio, prod.contenido) || ""}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[11px] text-slate-400 truncate">
            ${prod.listPrice.toLocaleString("es-AR")}
          </span>
          <span className="text-sm font-extrabold text-emerald-400 whitespace-nowrap text-right">
            ${prod.precio.toLocaleString("es-AR")}
          </span>
        </div>
      </div>
    </div>
  );
};

const SelectorTermino = ({
  terminoSeleccionado,
  onChange,
  conteoPorTermino,
  totalOfertas,
}) => (
  <div className="px-3 py-2 border-b border-slate-700 bg-slate-900/60 shrink-0">
    <select
      id="filtro-canasta-carrefour"
      value={terminoSeleccionado}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-2 py-1.5 border border-slate-700 rounded-lg bg-slate-800 text-slate-100 shadow-sm text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
    >
      <option value="TODOS">Todos ({totalOfertas})</option>
      {TERMINOS_CANASTA.map((termino) => {
        const cantidad = conteoPorTermino[termino] || 0;
        return (
          <option key={termino} value={termino}>
            {termino} ({cantidad})
          </option>
        );
      })}
    </select>
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
  selectorTermino,
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

    {selectorTermino}

    <div className="flex-1 lg:overflow-y-auto lg:min-h-0 scroll-tienda p-2">
      {cargando && ofertas.length === 0 ? (
        <p className="text-center text-slate-400 text-xs mt-6">
          Relevando canasta básica... {progreso}/{totalTareas}
        </p>
      ) : ofertas.length === 0 ? (
        <p className="text-center text-slate-500 text-xs mt-6">
          Sin ofertas relevadas.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
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
  const [ofertasPorTienda, setOfertasPorTienda] = useState({});
  const [cargandoPorTienda, setCargandoPorTienda] = useState({});
  const [progresoPorTienda, setProgresoPorTienda] = useState({});
  const [productoSeleccionado, setProductoSeleccionado] = useState(null);
  const [grupoActivo, setGrupoActivo] = useState(null);
  const [terminoFiltroCarrefour, setTerminoFiltroCarrefour] = useState("TODOS");

  const canceladoRef = useRef(false);

  const fetchOfertasTienda = async (key) => {
    const config = TIENDAS_OFERTAS[key];
    if (!config?.mapear) return;

    setCargandoPorTienda((prev) => ({ ...prev, [key]: true }));
    setProgresoPorTienda((prev) => ({ ...prev, [key]: 0 }));

    const tareas = TERMINOS_CANASTA.map((termino) => async () => {
      const resultado = await buscarOfertasDeTermino(
        key,
        config.mapear,
        termino,
      );
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

    // LÓGICA DE FETCH PARA TESTING (habilitar de a un supermercado por vez):
    // [ACTIVADO] 1. Carrefour
    fetchOfertasTienda("carrefour");

    // [PAUSADO] 2. Dia
    // fetchOfertasTienda("dia");

    // [PAUSADO] 3. ChangoMas
    // fetchOfertasTienda("changomas");

    // [PAUSADO] 4. Vea
    // fetchOfertasTienda("vea");

    // [PAUSADO] 5. Coto
    // fetchOfertasTienda("coto");

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

  const ofertasCarrefour = ofertasPorTienda.carrefour || [];

  const conteoPorTerminoCarrefour = useMemo(() => {
    const conteo = {};
    ofertasCarrefour.forEach((p) => {
      if (p.termino) conteo[p.termino] = (conteo[p.termino] || 0) + 1;
    });
    return conteo;
  }, [ofertasCarrefour]);

  const ofertasCarrefourFiltradas = useMemo(() => {
    if (terminoFiltroCarrefour === "TODOS") return ofertasCarrefour;
    return ofertasCarrefour.filter(
      (p) => p.termino === terminoFiltroCarrefour,
    );
  }, [ofertasCarrefour, terminoFiltroCarrefour]);

  return (
    <div className="text-white">
      <div className="flex items-center justify-between gap-2 mb-4">
        <h1 className="text-xl font-bold">Ofertas destacadas</h1>
        <span className="text-xs text-slate-400">
          {todasLasOfertas.length} ofertas encontradas
        </span>
      </div>

      <ProductMatchContext.Provider value={productMatchValue}>
        <div className="flex flex-col gap-3 lg:grid lg:grid-cols-5 lg:gap-3 lg:h-[calc(100vh-160px)] lg:items-stretch">
          {COLUMNAS.map((key) => (
            <ColumnaTienda
              key={key}
              nombre={TIENDAS_OFERTAS[key].nombre}
              logo={SUPERMARKET_LOGOS[key]}
              ofertas={
                key === "carrefour"
                  ? ofertasCarrefourFiltradas
                  : ofertasPorTienda[key] || []
              }
              cargando={!!cargandoPorTienda[key]}
              progreso={progresoPorTienda[key] || 0}
              totalTareas={totalTareas}
              onSeleccionar={setProductoSeleccionado}
              selectorTermino={
                key === "carrefour" ? (
                  <SelectorTermino
                    terminoSeleccionado={terminoFiltroCarrefour}
                    onChange={setTerminoFiltroCarrefour}
                    conteoPorTermino={conteoPorTerminoCarrefour}
                    totalOfertas={ofertasCarrefour.length}
                  />
                ) : null
              }
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
                {formatearPrecioPorUnidad(
                  productoSeleccionado.precio,
                  productoSeleccionado.contenido,
                ) || ""}
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

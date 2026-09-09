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
import {
  guardarConTTL,
  leerConTTL,
  TTL_FILTROS_OFERTAS,
  agregarAlHistorial,
  eliminarDelHistorial,
  leerHistorial,
  TTL_HISTORIAL_BUSQUEDA,
} from "../utils/persistenciaFiltros";

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

   
    const dataConStock = data.filter((item) => {
      const offer = item?.items?.[0]?.sellers?.[0]?.commertialOffer;
      return offer?.IsAvailable === true && (offer?.AvailableQuantity ?? 0) > 0;
    });

    const mapeados = await mapear(dataConStock);
    return mapeados
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

const TarjetaOferta = ({ prod, onSeleccionar, vistaUnica }) => {
  const { claseBorde, onMouseEnter, onMouseLeave } = useEstiloTarjeta(
    prod.tienda,
    prod.id,
  );

  return (
    <div
      onClick={() => onSeleccionar(prod)}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`${vistaUnica ? "w-full max-w-[240px]" : "w-[220px] sm:w-[280px] shrink-0 snap-start lg:w-full lg:snap-align-none"} bg-slate-800 rounded-lg p-2.5 sm:p-2 flex flex-col justify-between shadow transition-all overflow-hidden cursor-pointer hover:scale-[1.01] ${claseBorde}`}
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

// Claves de localStorage para persistir los filtros del buscador (ver TTL_FILTROS_OFERTAS)
const CLAVE_BUSQUEDA = "ofertas.filtros.busqueda";
const CLAVE_TERMINO = "ofertas.filtros.termino";
const CLAVE_MARCA = "ofertas.filtros.marca";
const CLAVE_TIENDA = "ofertas.filtros.tienda";
const CLAVE_HISTORIAL_BUSQUEDA = "ofertas.historial.busqueda";

const BarraFiltros = ({
  busqueda,
  onBusquedaChange,
  onConfirmarBusqueda,
  historial,
  mostrarHistorial,
  onMostrarHistorial,
  onOcultarHistorial,
  onSeleccionarHistorial,
  onEliminarHistorial,
  terminoSeleccionado,
  onTerminoChange,
  conteoGlobalPorTermino,
  totalOfertas,
  marcaSeleccionada,
  onMarcaChange,
  marcasDisponibles,
  tiendaSeleccionada,
  onTiendaChange,
}) => (
  <div className="w-full max-w-3xl mx-auto mb-4 flex flex-col sm:flex-row gap-2">
    <div className="relative w-full sm:flex-1">
      <input
        type="text"
        value={busqueda}
        onChange={(e) => onBusquedaChange(e.target.value)}
        onFocus={onMostrarHistorial}
        onBlur={() => setTimeout(onOcultarHistorial, 150)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onConfirmarBusqueda(busqueda);
        }}
        placeholder="Buscar oferta por nombre..."
        aria-label="Buscar oferta por nombre"
        className="w-full px-3 py-2 border border-slate-700 rounded-lg bg-slate-800 text-slate-100 shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
      />
      {mostrarHistorial && historial.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto bg-slate-800 border border-slate-700 rounded-lg shadow-lg text-sm">
          {historial.map((item) => (
            <li
              key={item.valor}
              className="flex items-center justify-between px-3 py-1.5 hover:bg-slate-700 cursor-pointer"
              onMouseDown={() => onSeleccionarHistorial(item.valor)}
            >
              <span className="truncate text-slate-200">{item.valor}</span>
              <button
                type="button"
                aria-label={`Eliminar "${item.valor}" del historial`}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  onEliminarHistorial(item.valor);
                }}
                className="ml-2 shrink-0 text-slate-500 hover:text-slate-200"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>

    <select
      aria-label="Filtrar por supermercado"
      value={tiendaSeleccionada}
      onChange={(e) => onTiendaChange(e.target.value)}
      className="w-full sm:w-48 px-3 py-2 border border-slate-700 rounded-lg bg-slate-800 text-slate-100 shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
    >
      <option value="TODOS">Todos los supermercados</option>
      {COLUMNAS.map((key) => (
        <option key={key} value={key}>
          {TIENDAS_OFERTAS[key].nombre}
        </option>
      ))}
    </select>

    <select
      id="filtro-canasta-global"
      aria-label="Filtrar por categoría"
      value={terminoSeleccionado}
      onChange={(e) => onTerminoChange(e.target.value)}
      className="w-full sm:w-56 px-3 py-2 border border-slate-700 rounded-lg bg-slate-800 text-slate-100 shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
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

    <select
      aria-label="Filtrar por marca"
      value={marcaSeleccionada}
      onChange={(e) => onMarcaChange(e.target.value)}
      className="w-full sm:w-48 px-3 py-2 border border-slate-700 rounded-lg bg-slate-800 text-slate-100 shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
    >
      <option value="TODAS">Todas las marcas</option>
      {marcasDisponibles.map((marca) => (
        <option key={marca} value={marca}>
          {marca}
        </option>
      ))}
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
  vistaUnica,
}) => (
  <div
    className={`bg-slate-950/40 border-2 border-slate-600 rounded-xl overflow-hidden flex flex-col lg:h-full lg:min-w-0 ${vistaUnica ? "max-w-7xl mx-auto w-full" : ""}`}
  >
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
        <div
          className={
            vistaUnica
              ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 justify-items-center"
              : "flex justify-start gap-2 overflow-x-auto px-2 pb-2 snap-x snap-mandatory scroll-px-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:flex-col lg:items-stretch lg:overflow-x-visible lg:px-0 lg:pb-0 lg:snap-none"
          }
        >
          {ofertas.map((prod) => (
            <TarjetaOferta
              key={prod.id}
              prod={prod}
              onSeleccionar={onSeleccionar}
              vistaUnica={vistaUnica}
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
  // Estado inicial de los filtros: se recupera de localStorage si no vencieron
  // (TTL 3hs); si vencieron, leerConTTL ya los limpia solo y quedan los defaults.
  const [terminoFiltroGlobal, setTerminoFiltroGlobal] = useState(
    () => leerConTTL(CLAVE_TERMINO, TTL_FILTROS_OFERTAS) ?? "TODOS",
  );
  const [busqueda, setBusqueda] = useState(
    () => leerConTTL(CLAVE_BUSQUEDA, TTL_FILTROS_OFERTAS) ?? "",
  );
  const [marcaFiltro, setMarcaFiltro] = useState(
    () => leerConTTL(CLAVE_MARCA, TTL_FILTROS_OFERTAS) ?? "TODAS",
  );
  const [tiendaFiltro, setTiendaFiltro] = useState(
    () => leerConTTL(CLAVE_TIENDA, TTL_FILTROS_OFERTAS) ?? "TODOS",
  );
  const [historialBusqueda, setHistorialBusqueda] = useState(() =>
    leerHistorial(CLAVE_HISTORIAL_BUSQUEDA, TTL_HISTORIAL_BUSQUEDA),
  );
  const [mostrarHistorial, setMostrarHistorial] = useState(false);

  const canceladoRef = useRef(false);

  const confirmarBusqueda = (valor) => {
    if (!valor?.trim()) return;
    setHistorialBusqueda(
      agregarAlHistorial(
        CLAVE_HISTORIAL_BUSQUEDA,
        valor,
        TTL_HISTORIAL_BUSQUEDA,
      ),
    );
    setMostrarHistorial(false);
  };

  const seleccionarDelHistorial = (valor) => {
    setBusqueda(valor);
    confirmarBusqueda(valor);
  };

  const eliminarItemHistorial = (valor) => {
    setHistorialBusqueda(
      eliminarDelHistorial(
        CLAVE_HISTORIAL_BUSQUEDA,
        valor,
        TTL_HISTORIAL_BUSQUEDA,
      ),
    );
  };

  useEffect(() => {
    guardarConTTL(CLAVE_BUSQUEDA, busqueda);
  }, [busqueda]);

  useEffect(() => {
    guardarConTTL(CLAVE_TERMINO, terminoFiltroGlobal);
  }, [terminoFiltroGlobal]);

  useEffect(() => {
    guardarConTTL(CLAVE_MARCA, marcaFiltro);
  }, [marcaFiltro]);

  useEffect(() => {
    guardarConTTL(CLAVE_TIENDA, tiendaFiltro);
  }, [tiendaFiltro]);

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

  // Si hay una tienda específica seleccionada, solo se relevan sus ofertas
  // (evita llamadas innecesarias a las otras 4 APIs).
  const columnasACargar = useMemo(
    () => (tiendaFiltro === "TODOS" ? COLUMNAS : [tiendaFiltro]),
    [tiendaFiltro],
  );

  useEffect(() => {
    canceladoRef.current = false;

    const cargarSecuencial = async () => {
      for (const key of columnasACargar) {
        if (canceladoRef.current) return;
        if (ofertasPorTienda[key]) continue;
        await fetchOfertasTienda(key);
      }
    };
    cargarSecuencial();

    return () => {
      canceladoRef.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tiendaFiltro]);

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

  const marcasDisponibles = useMemo(() => {
    const marcas = new Set();
    todasLasOfertas.forEach((p) => {
      if (p.marca) marcas.add(p.marca);
    });
    return Array.from(marcas).sort((a, b) =>
      a.localeCompare(b, "es", { sensitivity: "base" }),
    );
  }, [todasLasOfertas]);

  const busquedaNormalizada = busqueda.trim().toLowerCase();

  const ofertasFiltradasPorTienda = useMemo(() => {
    const resultado = {};
    columnasACargar.forEach((key) => {
      const ofertas = ofertasPorTienda[key] || [];
      const filtradas = ofertas.filter((p) => {
        // Oferta real: precio de venta estrictamente menor al precio de lista.
        // Ya viene garantizado desde el fetch, se reafirma acá como defensa.
        if (!(p.listPrice > p.precio)) return false;
        if (
          terminoFiltroGlobal !== "TODOS" &&
          p.termino !== terminoFiltroGlobal
        )
          return false;
        if (marcaFiltro !== "TODAS" && p.marca !== marcaFiltro) return false;
        if (
          busquedaNormalizada &&
          !(p.nombre || "").toLowerCase().includes(busquedaNormalizada)
        )
          return false;
        return true;
      });
      resultado[key] = ordenarPorPrecioRelativo(filtradas);
    });
    return resultado;
  }, [
    ofertasPorTienda,
    columnasACargar,
    terminoFiltroGlobal,
    marcaFiltro,
    busquedaNormalizada,
  ]);

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

      <BarraFiltros
        busqueda={busqueda}
        onBusquedaChange={setBusqueda}
        onConfirmarBusqueda={confirmarBusqueda}
        historial={historialBusqueda}
        mostrarHistorial={mostrarHistorial}
        onMostrarHistorial={() => setMostrarHistorial(true)}
        onOcultarHistorial={() => setMostrarHistorial(false)}
        onSeleccionarHistorial={seleccionarDelHistorial}
        onEliminarHistorial={eliminarItemHistorial}
        terminoSeleccionado={terminoFiltroGlobal}
        onTerminoChange={setTerminoFiltroGlobal}
        conteoGlobalPorTermino={conteoGlobalPorTermino}
        totalOfertas={todasLasOfertas.length}
        marcaSeleccionada={marcaFiltro}
        onMarcaChange={setMarcaFiltro}
        marcasDisponibles={marcasDisponibles}
        tiendaSeleccionada={tiendaFiltro}
        onTiendaChange={setTiendaFiltro}
      />

      <ProductMatchContext.Provider value={productMatchValue}>
        <div
          className={`flex flex-col gap-3 lg:grid lg:gap-3 lg:h-[calc(100vh-200px)] lg:items-stretch ${
            columnasACargar.length > 1 ? "lg:grid-cols-5" : "lg:grid-cols-1"
          }`}
        >
          {columnasACargar.map((key) => (
            <ColumnaTienda
              key={key}
              nombre={TIENDAS_OFERTAS[key].nombre}
              logo={SUPERMARKET_LOGOS[key]}
              ofertas={ofertasFiltradasPorTienda[key] || []}
              cargando={!!cargandoPorTienda[key]}
              progreso={progresoPorTienda[key] || 0}
              totalTareas={totalTareas}
              onSeleccionar={setProductoSeleccionado}
              vistaUnica={columnasACargar.length === 1}
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

import { useMemo, useState } from "react";
import { Routes, Route, Link, useLocation, useNavigate } from "react-router-dom";
import { SUPERMARKET_LOGOS } from "./assets/logos/logos";
import Ofertas from "./ofertas/page/ofertas";
import ProductsCoto from "./components/coto/ProductsCoto";
import ProductsCarrefour from "./components/carrefour/ProductsCarrefour";
import ProductsDia from "./components/Dia/ProductsDia";
import ProductsChangoMas from "./components/changomas/ProductsChangoMas";
import ProductsVea from "./components/vea/ProductsVea";
import { RANGOS_CONTENIDO, obtenerRangoContenido } from "./utils/contenido";
import { construirInfoDeCoincidencias } from "./utils/productMatch";
import { ProductMatchContext } from "./context/ProductMatchContext";

const TIENDAS = [
  {
    key: "carrefour",
    nombre: "Carrefour",
    logo: SUPERMARKET_LOGOS.carrefour,
    Componente: ProductsCarrefour,
  },
  {
    key: "dia",
    nombre: "Día",
    logo: SUPERMARKET_LOGOS.dia,
    Componente: ProductsDia,
  },
  {
    key: "changomas",
    nombre: "ChangoMás",
    logo: SUPERMARKET_LOGOS.changomas,
    Componente: ProductsChangoMas,
  },
  {
    key: "vea",
    nombre: "Vea",
    logo: SUPERMARKET_LOGOS.vea,
    Componente: ProductsVea,
  },
  {
    key: "coto",
    nombre: "Coto",
    logo: SUPERMARKET_LOGOS.coto,
    Componente: ProductsCoto,
  },
];

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const enOfertas = location.pathname === "/ofertas";

  const [input, setInput] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [conteos, setConteos] = useState({});
  const [productosPorTienda, setProductosPorTienda] = useState({});

  // Filtros globales
  const [filtroContenidoGlobal, setFiltroContenidoGlobal] = useState("");
  const [filtroMarcaGlobal, setFiltroMarcaGlobal] = useState("");

  const dispararBusqueda = () => {
    const termino = input.trim();
    if (termino) {
      setBusqueda(termino);
      setFiltroContenidoGlobal("");
      setFiltroMarcaGlobal("");
      setProductosPorTienda({});
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") dispararBusqueda();
  };

  const todosLosProductos = useMemo(
    () => Object.values(productosPorTienda).flat(),
    [productosPorTienda],
  );

  // Agrupa productos equivalentes entre tiendas (mismo producto, marca y contenido)
  // para determinar quién es el más barato, quién compite y quién es único.
  const matchInfoPorClave = useMemo(
    () => construirInfoDeCoincidencias(todosLosProductos),
    [todosLosProductos],
  );

  const [grupoActivo, setGrupoActivo] = useState(null);

  const productMatchValue = useMemo(
    () => ({ matchInfoPorClave, grupoActivo, setGrupoActivo }),
    [matchInfoPorClave, grupoActivo],
  );

  // Medidas únicas disponibles en todos los resultados
  const medidasDisponiblesGlobal = useMemo(() => {
    const rangos = new Set(
      todosLosProductos.map((p) => obtenerRangoContenido(p.contenido)),
    );
    return RANGOS_CONTENIDO.filter((r) => rangos.has(r));
  }, [todosLosProductos]);

  // Marcas disponibles con conteo de productos, filtradas en cascada según la medida seleccionada
  const marcasConConteo = useMemo(() => {
    const productosParaMarcas = filtroContenidoGlobal
      ? todosLosProductos.filter(
          (p) => obtenerRangoContenido(p.contenido) === filtroContenidoGlobal,
        )
      : todosLosProductos;

    const conteoMap = new Map();
    productosParaMarcas.forEach((p) => {
      const marcaClean = p.marca?.toUpperCase().trim();
      if (marcaClean && marcaClean !== "SIN MARCA") {
        conteoMap.set(marcaClean, (conteoMap.get(marcaClean) || 0) + 1);
      }
    });

    return Array.from(conteoMap.entries())
      .map(([nombre, cantidad]) => ({ nombre, cantidad }))
      .sort((a, b) =>
        a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }),
      );
  }, [todosLosProductos, filtroContenidoGlobal]);

  const handleContenidoChange = (e) => {
    setFiltroContenidoGlobal(e.target.value);
    setFiltroMarcaGlobal("");
  };

  const handleProductosTienda = (key, productos) => {
    setProductosPorTienda((prev) => {
      if (prev[key] === productos) return prev;
      return { ...prev, [key]: productos };
    });
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <header className="sticky top-0 z-20 bg-slate-900/95 backdrop-blur border-b border-slate-800 p-2 sm:p-4">
        {enOfertas ? (
          <div className="max-w-3xl mx-auto">
            <button
              onClick={() => navigate("/")}
              className="bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold px-4 py-2 rounded-lg transition-colors flex items-center gap-2 text-sm"
            >
              ← Volver
            </button>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto grid grid-cols-2 gap-2 md:flex md:flex-row md:items-center md:gap-3">
            <Link
              to="/ofertas"
              className="md:order-0 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold px-3 md:px-4 h-9 md:h-auto md:py-2.5 rounded-lg flex items-center justify-center text-xs md:text-sm transition-colors shadow-sm"
            >
              Ofertas
            </Link>

            <div className="flex flex-col gap-1.5 min-w-0 md:contents">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Buscar producto..."
                className="md:order-1 md:flex-1 md:min-w-[200px] bg-slate-800 border border-slate-700 text-slate-100 text-xs md:text-sm rounded-lg px-3 md:px-4 h-9 md:h-auto md:py-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
              <button
                onClick={dispararBusqueda}
                className="md:order-2 md:flex-none md:w-auto bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs md:text-sm px-3 md:px-5 h-9 md:h-auto md:py-2.5 rounded-lg transition-colors"
              >
                Buscar
              </button>
            </div>

            <div className="flex flex-col gap-1.5 min-w-0 md:contents">
              <select
                value={filtroContenidoGlobal}
                onChange={handleContenidoChange}
                disabled={!busqueda}
                className="md:order-3 md:flex-none md:w-auto bg-slate-800 border border-slate-700 text-slate-200 text-xs md:text-sm rounded-lg px-2 md:px-3 h-9 md:h-auto md:py-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none disabled:opacity-50 min-w-0"
              >
                <option value="">
                  Medida ({medidasDisponiblesGlobal.length})
                </option>
                {[...medidasDisponiblesGlobal]
                  .sort((a, b) =>
                    a.localeCompare(b, "es", { sensitivity: "base" }),
                  )
                  .map((cont, i) => (
                    <option key={i} value={cont}>
                      {cont}
                    </option>
                  ))}
              </select>

              <select
                value={filtroMarcaGlobal}
                onChange={(e) => setFiltroMarcaGlobal(e.target.value)}
                disabled={!busqueda}
                className="md:order-4 md:flex-none md:w-auto bg-slate-800 border border-slate-700 text-slate-200 text-xs md:text-sm rounded-lg px-2 md:px-3 h-9 md:h-auto md:py-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none disabled:opacity-50 min-w-0"
              >
                <option value="">Marca ({marcasConConteo.length})</option>
                {marcasConConteo.map(({ nombre, cantidad }, i) => (
                  <option key={i} value={nombre}>
                    {nombre} ({cantidad})
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </header>

      <main className="p-4 lg:h-[calc(120vh-90px)] lg:overflow-hidden">
        <Routes>
          <Route
            path="/"
            element={
              !busqueda ? (
                <p className="text-center text-slate-400 mt-16">
                  Escribí un producto y presioná Buscar para comparar precios
                  entre Carrefour, Día, ChangoMás, Vea y Coto.
                </p>
              ) : (
                <ProductMatchContext.Provider value={productMatchValue}>
                  <div className="flex flex-col gap-3 lg:grid lg:grid-cols-5 lg:gap-3 lg:h-full lg:items-stretch">
                    {TIENDAS.map(({ key, nombre, logo, Componente }) => (
                      <div
                        key={key}
                        className="bg-slate-950/40 border-2 border-slate-600 rounded-xl overflow-hidden flex flex-col lg:h-full lg:min-w-0"
                      >
                        <div className="flex items-center justify-start lg:justify-center gap-2 p-2 sm:p-3 border-b border-slate-800 bg-slate-900 shrink-0">
                          <img
                            src={logo}
                            alt={nombre}
                            className="h-8 sm:h-10 object-contain"
                          />
                          {typeof conteos[key] === "number" && (
                            <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-full pl-2 pr-2.5 py-0.5 leading-none">
                              <span className="text-sm font-bold">
                                {conteos[key]}
                              </span>
                              productos encontrados
                            </span>
                          )}
                        </div>
                        <div className="flex-1 lg:overflow-y-auto lg:min-h-0 scroll-tienda">
                          <Componente
                            busqueda={busqueda}
                            filtroContenido={filtroContenidoGlobal}
                            filtroMarca={filtroMarcaGlobal}
                            onCount={(n) =>
                              setConteos((prev) =>
                                prev[key] === n ? prev : { ...prev, [key]: n },
                              )
                            }
                            onProducts={(productos) =>
                              handleProductosTienda(key, productos)
                            }
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </ProductMatchContext.Provider>
              )
            }
          />
          <Route path="/ofertas" element={<Ofertas />} />
        </Routes>
      </main>
    </div>
  );
}

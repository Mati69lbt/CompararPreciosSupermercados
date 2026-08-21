import { useState } from "react";
import { SUPERMARKET_LOGOS } from "./assets/logos/logos";
import ProductsCoto from "./components/coto/ProductsCoto";
import ProductsCarrefour from "./components/carrefour/ProductsCarrefour";
import ProductsDia from "./components/Dia/ProductsDia";
import ProductsChangoMas from "./components/changomas/ProductsChangoMas";
import ProductsVea from "./components/vea/ProductsVea";

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
  const [input, setInput] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [conteos, setConteos] = useState({});

  const dispararBusqueda = () => {
    const termino = input.trim();
    if (termino) setBusqueda(termino);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") dispararBusqueda();
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <header className="sticky top-0 z-20 bg-slate-900/95 backdrop-blur border-b border-slate-800 p-4">
        <div className="max-w-3xl mx-auto flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar producto (ej: leche, arroz, fideos)..."
            className="flex-1 bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          />
          <button
            onClick={dispararBusqueda}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm px-5 py-2.5 rounded-lg transition-colors"
          >
            Buscar
          </button>
        </div>
      </header>

      <main className="p-4 lg:h-[calc(120vh-90px)] lg:overflow-hidden">
        {!busqueda ? (
          <p className="text-center text-slate-400 mt-16">
            Escribí un producto y presioná Buscar para comparar precios entre
            Carrefour, Día, ChangoMás, Vea y Coto.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 items-start lg:grid-cols-5 lg:h-full lg:items-stretch">
            {TIENDAS.map(({ key, nombre, logo, Componente }) => (
              <div
                key={key}
                className="bg-slate-950/40 border border-slate-800 rounded-xl overflow-hidden flex flex-col lg:h-full lg:min-w-0"
              >
                <div className="flex items-center justify-center gap-2 p-3 border-b border-slate-800 bg-slate-900 shrink-0">
                  <img
                    src={logo}
                    alt={nombre}
                    className="h-10 object-contain"
                  />
                  {typeof conteos[key] === "number" && (
                    <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-full pl-2 pr-2.5 py-0.5 leading-none">
                      <span className="text-sm font-bold">{conteos[key]}</span>
                      productos encontrados
                    </span>
                  )}
                </div>
                <div className="flex-1 lg:overflow-y-auto lg:min-h-0 scroll-tienda">
                  <Componente
                    busqueda={busqueda}
                    onCount={(n) =>
                      setConteos((prev) =>
                        prev[key] === n ? prev : { ...prev, [key]: n },
                      )
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

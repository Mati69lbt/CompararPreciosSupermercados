import { createContext, useContext } from "react";

// matchInfoPorClave: Map<"tienda:id", { estado: "unico"|"ganador"|"compite", groupId }>
export const ProductMatchContext = createContext({
  matchInfoPorClave: new Map(),
  grupoActivo: null,
  setGrupoActivo: () => {},
});

const BORDE_DEFECTO = "border border-slate-700 hover:border-slate-500";
const BORDE_UNICO = "border-2 border-cyan-400 shadow-md shadow-cyan-500/50";
const BORDE_GANADOR = "border-2 border-emerald-500 shadow-md shadow-green-500/50";
const BORDE_RESALTADO = "border-2 border-yellow-400 shadow-md shadow-yellow-400/50";

// Devuelve la clase de borde y los handlers de hover para la tarjeta de un producto,
// según su estado dentro del grupo de coincidencias entre supermercados.
export const useEstiloTarjeta = (tienda, id) => {
  const { matchInfoPorClave, grupoActivo, setGrupoActivo } = useContext(ProductMatchContext);
  const info = matchInfoPorClave.get(`${tienda}:${id}`);

  if (!info) return { claseBorde: BORDE_DEFECTO };

  if (info.estado === "unico") {
    return { claseBorde: BORDE_UNICO };
  }

  if (info.estado === "ganador") {
    return {
      claseBorde: BORDE_GANADOR,
      onMouseEnter: () => setGrupoActivo(info.groupId),
      onMouseLeave: () => setGrupoActivo(null),
    };
  }

  // "compite": pierde frente al más barato del grupo, salvo que se esté resaltando el grupo
  return {
    claseBorde: grupoActivo === info.groupId ? BORDE_RESALTADO : BORDE_DEFECTO,
  };
};

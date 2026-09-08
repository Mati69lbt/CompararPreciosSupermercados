// Persistencia genérica en localStorage con expiración (TTL).
// Cada entrada se guarda como { valor, guardadoEn } y se descarta sola
// si al leerla ya pasó más tiempo que el TTL indicado.

export const TTL_FILTROS_OFERTAS = 3 * 60 * 60 * 1000; // 3 horas

export const guardarConTTL = (key, valor) => {
  try {
    localStorage.setItem(
      key,
      JSON.stringify({ valor, guardadoEn: Date.now() }),
    );
  } catch {
    // localStorage no disponible (modo privado, cuota llena, etc.) -> no persistir
  }
};

export const leerConTTL = (key, ttlMs) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return undefined;

    const { valor, guardadoEn } = JSON.parse(raw);
    if (typeof guardadoEn !== "number" || Date.now() - guardadoEn >= ttlMs) {
      localStorage.removeItem(key);
      return undefined;
    }
    return valor;
  } catch {
    localStorage.removeItem(key);
    return undefined;
  }
};

export const limpiarClaves = (keys) => {
  keys.forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      // no-op
    }
  });
};

// Historial de búsquedas: lista de { valor, guardadoEn }, cada entrada
// expira individualmente a las 3hs (no todo el historial junto).
export const TTL_HISTORIAL_BUSQUEDA = 3 * 60 * 60 * 1000; // 3 horas
export const MAX_HISTORIAL_BUSQUEDA = 30;

const leerListaCruda = (key) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const lista = JSON.parse(raw);
    return Array.isArray(lista) ? lista : [];
  } catch {
    localStorage.removeItem(key);
    return [];
  }
};

const guardarLista = (key, lista) => {
  try {
    localStorage.setItem(key, JSON.stringify(lista));
  } catch {
    // localStorage no disponible -> no persistir
  }
};

// Devuelve el historial vigente (descarta y persiste sin las entradas vencidas).
export const leerHistorial = (key, ttlMs = TTL_HISTORIAL_BUSQUEDA) => {
  const lista = leerListaCruda(key);
  const vigentes = lista.filter(
    (item) =>
      typeof item?.valor === "string" &&
      typeof item?.guardadoEn === "number" &&
      Date.now() - item.guardadoEn < ttlMs,
  );
  if (vigentes.length !== lista.length) guardarLista(key, vigentes);
  return vigentes;
};

// Agrega un término al frente del historial (sin duplicados, case-insensitive),
// recorta a maxItems y descarta vencidos. Devuelve el historial actualizado.
export const agregarAlHistorial = (
  key,
  valor,
  ttlMs = TTL_HISTORIAL_BUSQUEDA,
  maxItems = MAX_HISTORIAL_BUSQUEDA,
) => {
  const termino = valor?.trim();
  if (!termino) return leerHistorial(key, ttlMs);

  const sinDuplicado = leerHistorial(key, ttlMs).filter(
    (item) => item.valor.toLowerCase() !== termino.toLowerCase(),
  );
  const actualizado = [
    { valor: termino, guardadoEn: Date.now() },
    ...sinDuplicado,
  ].slice(0, maxItems);

  guardarLista(key, actualizado);
  return actualizado;
};

export const eliminarDelHistorial = (
  key,
  valor,
  ttlMs = TTL_HISTORIAL_BUSQUEDA,
) => {
  const actualizado = leerHistorial(key, ttlMs).filter(
    (item) => item.valor !== valor,
  );
  guardarLista(key, actualizado);
  return actualizado;
};

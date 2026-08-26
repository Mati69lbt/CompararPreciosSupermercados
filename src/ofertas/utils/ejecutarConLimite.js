// Ejecuta una lista de funciones productoras de promesas respetando un límite
// de concurrencia, para no disparar cientos de fetches simultáneos al proxy de dev.
export const ejecutarConLimite = async (tareas, limite = 6) => {
  const resultados = new Array(tareas.length);
  let indice = 0;

  const trabajador = async () => {
    while (indice < tareas.length) {
      const actual = indice++;
      resultados[actual] = await tareas[actual]();
    }
  };

  const workers = Array.from({ length: Math.min(limite, tareas.length) }, trabajador);
  await Promise.all(workers);

  return resultados;
};

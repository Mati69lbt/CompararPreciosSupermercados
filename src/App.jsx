import { useEffect } from "react";
import ProductsCoto from "./components/coto/ProductsCoto";
import ProductsCarrefour from "./components/carrefour/ProductsCarrefour";
import ProductsDia from "./components/Dia/ProductsDia";
import ProductsChangoMas from "./components/changomas/ProductsChangoMas";
import ProductsVea from "./components/vea/ProductsVea";
import ProductsMeli from "./components/mercadoLibre/ProductsMeli";

export default function App() {
  const probarAPIs = async (busqueda = "leche") => {
    console.log(`🔎 --- PROBANDO BÚSQUEDA PARA: "${busqueda}" ---`);

    // 1. CARREFOUR (VTEX)
    // try {
    //   const res = await fetch(
    //     `${import.meta.env.VITE_API_CARREFOUR}${busqueda}`,
    //   );
    //   const data = await res.json();
    //   console.log("🛒 1. CARREFOUR Data:", data);
    // } catch (err) {
    //   console.error("❌ Error Carrefour:", err);
    // }

    // 2. DÍA (VTEX)
    // try {
    //   const res = await fetch(`${import.meta.env.VITE_API_DIA}${busqueda}`);
    //   const data = await res.json();
    //   console.log("🛒 2. DÍA Data:", data);
    // } catch (err) {
    //   console.error("❌ Error Día:", err);
    // }

    // 3. CHANGOMÁS / MÁSONLINE (VTEX)
    // try {
    //   const res = await fetch(
    //     `${import.meta.env.VITE_API_CHANGOMAS}${busqueda}`,
    //   );
    //   const data = await res.json();
    //   console.log("🛒 3. CHANGOMÁS Data:", data);
    // } catch (err) {
    //   console.error("❌ Error ChangoMás:", err);
    // }

    // 4. VEA (VTEX)
    // try {
    //   const res = await fetch(`${import.meta.env.VITE_API_VEA}${busqueda}`);
    //   const data = await res.json();
    //   console.log("🛒 4. VEA Data:", data);
    // } catch (err) {
    //   console.error("❌ Error Vea:", err);
    // }

    // 5. MERCADO LIBRE
    // try {
    //   const res = await fetch(
    //     `${import.meta.env.VITE_API_MERCADOLIBRE}${busqueda}`,
    //   );
    //   const data = await res.json();
    //   console.log("🛒 5. MERCADO LIBRE Data:", data);
    // } catch (err) {
    //   console.error("❌ Error Mercado Libre:", err);
    // }

    // 6. COTO (BFF)
    // try {
    //   const urlCoto = `https://api.coto.com.ar/api/v1/ms-digital-sitio-bff-web/api/v1/products/search/${busqueda}?key=${import.meta.env.VITE_API_COTO_KEY}&num_results_per_page=24&pre_filter_expression=%7B%22name%22:%22store_availability%22,%22value%22:%22${import.meta.env.VITE_API_COTO_STORE}%22%7D`;
    //   const res = await fetch(urlCoto);
    //   const data = await res.json();
    //   console.log("🛒 6. COTO Data:", data);
    // } catch (err) {
    //   console.error("❌ Error Coto:", err);
    // }
  };

  useEffect(() => {
    probarAPIs("leche");
  }, []);

  return (
    <div className="p-8 bg-slate-900 text-white min-h-screen">
      {/* <ProductsCoto /> */}
      {/* <ProductsCarrefour /> */}
      {/* <ProductsDia /> */}
      {/* <ProductsChangoMas /> */}
      {/* <ProductsVea /> */}
      <ProductsMeli />
    </div>
  );
}

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api-carrefour': {
        target: 'https://www.carrefour.com.ar/api/catalog_system/pub/products/search',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-carrefour/, ''),
      },
      '/api-dia': {
        target: 'https://diaonline.supermercadosdia.com.ar/api/catalog_system/pub/products/search',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-dia/, ''),
      },
      '/api-changomas': {
        target: 'https://www.masonline.com.ar/api/catalog_system/pub/products/search',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-changomas/, ''),
      },
      '/api-vea': {
        target: 'https://www.vea.com.ar/api/catalog_system/pub/products/search',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-vea/, ''),
      },  '/api-meli': {
  target: 'https://api.mercadolibre.com',
  changeOrigin: true,
  rewrite: (path) => path.replace(/^\/api-meli/, ''),
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json',
  },
},
    },
  },
})
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  // Use relative paths — required for Capacitor.
  base: './',

  // Don't obscure errors in the browser console
  clearScreen: false,

  server: {
    host: true,
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000', // Backend local (dev)
        changeOrigin: true,
        secure: false,
      },
      '/assets': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/images': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },

  build: {
    target: 'es2015',
    sourcemap: false,
    minify: 'esbuild',
  },

  esbuild: {
    drop: ['console', 'debugger'],
  },
})

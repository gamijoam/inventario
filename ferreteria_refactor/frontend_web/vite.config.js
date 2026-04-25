import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      // Stubs para build web — evitan el "Illegal constructor" de Capacitor v8
      '@capacitor/core': path.resolve('./src/stubs/capacitor-core.js'),
      '@capacitor/app':  path.resolve('./src/stubs/capacitor-app.js'),
      '@capacitor-community/barcode-scanner': path.resolve('./src/stubs/barcode-scanner.js'),
    },
  },

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
    target: 'es2020',   // es2015 causa "Illegal constructor" con Capacitor v8 en browser
    sourcemap: false,
    minify: 'esbuild',
  },

  esbuild: {
    drop: ['console', 'debugger'],
  },
})

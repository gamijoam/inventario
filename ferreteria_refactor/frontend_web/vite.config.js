import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Tauri: in dev mode, use the host Tauri provides (needed for mobile/desktop HMR).
// In web-only mode, this is undefined and we fall back to 'true' (all interfaces).
const TAURI_DEV_HOST = process.env.TAURI_DEV_HOST;
const isTauri = !!process.env.TAURI_ENV_ARCH;

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  // Use relative paths — required for Tauri (loads from file://) and Capacitor.
  base: './',

  // Expose TAURI_ENV_* vars to the frontend (in addition to VITE_*)
  envPrefix: ['VITE_', 'TAURI_ENV_'],

  // Don't obscure Rust panics in the browser console
  clearScreen: false,

  server: {
    // Tauri needs a fixed host when TAURI_DEV_HOST is set (mobile/device preview)
    host: TAURI_DEV_HOST || true,
    port: 5173,
    strictPort: true, // Fail fast if port is busy (Tauri expects exactly this port)
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000', // Backend local (dev / offline mode)
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
    // WebView2 (Tauri on Windows) supports modern JS — target Chrome 105+
    // This allows top-level await, etc. without extra polyfills.
    target: isTauri ? 'chrome105' : 'es2015',
    // In debug builds, keep sourcemaps for DevTools
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
    minify: process.env.TAURI_ENV_DEBUG ? false : 'esbuild',
  },

  esbuild: {
    drop: ['console', 'debugger'],
  },
})

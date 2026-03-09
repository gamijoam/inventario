import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

window.onerror = (msg, url, line) => {
  console.error('Global Error in Renderer:', msg, url, line);
};

import GlobalErrorBoundary from './components/GlobalErrorBoundary';

// 🧟 ZOMBIE ROUTE FIX (HashRouter Migration)
// Redirects legacy paths (e.g. /dashboard) to Hash paths (/#/dashboard)
(function () {
  const path = window.location.pathname;
  if (path !== '/' && path !== '/index.html') {
    const cleanPath = path.replace(/^\/+/, ''); // Remove leading slash
    const newUrl = `/#/${cleanPath}${window.location.search}${window.location.hash}`;
    window.location.replace(newUrl);
  }
})();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GlobalErrorBoundary>
      <App />
    </GlobalErrorBoundary>
  </StrictMode>,
)

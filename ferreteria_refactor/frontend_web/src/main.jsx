import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { reportClientError } from './utils/errorReporter.js'

window.onerror = (msg, url, line, column, error) => {
  console.error('Global Error in Renderer:', msg, url, line);
  reportClientError({
    kind: 'CLIENT_ERROR',
    source: 'window.onerror',
    message: msg,
    error,
    context: { url, line, column },
  });
};

window.onunhandledrejection = (event) => {
  const reason = event?.reason;
  console.error('Unhandled Promise Rejection:', reason);
  reportClientError({
    kind: 'CLIENT_ERROR',
    source: 'unhandledrejection',
    message: reason?.message || String(reason || 'Unhandled promise rejection'),
    stack: reason?.stack,
  });
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
  <GlobalErrorBoundary>
    <App />
  </GlobalErrorBoundary>,
)

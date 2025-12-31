import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// DEBUG: Verify Renderer Startup
console.log('🚀 Renderer Process Starting...');
window.onerror = (msg, url, line) => {
  console.error('Global Error in Renderer:', msg, url, line);
};

import GlobalErrorBoundary from './components/GlobalErrorBoundary';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GlobalErrorBoundary>
      <App />
    </GlobalErrorBoundary>
  </StrictMode>,
)

import axios from 'axios';

// --- CAMBIO PARA SOPORTE HÍBRIDO (LOCAL/SAAS) ---
// Detect if running in Electron (file:// protocol or no host)
const isElectron = !window.location.host || window.location.protocol === 'file:';
const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// In Electron, use absolute URL to localhost:8001
// In web, use relative URL (proxy handles it)
const baseURL = isElectron ? 'http://localhost:8001/api/v1' : '/api/v1';

console.log('🔧 Axios config:', { isElectron, isDevelopment, baseURL, hostname: window.location.hostname, protocol: window.location.protocol });

const apiClient = axios.create({
    baseURL,
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    },
});

import toast from 'react-hot-toast';

// Request Interceptor (Add Token)
apiClient.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response Interceptor (Error Handling)
apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error.response ? error.response.status : null;

        if (status === 401) {
            // Avoid redirect loop if already on login page or if error is from login attempt
            const isLoginRequest = error.config.url.includes('/auth/token');
            const isLoginPage = window.location.pathname === '/login';

            if (!isLoginRequest && !isLoginPage) {
                // Unauthorized: Clear token and redirect
                console.warn('⚠️ 401 Detectado - Limpiando sesión y redirigiendo...');
                localStorage.removeItem('token');
                localStorage.removeItem('user');

                // En Electron / HashRouter / react-router v6, cambiar window.location.href puede ser brusco.
                // Intentamos forzar la navegación vía hash si es SPA, o recarga completa si es necesario.
                if (window.location.hash !== '#/login') {
                    window.location.hash = '#/login';
                    // Fallback reload solo si no cambia nada
                    // setTimeout(() => window.location.reload(), 500); 
                }
            } else if (isLoginRequest) {
                // For login failure, just clear potential stale tokens, but let the component handle the error display
                localStorage.removeItem('token');
                localStorage.removeItem('user');
            }
        } else if (status === 403) {
            // Forbidden
            toast.error('No tienes permisos para realizar esta acción.');
        } else if (!status) {
            // Network Error
            toast.error('Error de conexión con el servidor.');
        }

        return Promise.reject(error);
    }
);

export default apiClient;

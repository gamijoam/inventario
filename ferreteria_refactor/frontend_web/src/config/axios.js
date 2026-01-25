import axios from 'axios';
import toast from 'react-hot-toast';

// --- CONFIGURACIÓN AGNÓSTICA AL DOMINIO ---
// En desarrollo: usa localhost:8001
// En producción: usa ruta relativa (el navegador usará el dominio actual)

const isDev = import.meta.env.DEV;

const baseURL = isDev
    ? 'http://localhost:8000/api/v1'  // Desarrollo: backend en puerto 8000
    : '/api/v1';                        // Producción: ruta relativa (Traefik maneja el routing)

console.log('🔧 Axios config:', {
    isDev,
    baseURL,
    mode: import.meta.env.MODE,
    hostname: window.location.hostname
});

const apiClient = axios.create({
    baseURL,
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    },
});

// Request Interceptor (Add Token)
apiClient.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        // --- MULTI-TENANT LOCAL SUPPORT ---
        // Permite probar diferentes empresas en localhost sin subdominios
        const selectedTenant = localStorage.getItem('selected_tenant');
        if (selectedTenant && selectedTenant !== 'public') {
            config.headers['X-Tenant-ID'] = selectedTenant;
            console.log(`🔌 [Axios] Injecting Tenant ID: ${selectedTenant}`);
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

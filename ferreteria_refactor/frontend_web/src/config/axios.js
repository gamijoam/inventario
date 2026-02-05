import axios from 'axios';
import toast from 'react-hot-toast';

// --- CONFIGURACIÓN AGNÓSTICA AL DOMINIO ---
// En desarrollo: usa localhost:8000
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

// 🔐 SECURITY ENHANCEMENT: HttpOnly Cookie Authentication
// withCredentials: true permite que el navegador envíe y reciba cookies automáticamente
const apiClient = axios.create({
    baseURL,
    withCredentials: true,  // CRÍTICO: Habilita cookies HttpOnly
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    },
});

// Request Interceptor (Multi-tenant support only)
apiClient.interceptors.request.use(
    (config) => {
        // ✅ REMOVED: No more manual Authorization header injection
        // The browser automatically sends the HttpOnly cookie with every request

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
                // Unauthorized: Cookie expired or invalid
                console.warn('⚠️ 401 Detectado - Sesión expirada, redirigiendo a login...');

                // ✅ REMOVED: No more localStorage token cleanup (cookies are handled by browser)
                // The HttpOnly cookie will be cleared by calling /auth/logout or by expiration

                // Redirect to login
                if (window.location.pathname !== '/login') {
                    window.location.href = '/login';
                }
            }
            // For login failures, no action needed - component will handle error display
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

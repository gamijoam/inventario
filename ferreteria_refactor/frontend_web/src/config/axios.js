import axios from 'axios';
import toast from 'react-hot-toast';
import { API_BASE_URL } from './constants';

const isDev = import.meta.env.DEV;

// Forzamos el uso de la API CENTRAL en producción
const rawURL = API_BASE_URL.includes('/api/v1')
    ? API_BASE_URL
    : `${API_BASE_URL}/api/v1`;

const baseURL = rawURL.endsWith('/') ? rawURL : `${rawURL}/`;

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

        // --- MULTI-TENANT LOGIC (v33) ---
        // 1. Prioridad: Subdominio (Producción)
        const hostname = window.location.hostname;
        const parts = hostname.split('.');

        let tenantId = null;
        if (parts.length >= 3 && !hostname.includes('localhost')) {
            const subdomain = parts[0];
            if (!['www', 'api', 'app', 'dashboard'].includes(subdomain)) {
                tenantId = subdomain;
            }
        }

        // 2. Fallback: LocalStorage (Desarrollo/Testing)
        if (!tenantId) {
            const selectedTenant = localStorage.getItem('selected_tenant');
            if (selectedTenant && selectedTenant !== 'public') {
                tenantId = selectedTenant;
            }
        }

        // 3. Inject Header
        if (tenantId) {
            config.headers['X-Tenant-ID'] = tenantId;
            // console.log(`🔌 [Axios] Active Tenant: ${tenantId}`);
        }

        return config;
    },
    (error) => Promise.reject(error)
);

// Response Interceptor (Error Handling)
// Debounce mechanism for 403 errors to prevent toast spam
let last403Time = 0;
const DEBOUNCE_403_MS = 2000; // Only show one 403 toast every 2 seconds

apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error.response ? error.response.status : null;

        if (status === 401) {
            // Exclude ALL /auth/ API routes from automatic redirect
            // This includes: /auth/token, /auth/forgot-password, /auth/reset-password, etc.
            const isAuthRoute = error.config.url.includes('/auth/');

            // Also exclude public page routes
            const publicPages = ['/login', '/forgot-password', '/reset-password', '/mobile/login'];
            const isPublicPage = publicPages.includes(window.location.pathname);

            const isLoginPage = window.location.pathname === '/login';

            if (!isAuthRoute && !isPublicPage && !isLoginPage) {
                // Unauthorized: Cookie expired or invalid
                console.warn('⚠️ 401 Detectado - Sesión expirada, redirigiendo a login...');

                // ✅ REMOVED: No more localStorage token cleanup (cookies are handled by browser)
                // The HttpOnly cookie will be cleared by calling /auth/logout or by expiration

                // Redirect to login
                if (window.location.pathname !== '/login') {
                    window.location.href = '/login';
                }
            }
            // For auth routes or public pages, let the component handle the error
        } else if (status === 403) {
            // Forbidden - Debounce to prevent multiple toasts
            const now = Date.now();
            if (now - last403Time > DEBOUNCE_403_MS) {
                toast.error('No tienes permisos para algunas acciones.');
                last403Time = now;
            }
            // Silently log the error without showing toast
            console.warn('⚠️ 403 Forbidden:', error.config.url);
        } else if (!status) {
            // Network Error
            toast.error('Error de conexión con el servidor.');
        }

        return Promise.reject(error);
    }
);

export default apiClient;

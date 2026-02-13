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

// 🔐 SECURITY ENHANCEMENT: Hybrid Authentication (Cookie + Token)
// Web uses Cookies (HttpOnly). Mobile uses Tokens (Authorization Header).
const apiClient = axios.create({
    baseURL, // Default to calculated URL, but interceptor can override
    withCredentials: true,  // Enable cookies for Web
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    },
});

// Request Interceptor (Multi-tenant & Hybrid Auth)
apiClient.interceptors.request.use(
    (config) => {
        // --- 1. MOBILE BASE URL OVERRIDE ---
        // If we are functioning as a Mobile App, we might have a stored API URL
        const mobileApiUrl = localStorage.getItem('api_url');
        if (mobileApiUrl && !window.location.hostname.includes('localhost') && !window.location.hostname.includes('miinventariofacil.com')) {
            // We are likely in Capacitor (file:// or similar)
            config.baseURL = mobileApiUrl;
        }

        // --- 2. TENANT RESOLUTION ---
        const hostname = window.location.hostname;
        const parts = hostname.split('.');

        let tenantId = null;

        // Priority A: Subdomain (Production Web)
        if (parts.length >= 3 && !hostname.includes('localhost')) {
            const subdomain = parts[0];
            if (!['www', 'api', 'app', 'dashboard'].includes(subdomain)) {
                tenantId = subdomain;
            }
        }

        // Priority B: LocalStorage (Mobile / Dev)
        if (!tenantId) {
            const selectedTenant = localStorage.getItem('selected_tenant');
            if (selectedTenant && selectedTenant !== 'public') {
                tenantId = selectedTenant;
            }
        }

        // Inject Tenant Header
        if (tenantId) {
            config.headers['X-Tenant-ID'] = tenantId;
        }

        // --- 3. MOBILE AUTH HEADER INJECTION ---
        // For mobile, cookies might not work reliably, so we inject the token manually if available
        const token = localStorage.getItem('token');
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
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
            const isAuthRoute = error.config.url.includes('/auth/');

            // Also exclude public page routes
            // ADAPTATION FOR HASH ROUTER: Check the hash, not pathname
            const currentHash = window.location.hash || '#/';
            const currentPath = currentHash.replace('#', '');

            const publicPages = ['/login', '/forgot-password', '/reset-password', '/mobile/login', '/mobile-welcome'];
            const isPublicPage = publicPages.some(page => currentPath.startsWith(page));

            const isLoginPage = currentPath === '/login';

            if (!isAuthRoute && !isPublicPage && !isLoginPage) {
                // Unauthorized: Cookie expired or invalid
                console.warn('⚠️ 401 Detectado - Sesión expirada, redirigiendo a login...');

                // Redirect to login (Using Hash)
                // Avoid infinite loop if already at login
                if (currentPath !== '/login') {
                    window.location.href = '/#/login';
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

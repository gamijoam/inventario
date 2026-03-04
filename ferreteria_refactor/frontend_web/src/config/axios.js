import axios from 'axios';
import toast from 'react-hot-toast';
import { API_BASE_URL } from './constants';
import { Capacitor } from '@capacitor/core';

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
        // If we are functioning as a Mobile App (Native), we MUST use the stored API URL
        const mobileApiUrl = localStorage.getItem('api_url');

        // Check if running natively (Android/iOS)
        if (Capacitor.isNativePlatform() && mobileApiUrl) {
            config.baseURL = mobileApiUrl;
        }
        // Fallback/Legacy Logic for debugging in browser with mobile mode simulation
        else if (mobileApiUrl && !window.location.hostname.includes('miinventariofacil.com') && !window.location.hostname.includes('localhost')) {
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
        // For mobile (Native), cookies don't work reliably, so we inject the token
        // For Web, we rely on Cookies (HttpOnly) and MUST NOT send the token to avoid conflicts
        const token = localStorage.getItem('token');
        if (token && Capacitor.isNativePlatform()) {
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

// Debounce mechanism for network errors to prevent toast spam on retries
let lastNetworkErrorTime = 0;
const DEBOUNCE_NETWORK_MS = 3000; // Only show one network-error toast every 3 seconds

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
            // Always log the URL + detail so we can diagnose in DevTools
            console.warn(
                `⛔ 403 Forbidden: ${error.config?.method?.toUpperCase()} ${error.config?.url}`,
                `| detail: ${error.response?.data?.detail || 'N/A'}`,
                `| silent: ${!!error.config?._silent403}`
            );
            // Skip toast if the caller already handles this error silently
            if (!error.config?._silent403) {
                const now = Date.now();
                if (now - last403Time > DEBOUNCE_403_MS) {
                    toast.error('No tienes permisos para algunas acciones.');
                    last403Time = now;
                }
            }
        } else if (!status) {
            // Network Error — always log which URL is failing so we can diagnose
            console.error(
                `🌐 [Network Error] ${error.config?.method?.toUpperCase()} ${error.config?.url}`,
                `| code: ${error.code || 'N/A'}`,
                `| silent: ${!!error.config?._silentNetworkError}`
            );
            // Skip toast if the caller opted out (e.g. CashContext has its own retry/error logic)
            if (!error.config?._silentNetworkError) {
                const now = Date.now();
                if (now - lastNetworkErrorTime > DEBOUNCE_NETWORK_MS) {
                    toast.error('Error de conexión con el servidor.');
                    lastNetworkErrorTime = now;
                }
            }
        }

        return Promise.reject(error);
    }
);

export default apiClient;

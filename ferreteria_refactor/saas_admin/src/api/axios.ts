import axios from 'axios';

const getApiUrl = () => {
    const envUrl = import.meta.env.VITE_API_URL;
    if (envUrl) return envUrl;

    const host = window.location.hostname;
    if (host.startsWith('admin-qa')) return 'https://api-qa.miinventariofacil.com/api/v1';
    if (host.startsWith('admin.')) return 'https://api.miinventariofacil.com/api/v1';

    // Dynamic Localhost Subdomain Handling
    if (import.meta.env.DEV && host.includes('.localhost')) {
        // e.g. admin.localhost:5174 -> http://admin.localhost:8000/api/v1
        return `http://${host.split(':')[0]}:8000/api/v1`;
    }

    return 'http://localhost:8000/api/v1'; // Default local fallback
};

const api = axios.create({
    baseURL: getApiUrl(),
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request Interceptor: Inject token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        // GLOBAL FIX: Inject Tenant ID from Subdomain
        // This ensures the API knows which tenant context to use,
        // even if the API domain is different (e.g. api-qa vs elsol.qa)
        const hostname = window.location.hostname;
        const parts = hostname.split('.');

        // Basic check to avoid sending it on localhost main or public domains
        // Ex: elsol.qa.miinventariofacil.com -> parts[0] = elsol
        if (parts.length >= 3) {
            const subdomain = parts[0];
            const reserved = ["www", "api", "app", "dashboard", "admin", "saas", "backoffice"];

            // Enhanced reserved check (starts with admin- or api-)
            const isReserved = reserved.includes(subdomain) ||
                subdomain.startsWith('admin-') ||
                subdomain.startsWith('api-');

            if (!isReserved) {
                config.headers['X-Tenant-ID'] = subdomain;
            }
        } else if (hostname.includes('.localhost') && !hostname.startsWith('localhost')) {
            // Localhost support: tenant.localhost
            config.headers['X-Tenant-ID'] = parts[0];
        }

        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response Interceptor: Handle 401 (Token expired/invalid)
api.interceptors.response.use(
    (response) => {
        return response;
    },
    (error) => {
        if (error.response && error.response.status === 401) {
            // IMPORTANT: Do NOT intercept 401 from auth endpoints (login, etc.)
            // Those 401s are intentional (wrong credentials) and should be handled by the login form.
            const requestUrl = error.config?.url || '';
            const isAuthEndpoint = requestUrl.includes('/auth/');

            if (!isAuthEndpoint) {
                // Clear session only for non-auth 401s (expired token, invalid session)
                localStorage.removeItem('token');
                localStorage.removeItem('user');

                // Redirect to login if not already there
                if (!window.location.pathname.includes('/login')) {
                    window.location.href = '/login';
                }
            }
        }
        return Promise.reject(error);
    }
);

export default api;

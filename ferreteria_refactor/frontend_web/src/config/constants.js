const getApiUrl = () => {
    // 1. Prioritize Environment Variable
    let url = import.meta.env.VITE_API_URL;

    // 2. Dynamic Localhost Subdomain Handling (Multi-tenant Dev)
    if (import.meta.env.DEV && window.location.hostname.includes('.localhost')) {
        // Example: ferreteria.localhost:5173 -> http://ferreteria.localhost:8000/api/v1
        return `http://${window.location.hostname.split(':')[0]}:8000/api/v1`;
    }

    // 3. Fallback for Development (Generic localhost)
    if (!url && import.meta.env.DEV) {
        return 'http://localhost:8000/api/v1';
    }

    // 4. Fallback for Production
    if (!url) {
        url = 'https://api.miinventariofacil.com/api/v1';
    }

    return url.trim().replace(/\/+$/, "");
};

export const API_BASE_URL = getApiUrl();
export const BASE_API_URL = API_BASE_URL;

// URL base sin /api/v1 para archivos estáticos (media)
export const API_ROOT_URL = API_BASE_URL.replace('/api/v1', '');


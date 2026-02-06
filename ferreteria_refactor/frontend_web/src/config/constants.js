const getApiUrl = () => {
    // 1. Prioritize Environment Variable
    let url = import.meta.env.VITE_API_URL;

    // 2. Fallback for Development
    if (!url && import.meta.env.DEV) {
        return 'http://localhost:8000';
    }

    // 3. Fallback for Production (Staging/QA should have the var set)
    if (!url) {
        url = 'https://api.miinventariofacil.com/api/v1';
    }

    // Cleaning: Ensure no double /api/v1 and no trailing slashes
    url = url.trim().replace(/\/+$/, ""); // Remove trailing slashes

    return url;
};

export const API_BASE_URL = getApiUrl();
export const BASE_API_URL = API_BASE_URL;

// URL base sin /api/v1 para archivos estáticos (media)
export const API_ROOT_URL = API_BASE_URL.replace('/api/v1', '');


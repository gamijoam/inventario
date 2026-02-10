import axios from 'axios';

const getApiUrl = () => {
    const envUrl = import.meta.env.VITE_API_URL;
    if (envUrl) return envUrl;

    // Dynamic Localhost Subdomain Handling
    if (import.meta.env.DEV && window.location.hostname.includes('.localhost')) {
        // e.g. admin.localhost:5174 -> http://admin.localhost:8000/api/v1
        return `http://${window.location.hostname.split(':')[0]}:8000/api/v1`;
    }

    return 'http://localhost:8000/api/v1'; // Default Fallback
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
            // Clear session
            localStorage.removeItem('token');
            localStorage.removeItem('user');

            // Redirect to login if not already there
            if (!window.location.pathname.includes('/login')) {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export default api;

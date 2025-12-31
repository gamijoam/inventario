import { createContext, useState, useEffect, useContext } from 'react';
import apiClient from '../config/axios';
import authService from '../services/authService';

const AuthContext = createContext(null);

// Helper function to decode JWT token
const decodeToken = (token) => {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
            atob(base64)
                .split('')
                .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                .join('')
        );
        return JSON.parse(jsonPayload);
    } catch (error) {
        console.error('Error decoding token:', error);
        return null;
    }
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [loading, setLoading] = useState(true);

    // Fetch user profile from backend
    const fetchUserProfile = async (authToken) => {
        try {
            // Decode token to get username
            const decoded = decodeToken(authToken);
            if (!decoded || !decoded.sub) {
                throw new Error('Invalid token');
            }

            // Fetch full user profile from backend
            const response = await apiClient.get('/users', {
                headers: { Authorization: `Bearer ${authToken}` }
            });

            console.log('User Profile Response:', response.data);

            if (!Array.isArray(response.data)) {
                console.warn('Expected array of users, got:', response.data);
                throw new Error('Invalid response format from /users');
            }

            // Find current user by username from token
            const currentUser = response.data.find(u => u.username === decoded.sub);

            if (currentUser) {
                const userData = {
                    id: currentUser.id,
                    username: currentUser.username,
                    role: currentUser.role,
                    full_name: currentUser.full_name,
                    is_active: currentUser.is_active
                };

                setUser(userData);
                localStorage.setItem('user', JSON.stringify(userData));
                return userData;
            } else {
                throw new Error('User not found');
            }
            return null;
        } catch (error) {
            console.error('Error fetching user profile:', error);

            // Fallback: decode from token
            const decoded = decodeToken(authToken);
            if (decoded) {
                const fallbackUser = {
                    id: 'offline-user',
                    username: decoded.sub,
                    role: decoded.role || 'CASHIER',
                    full_name: decoded.sub,
                    is_active: true,
                    isOffline: true
                };
                setUser(fallbackUser);
                localStorage.setItem('user', JSON.stringify(fallbackUser));
                return fallbackUser;
            }
            return null;
        }
    };

    useEffect(() => {
        const initAuth = async () => {
            if (token) {
                localStorage.setItem('token', token);

                // Try to load user from localStorage first
                const storedUser = localStorage.getItem('user');
                if (storedUser) {
                    try {
                        setUser(JSON.parse(storedUser));
                    } catch (e) {
                        console.error('Error parsing stored user:', e);
                    }
                }

                // Fetch fresh user data
                await fetchUserProfile(token);
            } else {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                setUser(null);
            }
            setLoading(false);
        };

        initAuth();
    }, [token]);

    // Axios Interceptors
    useEffect(() => {
        // Request Interceptor: Attach Token
        const reqInterceptor = apiClient.interceptors.request.use(
            (config) => {
                if (token) {
                    config.headers.Authorization = `Bearer ${token}`;
                }
                return config;
            },
            (error) => Promise.reject(error)
        );

        // Response Interceptor: Handle 401 (Expired Token)
        const resInterceptor = apiClient.interceptors.response.use(
            (response) => response,
            (error) => {
                if (error.response && error.response.status === 401) {
                    console.warn('Session expired or unauthorized. Logging out...');
                    logout();
                }
                return Promise.reject(error);
            }
        );

        return () => {
            apiClient.interceptors.request.eject(reqInterceptor);
            apiClient.interceptors.response.eject(resInterceptor);
        };
    }, [token]);

    const login = async (username, password) => {
        try {
            const data = await authService.login(username, password);
            setToken(data.access_token);
            localStorage.setItem('token', data.access_token);

            // Fetch user profile immediately after login
            await fetchUserProfile(data.access_token);

            return true;
        } catch (error) {
            console.error("Login failed", error);
            throw error;
        }
    };

    const logout = () => {
        setToken(null);
        setUser(null);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    };

    // Helper function to check if user has required role
    const hasRole = (requiredRoles) => {
        if (!user || !user.role) return false;

        // If requiredRoles is a string, convert to array
        const rolesArray = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];

        return rolesArray.includes(user.role);
    };

    // Helper function to check if user is admin
    const isAdmin = () => hasRole('ADMIN');

    return (
        <AuthContext.Provider value={{
            user,
            token,
            login,
            logout,
            loading,
            hasRole,
            isAdmin
        }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);

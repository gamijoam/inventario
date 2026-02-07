import { createContext, useState, useEffect, useContext } from 'react';
import apiClient from '../config/axios';
import authService from '../services/authService';

const AuthContext = createContext(null);

// 🔐 SECURITY ENHANCEMENT: Cookie-Based Authentication
// No more localStorage token handling - cookies are managed by the browser

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    // Fetch current user profile from backend
    // This endpoint will use the HttpOnly cookie automatically
    const fetchUserProfile = async () => {
        try {
            console.log('🔍 Fetching user profile...');

            // Call /users/me endpoint that returns current authenticated user
            // The cookie is sent automatically by the browser
            const response = await apiClient.get('/users/me');

            const currentUser = response.data;

            const userData = {
                id: currentUser.id,
                username: currentUser.username,
                role: currentUser.role,
                full_name: currentUser.full_name,
                is_active: currentUser.is_active,
                preferences: currentUser.preferences || {}
            };

            setUser(userData);
            setIsAuthenticated(true);
            console.log('✅ User authenticated:', userData.username);

            return userData;
        } catch (error) {
            console.error('❌ Error fetching user profile:', error);

            // If 401, user is not authenticated
            if (error.response?.status === 401) {
                setUser(null);
                setIsAuthenticated(false);
            }

            throw error;
        }
    };

    // Initialize authentication on app load
    useEffect(() => {
        const initAuth = async () => {
            // Skip auth check for public routes
            const publicRoutes = ['/login', '/forgot-password', '/reset-password', '/mobile/login'];
            const currentPath = window.location.pathname;

            if (publicRoutes.includes(currentPath)) {
                console.log(`⏭️ Skipping auth check for public route: ${currentPath}`);
                setLoading(false);
                return;
            }

            try {
                // Try to fetch user profile using the HttpOnly cookie
                await fetchUserProfile();
            } catch (error) {
                // If fetch fails (401), user needs to login
                console.log('No active session found');
                setUser(null);
                setIsAuthenticated(false);
            } finally {
                setLoading(false);
            }
        };

        initAuth();
    }, []);

    const login = async (username, password) => {
        try {
            console.log('🔐 Attempting login...');

            // Call login endpoint - backend will set HttpOnly cookie
            const data = await authService.login(username, password);

            console.log('✅ Login successful, cookie set by backend');

            // ✅ REMOVED: No more localStorage.setItem('token', ...)
            // The cookie is automatically set by the backend and sent by the browser

            // Fetch user profile immediately after login
            await fetchUserProfile();

            return true;
        } catch (error) {
            console.error("❌ Login failed", error);
            setUser(null);
            setIsAuthenticated(false);
            throw error;
        }
    };

    const logout = async () => {
        try {
            console.log('🚪 Logging out...');

            // Call backend logout endpoint to clear the HttpOnly cookie
            await apiClient.post('/auth/logout');

            console.log('✅ Logout successful, cookie cleared by backend');
        } catch (error) {
            console.error('Error during logout:', error);
            // Continue with local cleanup even if backend call fails
        } finally {
            // Clear local state
            setUser(null);
            setIsAuthenticated(false);

            // 🧹 PURGE ALL STORAGE
            localStorage.clear();
            sessionStorage.clear();
            console.log('🧹 Purged localStorage and sessionStorage');
        }
    };

    // Helper function to check if user has required role
    const hasRole = (requiredRoles) => {
        if (!user || !user.role) return false;

        // If requiredRoles is a string, convert to array
        const rolesArray = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];

        return rolesArray.includes(user.role);
    };

    // Update user preferences
    const updateUserPreferences = async (newPreferences) => {
        if (!user) return;

        try {
            // Update preferences on backend
            await apiClient.put(`/users/${user.id}`, {
                preferences: { ...user.preferences, ...newPreferences }
            });

            // Update local state
            const updatedUser = {
                ...user,
                preferences: { ...user.preferences, ...newPreferences }
            };
            setUser(updatedUser);

            console.log('✅ User preferences updated');
        } catch (error) {
            console.error('Error updating preferences:', error);
            throw error;
        }
    };

    const value = {
        user,
        loading,
        isAuthenticated,
        login,
        logout,
        hasRole,
        updateUserPreferences,
        refreshUser: fetchUserProfile
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export default AuthContext;

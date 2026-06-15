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
                preferences: currentUser.preferences || {},
                tenant_id: currentUser.tenant_id, // NEW: Expose tenant_id to frontend components
                is_superuser: currentUser.is_superuser || false,
                org_role: currentUser.org_role || null,
                is_org_owner: currentUser.is_org_owner || false
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
            // Skip auth check for public routes
            const publicRoutes = ['/login', '/owner/login', '/forgot-password', '/reset-password', '/mobile/login', '/mobile-welcome'];

            // ADAPTATION FOR HASH ROUTER
            const currentHash = window.location.hash || '#/';
            const currentPath = currentHash.replace('#', '');

            // Check if current path starts with any public route (to handle params)
            const isPublicRoute = publicRoutes.some(route => currentPath.startsWith(route));

            if (isPublicRoute) {
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

            // 🔐 HYBRID AUTH: Save token to localStorage for Mobile App usage
            // The backend returns { access_token: "..." } in the body
            if (data.access_token) {
                localStorage.setItem('token', data.access_token);
                console.log('📱 Mobile Auth: Token saved to localStorage');
            }

            // Store tenant_slug so axios can send X-Tenant-ID on all subsequent requests.
            // This is critical for dev/localhost mode where there is no subdomain.
            if (data.tenant_slug) {
                localStorage.setItem('selected_tenant', data.tenant_slug);
                console.log(`🏢 Tenant context stored: ${data.tenant_slug}`);
            }
            // Multi-empresa: guardar empresas del grupo para el CompanySwitcher
            if (data.org_companies && data.org_companies.length > 0) {
                localStorage.setItem('org_companies', JSON.stringify(data.org_companies));
                console.log(`🏢 Org companies stored: ${data.org_companies.length} empresas`);
            } else {
                localStorage.removeItem('org_companies');
            }

            // Fetch user profile immediately after login
            await fetchUserProfile();

            // Retornar la data completa para que Login.jsx detecte multi-empresa
            return data;
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

            // 🧹 PURGE STORAGE (preserve API URL, tenant, and notification seen-flags)
            const apiUrl        = localStorage.getItem('api_url');
            const selectedTenant = localStorage.getItem('selected_tenant');
            const activeRegisterId = localStorage.getItem('cash_active_register_id');
            const hardwareClientId = localStorage.getItem('hardware_client_id');

            // Preserve "seen" flags so announcements and banners don't repeat after re-login
            const preserved = {};
            // org_companies no se preserva en logout — se limpia con localStorage.clear()
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (
                    key &&
                    (key.startsWith('announced_') ||       // AnnouncementModal seen
                     key.startsWith('announced:') ||       // scoped AnnouncementModal seen
                     key.startsWith('dismissed_popup_') || // GlobalBanner dismissed
                     key.startsWith('dismissed_popup:') || // scoped GlobalBanner dismissed
                     key === 'read_notifications' ||       // legacy Notification read list
                     key.startsWith('read_notifications:'))         // Notification read list
                ) {
                    preserved[key] = localStorage.getItem(key);
                }
            }

            localStorage.clear();
            sessionStorage.clear();

            // Restore critical config
            if (apiUrl) localStorage.setItem('api_url', apiUrl);
            if (selectedTenant && !selectedTenant.includes('public')) localStorage.setItem('selected_tenant', selectedTenant);
            if (activeRegisterId) localStorage.setItem('cash_active_register_id', activeRegisterId);
            if (hardwareClientId) localStorage.setItem('hardware_client_id', hardwareClientId);

            // Restore notification seen-flags
            Object.entries(preserved).forEach(([k, v]) => localStorage.setItem(k, v));

            console.log('🧹 Purged session, preserved API URL and notification flags');
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

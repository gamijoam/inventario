import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * ProtectedRoute Component
 * 
 * Protects routes based on authentication and optionally by user roles.
 * 
 * @param {string|string[]} roles - Optional. Required role(s) to access this route
 * @param {ReactNode} children - The component to render if authorized
 * @param {string} redirectTo - Where to redirect if unauthorized (default: '/unauthorized')
 */
const ProtectedRoute = ({ roles, children, redirectTo = '/unauthorized' }) => {
    const { user, token, hasRole, loading } = useAuth();

    // Wait for auth to load
    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Verificando permisos...</p>
                </div>
            </div>
        );
    }

    // Not logged in - redirect to login
    if (!token || !user) {
        return <Navigate to="/login" replace />;
    }

    // If roles are specified, check if user has required role
    if (roles && !hasRole(roles)) {
        console.warn(`Access denied: User ${user.username} (${user.role}) attempted to access route requiring ${roles}`);
        return <Navigate to={redirectTo} replace />;
    }

    // Authorized - render children or Outlet
    return children ? children : <Outlet />;
};

export default ProtectedRoute;

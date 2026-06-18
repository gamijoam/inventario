import { Navigate, Outlet } from 'react-router-dom';
import { Building2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const OwnerProtectedRoute = ({ children }) => {
    const { user, isAuthenticated, loading } = useAuth();

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-50">
                <div className="text-center">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                        <Building2 size={22} />
                    </div>
                    <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                    <p className="mt-4 text-sm font-bold text-slate-500">Validando acceso empresarial...</p>
                </div>
            </div>
        );
    }

    if (!isAuthenticated || !user) {
        return <Navigate to="/owner/login" replace />;
    }

    const hasOrgAccess = Boolean(user.is_superuser || user.is_org_owner || ['owner', 'manager'].includes(user.org_role));
    if (!hasOrgAccess) {
        return <Navigate to="/unauthorized" replace />;
    }

    return children ? children : <Outlet />;
};

export default OwnerProtectedRoute;

import { useAuth } from '../context/AuthContext';

/**
 * RoleGuard Component
 * 
 * Conditionally renders children based on user role.
 * If user doesn't have required role, renders nothing.
 * 
 * @param {string|string[]} allowed - Required role(s). Can be a single role or array of roles
 * @param {ReactNode} children - Content to render if user has required role
 * @param {ReactNode} fallback - Optional content to render if user doesn't have role
 * 
 * @example
 * // Single role
 * <RoleGuard allowed="ADMIN">
 *   <button>Delete Database</button>
 * </RoleGuard>
 * 
 * @example
 * // Multiple roles
 * <RoleGuard allowed={['ADMIN', 'WAREHOUSE']}>
 *   <button>Adjust Inventory</button>
 * </RoleGuard>
 * 
 * @example
 * // With fallback
 * <RoleGuard allowed="ADMIN" fallback={<p>Access Denied</p>}>
 *   <AdminPanel />
 * </RoleGuard>
 */
const RoleGuard = ({ allowed, children, fallback = null }) => {
    const { hasRole } = useAuth();

    // Check if user has required role
    if (!hasRole(allowed)) {
        return fallback;
    }

    return children;
};

export default RoleGuard;

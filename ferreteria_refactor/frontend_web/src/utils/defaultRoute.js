import { PERMISSIONS, PERMISSION_GROUPS } from '../config/permissions';

export const canAccessAny = (user, permissions = [], requiredPermissions = []) => {
  const required = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];
  if (!required.length) return true;
  if (user?.is_superuser || user?.role === 'ADMIN') return true;
  return required.some((permission) => permissions.includes(permission));
};

export const getDefaultRouteForUser = (user, permissions = [], options = {}) => {
  const { preferDashboard = true } = options;

  if (!user) return '/login';

  if (preferDashboard && canAccessAny(user, permissions, [PERMISSIONS.DASHBOARD_VIEW])) {
    return '/';
  }

  if (user.role === 'CASHIER' || canAccessAny(user, permissions, PERMISSION_GROUPS.POS)) {
    return '/pos';
  }

  if (user.role === 'WAREHOUSE' || canAccessAny(user, permissions, PERMISSION_GROUPS.INVENTORY)) {
    return '/inventory-center';
  }

  if (canAccessAny(user, permissions, PERMISSION_GROUPS.SALES)) {
    return '/sales-center';
  }

  if (canAccessAny(user, permissions, PERMISSION_GROUPS.PURCHASES)) {
    return '/purchases';
  }

  if (canAccessAny(user, permissions, PERMISSION_GROUPS.REPORTS)) {
    return '/reports';
  }

  if (canAccessAny(user, permissions, PERMISSION_GROUPS.CONFIG)) {
    return '/config-center';
  }

  if (canAccessAny(user, permissions, [PERMISSIONS.SERVICES_ORDERS_MANAGE])) {
    return '/services';
  }

  if (canAccessAny(user, permissions, [PERMISSIONS.RESTAURANT_ORDERS_MANAGE])) {
    return '/restaurant/tables';
  }

  if (canAccessAny(user, permissions, [PERMISSIONS.SUPPORT_CHAT_USE])) {
    return '/support';
  }

  return '/unauthorized';
};

import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, Package, Users, Menu, Wrench, BarChart2 } from 'lucide-react';
import { cn } from '../../utils/cn';
import { useConfig } from '../../context/ConfigContext';
import { useAuth } from '../../context/AuthContext';
import { PERMISSIONS, PERMISSION_GROUPS } from '../../config/permissions';

export default function MobileBottomNav({ onOpenMenu }) {
    const location   = useLocation();
    const { modules } = useConfig();
    const { user, hasPermission, hasAnyPermission } = useAuth();
    const isAdmin = user?.role === 'ADMIN';
    const canViewDashboard = isAdmin || hasPermission(PERMISSIONS.DASHBOARD_VIEW);
    const canOpenPos = isAdmin || hasAnyPermission(PERMISSION_GROUPS.POS);
    const canOpenInventory = isAdmin || hasAnyPermission(PERMISSION_GROUPS.INVENTORY);
    const canOpenSales = isAdmin || hasAnyPermission(PERMISSION_GROUPS.SALES) || canOpenPos;
    const canOpenReports = isAdmin || hasAnyPermission(PERMISSION_GROUPS.REPORTS);
    const canOpenServices = isAdmin || hasPermission(PERMISSIONS.SERVICES_ORDERS_MANAGE);

    // Items base — siempre visibles
    const baseItems = [
        ...(canViewDashboard ? [{ icon: LayoutDashboard, label: 'Inicio', path: '/' }] : []),
        ...(canOpenPos ? [{ icon: ShoppingCart, label: 'Vender', path: '/pos' }] : []),
        ...(canOpenInventory ? [{ icon: Package, label: 'Inventario', path: '/inventory-center' }] : []),
    ];

    // Item dinámico — Taller si tiene el módulo, si no Clientes
    const dynamicItem = modules?.services && canOpenServices
        ? { icon: Wrench, label: 'Taller', path: '/services' }
        : (canOpenSales ? { icon: Users, label: 'Clientes', path: '/sales-center?tab=clientes' } : null);

    // Item admin — Reportes si es admin, si no Clientes
    const adminItem = canOpenReports
        ? { icon: BarChart2, label: 'Reportes', path: '/reports' }
        : (canOpenSales ? { icon: Users, label: 'Clientes', path: '/sales-center?tab=clientes' } : null);

    const navItems = [...baseItems, dynamicItem, adminItem].filter(Boolean);

    // Deduplicar si hay coincidencias
    const seen = new Set();
    const uniqueItems = navItems.filter(item => {
        if (seen.has(item.path)) return false;
        seen.add(item.path);
        return true;
    }).slice(0, 4); // máx 4 items + botón menú

    const isActive = (path) => {
        if (path === '/') return location.pathname === '/';
        return location.pathname.startsWith(path.split('?')[0]);
    };

    return (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1.5 pb-[calc(0.25rem+env(safe-area-inset-bottom))] z-40 flex justify-around items-end shadow-[0_-4px_12px_-1px_rgba(0,0,0,0.06)]">
            {uniqueItems.map((item) => {
                const active = isActive(item.path);
                return (
                    <Link key={item.path} to={item.path}
                        className={cn(
                            "flex min-w-[56px] flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 transition-colors",
                            active ? "bg-indigo-50 text-indigo-600" : "text-slate-400 hover:bg-slate-50 hover:text-slate-600"
                        )}>
                        <div className={cn(
                            "rounded-md p-1.5 transition-colors",
                            active ? "bg-white/70" : ""
                        )}>
                            <item.icon size={20} strokeWidth={active ? 2.5 : 2}
                                className={cn("transition-transform duration-200", active ? "scale-105" : "")} />
                        </div>
                        <span className={cn("text-[9px] font-bold tracking-wide leading-none", active ? "text-indigo-600" : "")}>
                            {item.label}
                        </span>
                    </Link>
                );
            })}

            {/* Botón menú */}
            <button onClick={onOpenMenu}
                className="flex min-w-[56px] flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600">
                <div className="rounded-md p-1.5">
                    <Menu size={20} strokeWidth={2} />
                </div>
                <span className="text-[9px] font-bold tracking-wide leading-none">Menú</span>
            </button>
        </div>
    );
}

import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, Package, Users, Menu, Wrench, BarChart2 } from 'lucide-react';
import { cn } from '../../utils/cn';
import { useConfig } from '../../context/ConfigContext';
import { useAuth } from '../../context/AuthContext';

export default function MobileBottomNav({ onOpenMenu }) {
    const location   = useLocation();
    const { modules } = useConfig();
    const { user }   = useAuth();
    const isAdmin    = user?.role === 'ADMIN';

    // Items base — siempre visibles
    const baseItems = [
        { icon: LayoutDashboard, label: 'Inicio',     path: '/' },
        { icon: ShoppingCart,    label: 'Vender',     path: '/pos' },
        { icon: Package,         label: 'Inventario', path: '/inventory-center' },
    ];

    // Item dinámico — Taller si tiene el módulo, si no Clientes
    const dynamicItem = modules?.services
        ? { icon: Wrench, label: 'Taller', path: '/services' }
        : { icon: Users,  label: 'Clientes', path: '/sales-center?tab=clientes' };

    // Item admin — Reportes si es admin, si no Clientes
    const adminItem = isAdmin
        ? { icon: BarChart2, label: 'Reportes', path: '/reports' }
        : { icon: Users,     label: 'Clientes', path: '/sales-center?tab=clientes' };

    const navItems = [...baseItems, dynamicItem, adminItem];

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
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1 pb-[calc(0.25rem+env(safe-area-inset-bottom))] z-40 flex justify-around items-end shadow-[0_-4px_12px_-1px_rgba(0,0,0,0.06)]">
            {uniqueItems.map((item) => {
                const active = isActive(item.path);
                return (
                    <Link key={item.path} to={item.path}
                        className={cn(
                            "flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-xl transition-all duration-200 min-w-[56px]",
                            active ? "text-indigo-600" : "text-slate-400 hover:text-slate-600"
                        )}>
                        <div className={cn(
                            "p-1.5 rounded-xl transition-all duration-200",
                            active ? "bg-indigo-50" : ""
                        )}>
                            <item.icon size={20} strokeWidth={active ? 2.5 : 2}
                                className={cn("transition-transform duration-200", active ? "scale-110" : "")} />
                        </div>
                        <span className={cn("text-[9px] font-bold tracking-wide leading-none", active ? "text-indigo-600" : "")}>
                            {item.label}
                        </span>
                    </Link>
                );
            })}

            {/* Botón menú */}
            <button onClick={onOpenMenu}
                className="flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-xl text-slate-400 hover:text-slate-600 transition-all duration-200 min-w-[56px]">
                <div className="p-1.5 rounded-xl">
                    <Menu size={20} strokeWidth={2} />
                </div>
                <span className="text-[9px] font-bold tracking-wide leading-none">Menú</span>
            </button>
        </div>
    );
}
